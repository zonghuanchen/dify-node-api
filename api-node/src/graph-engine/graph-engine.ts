/**
 * GraphEngine — main orchestrator for workflow execution.
 * Ported from graphon/graph_engine/graph_engine.py.
 *
 * Minimal skeleton: single-threaded async event loop,
 * no worker pool, no dispatcher thread, no layers.
 */

import type {
  GraphEngineEvent,
  GraphNodeEvent,
  NodeRunFailedEvent,
  NodeRunResult,
  NodeRunSucceededEvent,
} from './events.js'
import { defaultNodeRunResult } from './events.js'
import { EdgeProcessor } from './edge-processor.js'
import { GraphExecution } from './graph-execution.js'
import { GraphStateManager } from './state-manager.js'
import type { Graph, NodeFactory } from './graph.js'
import { VariablePool } from './variable-pool.js'
import {
  ErrorStrategy,
  WorkflowNodeExecutionStatus,
  WorkflowStartReason,
} from './types.js'

// ── Config ─────────────────────────────────────────────────────────────────

export interface GraphEngineConfig {
  retryDelayMs?: number
}

const DEFAULT_CONFIG: GraphEngineConfig = {
  retryDelayMs: 1000,
}

// ── Engine ─────────────────────────────────────────────────────────────────

export interface GraphEngineOptions {
  workflowId: string
  graph: Graph
  variablePool?: VariablePool
  config?: GraphEngineConfig
}

export class GraphEngine {
  private readonly graph: Graph
  private readonly variablePool: VariablePool
  private readonly graphExecution: GraphExecution
  private readonly stateManager: GraphStateManager
  private readonly edgeProcessor: EdgeProcessor
  private readonly config: GraphEngineConfig

  constructor(options: GraphEngineOptions) {
    this.graph = options.graph
    this.variablePool = options.variablePool ?? new VariablePool()
    this.config = { ...DEFAULT_CONFIG, ...options.config }

    // Execution state
    this.graphExecution = new GraphExecution()
    this.graphExecution.workflowId = options.workflowId

    // State management
    this.stateManager = new GraphStateManager(this.graph)

    // Edge processing
    this.edgeProcessor = new EdgeProcessor(this.graph, this.stateManager)
  }

  /** Request abort from outside. */
  requestAbort(reason = 'User requested abort'): void {
    this.graphExecution.abort(reason)
  }

  get execution(): GraphExecution {
    return this.graphExecution
  }

  /**
   * Execute the graph, yielding events as they occur.
   */
  async *run(): AsyncGenerator<GraphEngineEvent> {
    // 1. Start
    this.graphExecution.start()

    yield {
      _type: 'graph_run_started',
      reason: WorkflowStartReason.INITIAL,
    }

    // 2. Enqueue root node
    const rootNode = this.graph.rootNode
    this.stateManager.enqueueNode(rootNode.id)
    this.stateManager.startExecution(rootNode.id)

    // 3. Process ready queue
    try {
      yield* this.executeLoop()
    }
    catch (err) {
      yield {
        _type: 'graph_run_failed',
        error: err instanceof Error ? err.message : String(err),
        exceptionsCount: this.graphExecution.exceptionsCount,
      }
      return
    }

    // 4. Emit terminal event
    yield* this.emitTerminalEvents()
  }

  // ── Main execution loop ────────────────────────────────────────────────

  private async *executeLoop(): AsyncGenerator<GraphEngineEvent> {
    while (!this.graphExecution.aborted && !this.graphExecution.hasError) {
      const nodeId = this.stateManager.dequeueNode()
      if (!nodeId) break // queue empty — execution complete

      const node = this.graph.nodes.get(nodeId)
      if (!node) continue

      yield* this.executeNode(node)
    }
  }

  // ── Execute a single node ──────────────────────────────────────────────

  private async *executeNode(
    node: import('./graph.js').Node,
  ): AsyncGenerator<GraphEngineEvent> {
    node.ensureExecutionId()

    let lastResultEvent: GraphNodeEvent | null = null

    // Consume node events
    for await (const event of node.run()) {
      lastResultEvent = event
      yield event

      // Check abort after each event
      if (this.graphExecution.aborted) return
    }

    // Handle the terminal event from node execution
    if (lastResultEvent) {
      yield* this.handleNodeResult(node, lastResultEvent)
    }
  }

  // ── Handle node result ─────────────────────────────────────────────────

  private async *handleNodeResult(
    node: import('./graph.js').Node,
    event: GraphNodeEvent,
  ): AsyncGenerator<GraphEngineEvent> {
    const nodeExecution = this.graphExecution.getOrCreateNodeExecution(node.id)

    switch (event._type) {
      case 'node_run_succeeded':
        yield* this.handleNodeSucceeded(node, event as NodeRunSucceededEvent)
        break

      case 'node_run_failed':
        yield* this.handleNodeFailed(node, event as NodeRunFailedEvent, nodeExecution)
        break

      case 'node_run_exception':
        // Exception events are handled like success (via fail-branch / default-value)
        yield* this.handleNodeException(node, event)
        break

      default:
        // Non-terminal events (stream chunks, etc.) — nothing to do
        break
    }
  }

  private *handleNodeSucceeded(
    node: import('./graph.js').Node,
    event: NodeRunSucceededEvent,
  ): Generator<GraphEngineEvent> {
    const nodeExecution = this.graphExecution.getOrCreateNodeExecution(node.id)
    nodeExecution.markTaken()

    // Store outputs in variable pool
    this.storeNodeOutputs(node.id, event.nodeRunResult.outputs)

    // Process edges
    const { readyNodes, events: traversalEvents } = this.edgeProcessor.processNodeSuccess(
      node.id,
      event.nodeRunResult.edgeSourceHandle,
    )

    // Yield traversal events
    yield* traversalEvents

    // Enqueue ready downstream nodes
    for (const nextId of readyNodes) {
      this.stateManager.enqueueNode(nextId)
      this.stateManager.startExecution(nextId)
    }

    this.stateManager.finishExecution(node.id)
  }

