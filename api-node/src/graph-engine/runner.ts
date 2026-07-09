/**
 * GraphEngineRunner — spawns a child process to execute GraphEngine.
 *
 * Mirrors Python's Worker/Dispatcher architecture:
 * - Python uses `threading.Thread` workers with an event queue
 * - Node.js uses `child_process.fork()` with IPC messages
 *
 * This keeps the heavy graph execution isolated in a separate process,
 * preventing it from blocking the main HTTP server event loop.
 */

import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import type { GraphDict } from './graph.js'
import type { GraphEngineEvent } from './events.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RunnerStartPayload {
  graphDict: GraphDict
  workflowId: string
  inputs?: Record<string, unknown>
}

export interface RunnerResult {
  events: GraphEngineEvent[]
  status: 'succeeded' | 'failed' | 'aborted' | 'partial_succeeded' | 'error'
  error?: string
  outputs: Record<string, unknown>
}

// ── IPC message types (child → parent) ───────────────────────────────────────

interface IpcReadyMessage { type: 'ready' }
interface IpcEventMessage { type: 'event'; event: GraphEngineEvent }
interface IpcDoneMessage { type: 'done' }
interface IpcErrorMessage { type: 'error'; error: string }
type IpcMessage = IpcReadyMessage | IpcEventMessage | IpcDoneMessage | IpcErrorMessage

// ── Worker path resolution ───────────────────────────────────────────────────

/**
 * Resolves the worker script path based on the current runtime environment.
 * - tsx (dev): uses the `.ts` source file
 * - node (prod): uses the `.js` compiled file
 */
function resolveWorkerPath(): { workerPath: string; execArgv: string[] } {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  const ext = fileURLToPath(import.meta.url).endsWith('.ts')

  if (ext) {
    // Running under tsx — resolve .ts worker and add tsx loader for child
    const workerPath = resolve(currentDir, 'worker-process.ts')
    const execArgv = ['--import', 'tsx']
    return { workerPath, execArgv }
  }

  // Production — use compiled .js
  const workerPath = resolve(currentDir, 'worker-process.js')
  return { workerPath, execArgv: [] }
}

// ── Runner class ─────────────────────────────────────────────────────────────

export class GraphEngineRunner {
  private child: ChildProcess | null = null
  private aborted = false

  /**
   * Execute a workflow graph in a child process.
   * Returns a Promise that resolves when execution completes.
   */
  async run(payload: RunnerStartPayload): Promise<RunnerResult> {
    const { workerPath, execArgv } = resolveWorkerPath()

    return new Promise<RunnerResult>((resolve, reject) => {
      const events: GraphEngineEvent[] = []
      let settled = false

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true
          fn()
        }
      }

      // Fork child process
      this.child = fork(workerPath, [], {
        execArgv,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      })

      let readyResolve: (() => void) | null = null
      const ready = new Promise<void>((r) => { readyResolve = r })

      // Collect stdout/stderr for debugging
      this.child.stdout?.on('data', (data: Buffer) => {
        console.debug(`[graph-worker:${this.child!.pid}] ${data.toString().trim()}`)
      })
      this.child.stderr?.on('data', (data: Buffer) => {
        console.error(`[graph-worker:${this.child!.pid}] ${data.toString().trim()}`)
      })

      // Handle child process errors (e.g., crash, spawn failure)
      this.child.on('error', (err) => {
        settle(() => reject(new Error(`Worker process error: ${err.message}`)))
      })

      // Handle IPC messages from child
      this.child.on('message', (msg: IpcMessage) => {
        if (!msg || typeof msg !== 'object') return

        switch (msg.type) {
          case 'ready':
            readyResolve?.()
            break

          case 'event':
            events.push(msg.event)
            break

          case 'done': {
            // Determine final status from collected events
            const result = this.buildResult(events)
            settle(() => resolve(result))
            break
          }

          case 'error': {
            const result: RunnerResult = {
              events,
              status: 'error',
              error: msg.error,
              outputs: {},
            }
            settle(() => resolve(result))
            break
          }
        }
      })

      // Handle unexpected child exit (including SIGKILL/SIGTERM)
      this.child.on('exit', (code, signal) => {
        if (code !== 0 || signal) {
          settle(() => reject(
            new Error(`Worker process exited with code ${code}, signal: ${signal}`),
          ))
        }
      })

      // Wait for child to be ready, then send start message
      ready.then(() => {
        this.child?.send({
          type: 'start',
          payload: {
            graphDict: payload.graphDict,
            workflowId: payload.workflowId,
            inputs: payload.inputs,
          },
        })
      }).catch((err) => settle(() => reject(err)))
    })
  }

  /**
   * Send an abort signal to the running worker process.
   */
  abort(reason = 'User requested abort'): void {
    if (this.child && !this.aborted) {
      this.aborted = true
      this.child.send({ type: 'abort', reason })
    }
  }

  /**
   * Kill the worker process forcefully.
   */
  kill(): void {
    if (this.child) {
      this.child.kill('SIGKILL')
      this.child = null
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildResult(events: GraphEngineEvent[]): RunnerResult {
    let terminalEvent: GraphEngineEvent | undefined
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!
      if (
        e._type === 'graph_run_succeeded'
        || e._type === 'graph_run_failed'
        || e._type === 'graph_run_aborted'
        || e._type === 'graph_run_partial_succeeded'
      ) {
        terminalEvent = e
        break
      }
    }

    if (!terminalEvent) {
      return { events, status: 'error', error: 'No terminal event received', outputs: {} }
    }

    switch (terminalEvent._type) {
      case 'graph_run_succeeded':
        return {
          events,
          status: 'succeeded',
          outputs: terminalEvent.outputs,
        }
      case 'graph_run_failed':
        return {
          events,
          status: 'failed',
          error: terminalEvent.error,
          outputs: {},
        }
      case 'graph_run_aborted':
        return {
          events,
          status: 'aborted',
          error: terminalEvent.reason ?? undefined,
          outputs: terminalEvent.outputs,
        }
      case 'graph_run_partial_succeeded':
        return {
          events,
          status: 'partial_succeeded',
          outputs: terminalEvent.outputs,
        }
      default:
        return { events, status: 'error', error: 'Unknown terminal event', outputs: {} }
    }
  }
}
