/**
 * GraphEngine event types.
 * Ported from graphon/graph_events/*.
 *
 * All events use a `_type` discriminant field for type narrowing.
 */

import {
  WorkflowNodeExecutionStatus,
} from './types.js'
import type {
  NodeType,
  WorkflowStartReason,
} from './types.js'

// ── Node run result ────────────────────────────────────────────────────────

export interface NodeRunResult {
  status: WorkflowNodeExecutionStatus
  inputs?: Record<string, unknown>
  outputs: Record<string, unknown>
  edgeSourceHandle?: string
  error?: string
  errorType?: string
  metadata?: Record<string, unknown>
}

// ── Base events ────────────────────────────────────────────────────────────

export interface GraphEngineEventBase {
  _type: string
}

export interface GraphNodeEventBase extends GraphEngineEventBase {
  id: string          // node execution id
  nodeId: string
  nodeType: NodeType
  inIterationId?: string | null
  inLoopId?: string | null
  nodeVersion?: string
  nodeRunResult: NodeRunResult
}

// ── Graph-level events ─────────────────────────────────────────────────────

export interface GraphRunStartedEvent extends GraphEngineEventBase {
  _type: 'graph_run_started'
  reason: WorkflowStartReason
}

export interface GraphRunSucceededEvent extends GraphEngineEventBase {
  _type: 'graph_run_succeeded'
  outputs: Record<string, unknown>
}

export interface GraphRunFailedEvent extends GraphEngineEventBase {
  _type: 'graph_run_failed'
  error: string
  exceptionsCount: number
}

export interface GraphRunPartialSucceededEvent extends GraphEngineEventBase {
  _type: 'graph_run_partial_succeeded'
  exceptionsCount: number
  outputs: Record<string, unknown>
}

export interface GraphRunAbortedEvent extends GraphEngineEventBase {
  _type: 'graph_run_aborted'
  reason: string | null
  outputs: Record<string, unknown>
}

// ── Node-level events ──────────────────────────────────────────────────────

export interface NodeRunStartedEvent extends GraphNodeEventBase {
  _type: 'node_run_started'
  nodeTitle: string
  predecessorNodeId?: string | null
  startAt: Date
  extras?: Record<string, unknown>
  providerType?: string
  providerId?: string
}

export interface NodeRunSucceededEvent extends GraphNodeEventBase {
  _type: 'node_run_succeeded'
  startAt: Date
  finishedAt: Date | null
}

export interface NodeRunFailedEvent extends GraphNodeEventBase {
  _type: 'node_run_failed'
  error: string
  startAt: Date
  finishedAt: Date | null
}

export interface NodeRunExceptionEvent extends GraphNodeEventBase {
  _type: 'node_run_exception'
  error: string
  startAt: Date
  finishedAt: Date | null
}

export interface NodeRunStreamChunkEvent extends GraphNodeEventBase {
  _type: 'node_run_stream_chunk'
  selector: string[]
  chunk: string
  isFinal: boolean
}

export type NodeRunRetryEvent = Omit<NodeRunStartedEvent, '_type'> & {
  _type: 'node_run_retry'
  error: string
  retryIndex: number
}

// ── Traversal events ───────────────────────────────────────────────────────

export interface GraphEdgeTakenEvent extends GraphEngineEventBase {
  _type: 'graph_edge_taken'
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string | null
}

export interface GraphEdgeSkippedEvent extends GraphEngineEventBase {
  _type: 'graph_edge_skipped'
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string | null
}

// ── Union type ─────────────────────────────────────────────────────────────

export type GraphEngineEvent =
  | GraphRunStartedEvent
  | GraphRunSucceededEvent
  | GraphRunFailedEvent
  | GraphRunPartialSucceededEvent
  | GraphRunAbortedEvent
  | NodeRunStartedEvent
  | NodeRunSucceededEvent
  | NodeRunFailedEvent
  | NodeRunExceptionEvent
  | NodeRunStreamChunkEvent
  | NodeRunRetryEvent
  | GraphEdgeTakenEvent
  | GraphEdgeSkippedEvent

export type GraphNodeEvent =
  | NodeRunStartedEvent
  | NodeRunSucceededEvent
  | NodeRunFailedEvent
  | NodeRunExceptionEvent
  | NodeRunStreamChunkEvent
  | NodeRunRetryEvent

export type GraphTraversalEvent = GraphEdgeTakenEvent | GraphEdgeSkippedEvent

// ── Helpers ────────────────────────────────────────────────────────────────

export function isNodeResultEvent(event: GraphNodeEvent): boolean {
  return (
    event._type === 'node_run_succeeded'
    || event._type === 'node_run_failed'
  )
}

export function defaultNodeRunResult(): NodeRunResult {
  return {
    status: WorkflowNodeExecutionStatus.RUNNING,
    outputs: {},
  }
}
