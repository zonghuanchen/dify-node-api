/**
 * Graph execution state tracking.
 * Ported from graphon/runtime/graph_runtime_state.py (GraphExecution / NodeExecution).
 */

import { NodeState } from './types.js'

// ── Node execution ─────────────────────────────────────────────────────────

export class NodeExecution {
  state: NodeState = NodeState.UNKNOWN
  retryCount = 0
  executionId: string | null = null

  markStarted(executionId: string): void {
    this.executionId = executionId
    this.state = NodeState.TAKEN
  }

  markTaken(): void {
    this.state = NodeState.TAKEN
  }

  markFailed(_error: string): void {
    this.state = NodeState.SKIPPED
  }

  incrementRetry(): void {
    this.retryCount++
  }
}

// ── Graph execution aggregate ──────────────────────────────────────────────

export class GraphExecution {
  workflowId = ''
  started = false
  completed = false
  aborted = false
  paused = false
  error: Error | null = null
  exceptionsCount = 0
  pauseReasons: string[] = []

  private readonly _nodeExecutions = new Map<string, NodeExecution>()

  get nodeExecutions(): ReadonlyMap<string, NodeExecution> {
    return this._nodeExecutions
  }

  get isPaused(): boolean {
    return this.paused
  }

  get hasError(): boolean {
    return this.error !== null
  }

  start(): void {
    this.started = true
  }

  complete(): void {
    this.completed = true
  }

  abort(reason: string): void {
    this.aborted = true
    this.error = new Error(reason)
  }

  pause(reason: string): void {
    this.paused = true
    this.pauseReasons.push(reason)
  }

  fail(error: Error): void {
    this.error = error
  }

  recordNodeFailure(): void {
    this.exceptionsCount++
  }

  getOrCreateNodeExecution(nodeId: string): NodeExecution {
    let ne = this._nodeExecutions.get(nodeId)
    if (!ne) {
      ne = new NodeExecution()
      this._nodeExecutions.set(nodeId, ne)
    }
    return ne
  }
}