  private async *handleNodeFailed(
    node: import('./graph.js').Node,
    event: NodeRunFailedEvent,
    nodeExecution: import('./graph-execution.js').NodeExecution,
  ): AsyncGenerator<GraphEngineEvent> {
    nodeExecution.markFailed(event.error)
    this.graphExecution.recordNodeFailure()

    // Check retry
    if (node.retry && nodeExecution.retryCount < node.retryConfig.maxRetries) {
      nodeExecution.incrementRetry()
      this.stateManager.finishExecution(node.id)

      const retryDelay = node.retryConfig.retryIntervalSeconds * 1000
        || this.config.retryDelayMs!

      yield {
        ...event,
        _type: 'node_run_retry' as const,
        nodeTitle: node.title,
        error: event.error,
        retryIndex: nodeExecution.retryCount,
        nodeRunResult: event.nodeRunResult,
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay))

      // Re-enqueue
      node.resetExecutionId()
      this.stateManager.enqueueNode(node.id)
      this.stateManager.startExecution(node.id)
      return
    }

    // Check error strategy
    const strategy = node.errorStrategy
    if (strategy === ErrorStrategy.FAIL_BRANCH) {
      // Convert failure to exception and take fail-branch
      const exceptionEvent = this.buildExceptionEvent(node, event, ErrorStrategy.FAIL_BRANCH)
      yield exceptionEvent
      yield* this.handleNodeException(node, exceptionEvent)
      return
    }

    if (strategy === ErrorStrategy.DEFAULT_VALUE) {
      const exceptionEvent = this.buildExceptionEvent(node, event, ErrorStrategy.DEFAULT_VALUE)
      yield exceptionEvent
      yield* this.handleNodeException(node, exceptionEvent)
      return
    }

    // Default: abort
    this.graphExecution.fail(new Error(event.error))
    this.stateManager.finishExecution(node.id)
  }

  private *handleNodeException(
    node: import('./graph.js').Node,
    event: import('./events.js').NodeRunExceptionEvent,
  ): Generator<GraphEngineEvent> {
    const nodeExecution = this.graphExecution.getOrCreateNodeExecution(node.id)
    nodeExecution.markTaken()

    // Store exception outputs
    this.storeNodeOutputs(node.id, event.nodeRunResult.outputs)

    // Determine which edges to take
    let readyNodes: string[]
    let traversalEvents: import('./events.js').GraphTraversalEvent[]

    if (node.errorStrategy === ErrorStrategy.DEFAULT_VALUE) {
      const result = this.edgeProcessor.processNodeSuccess(node.id)
      readyNodes = result.readyNodes
      traversalEvents = result.events
    }
    else {
      // FAIL_BRANCH
      const result = this.edgeProcessor.handleBranchCompletion(
        node.id,
        event.nodeRunResult.edgeSourceHandle ?? 'fail-branch',
      )
      readyNodes = result.readyNodes
      traversalEvents = result.events
    }

    yield* traversalEvents

    for (const nextId of readyNodes) {
      this.stateManager.enqueueNode(nextId)
      this.stateManager.startExecution(nextId)
    }

    this.stateManager.finishExecution(node.id)
  }

  // ── Terminal events ────────────────────────────────────────────────────

  private *emitTerminalEvents(): Generator<GraphEngineEvent> {
    const exec = this.graphExecution

    if (exec.aborted) {
      yield {
        _type: 'graph_run_aborted',
        reason: exec.error?.message ?? 'Workflow execution aborted',
        outputs: {},
      }
      return
    }

    if (exec.hasError && exec.error) {
      yield {
        _type: 'graph_run_failed',
        error: exec.error.message,
        exceptionsCount: exec.exceptionsCount,
      }
      return
    }

    if (exec.exceptionsCount > 0) {
      yield {
        _type: 'graph_run_partial_succeeded',
        exceptionsCount: exec.exceptionsCount,
        outputs: {},
      }
      return
    }

    yield {
      _type: 'graph_run_succeeded',
      outputs: {},
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private storeNodeOutputs(nodeId: string, outputs: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(outputs)) {
      this.variablePool.set([nodeId, name], value)
    }
  }

  private buildExceptionEvent(
    node: import('./graph.js').Node,
    failedEvent: NodeRunFailedEvent,
    strategy: ErrorStrategy,
  ): import('./events.js').NodeRunExceptionEvent {
    const outputs: Record<string, unknown> = strategy === ErrorStrategy.DEFAULT_VALUE
      ? {
          ...node.defaultValueDict,
          error_message: failedEvent.nodeRunResult.error,
          error_type: failedEvent.nodeRunResult.errorType,
        }
      : {
          error_message: failedEvent.nodeRunResult.error,
          error_type: failedEvent.nodeRunResult.errorType,
        }

    const nodeRunResult: NodeRunResult = {
      status: WorkflowNodeExecutionStatus.EXCEPTION,
      inputs: failedEvent.nodeRunResult.inputs,
      outputs,
      edgeSourceHandle: strategy === ErrorStrategy.FAIL_BRANCH ? 'fail-branch' : undefined,
      metadata: { errorStrategy: strategy },
    }

    return {
      _type: 'node_run_exception',
      id: failedEvent.id,
      nodeId: failedEvent.nodeId,
      nodeType: failedEvent.nodeType,
      nodeRunResult,
      error: failedEvent.error,
      startAt: failedEvent.startAt,
      finishedAt: failedEvent.finishedAt,
    }
  }
}
