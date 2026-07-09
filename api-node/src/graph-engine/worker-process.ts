/**
 * Worker process entry point — runs GraphEngine in a child process.
 *
 * Communication with parent via Node.js IPC (`process.send` / `process.on('message')`):
 *   Parent → Child:
 *     { type: 'start', payload: { graphDict, workflowId, inputs } }
 *     { type: 'abort', reason?: string }
 *   Child → Parent:
 *     { type: 'event', event: GraphEngineEvent }
 *     { type: 'done' }
 *     { type: 'error', error: string }
 */

import { Graph } from './graph.js'
import type { GraphDict } from './graph.js'
import { GraphEngine } from './graph-engine.js'
import { DefaultNodeFactory } from './default-node-factory.js'
import { VariablePool } from './variable-pool.js'
import type { GraphEngineEvent } from './events.js'

// ── IPC message types ────────────────────────────────────────────────────────

interface StartMessage {
  type: 'start'
  payload: {
    graphDict: GraphDict
    workflowId: string
    inputs?: Record<string, unknown>
  }
}

interface AbortMessage {
  type: 'abort'
  reason?: string
}

type ParentMessage = StartMessage | AbortMessage

// ── State ────────────────────────────────────────────────────────────────────

let engine: GraphEngine | null = null
let running = false

// ── IPC helpers ──────────────────────────────────────────────────────────────

function sendToParent(msg: Record<string, unknown>): void {
  if (process.send) {
    process.send(msg)
  }
}

/**
 * Replacer for JSON.stringify that converts Date objects to ISO strings,
 * so the parent process can deserialize them correctly.
 */
function eventReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return { __date: value.toISOString() }
  }
  return value
}

function serializeEvent(event: GraphEngineEvent): unknown {
  return JSON.parse(JSON.stringify(event, eventReplacer))
}

// ── Engine execution ─────────────────────────────────────────────────────────

async function runEngine(payload: StartMessage['payload']): Promise<void> {
  running = true

  const factory = new DefaultNodeFactory()
  const graph = Graph.fromDict(payload.graphDict, factory)

  // Seed variable pool with workflow inputs
  const variablePool = new VariablePool()
  if (payload.inputs) {
    for (const [key, value] of Object.entries(payload.inputs)) {
      variablePool.set(['sys', key], value)
    }
  }

  engine = new GraphEngine({
    workflowId: payload.workflowId,
    graph,
    variablePool,
  })

  try {
    for await (const event of engine.run()) {
      sendToParent({ type: 'event', event: serializeEvent(event) })

      // Stop early if aborted or terminal
      if (
        event._type === 'graph_run_succeeded'
        || event._type === 'graph_run_failed'
        || event._type === 'graph_run_aborted'
        || event._type === 'graph_run_partial_succeeded'
      ) {
        break
      }
    }
  } catch (err) {
    sendToParent({
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    running = false
    engine = null
    sendToParent({ type: 'done' })
  }
}

// ── Message handler ──────────────────────────────────────────────────────────

process.on('message', (msg: ParentMessage) => {
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'start' && !running) {
    runEngine(msg.payload).catch((err) => {
      sendToParent({
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
      sendToParent({ type: 'done' })
    })
  }

  if (msg.type === 'abort' && engine) {
    engine.requestAbort(msg.reason ?? 'User requested abort')
  }
})

// ── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  if (engine) engine.requestAbort('Worker process SIGTERM')
  process.exit(0)
})

process.on('SIGINT', () => {
  if (engine) engine.requestAbort('Worker process SIGINT')
  process.exit(0)
})

// Signal ready to parent
sendToParent({ type: 'ready' })
