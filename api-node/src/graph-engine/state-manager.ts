/**
 * Graph state manager — node/edge state + execution tracking.
 * Ported from graphon/graph_engine/graph_state_manager.py.
 */

import type { Edge } from './graph.js'
import { Graph } from './graph.js'
import { NodeState } from './types.js'

// ── Edge state analysis ────────────────────────────────────────────────────

export interface EdgeStateAnalysis {
  hasUnknown: boolean
  hasTaken: boolean
  allSkipped: boolean
}

// ── State manager ──────────────────────────────────────────────────────────

export class GraphStateManager {
  private readonly graph: Graph
  private readonly readyQueue: string[] = []
  private readonly executingNodes = new Set<string>()

  constructor(graph: Graph) {
    this.graph = graph
  }

  // ── Node state ops ────────────────────────────────────────────────────

  enqueueNode(nodeId: string): void {
    const node = this.graph.nodes.get(nodeId)
    if (node) node.state = NodeState.TAKEN
    this.readyQueue.push(nodeId)
  }

  dequeueNode(): string | undefined {
    return this.readyQueue.shift()
  }

  markNodeSkipped(nodeId: string): void {
    const node = this.graph.nodes.get(nodeId)
    if (node) node.state = NodeState.SKIPPED
  }

  isNodeReady(nodeId: string): boolean {
    const incoming = this.graph.getIncomingEdges(nodeId)
    if (incoming.length === 0) return true
    if (incoming.some(e => e.state === NodeState.UNKNOWN)) return false
    return incoming.some(e => e.state === NodeState.TAKEN)
  }

  getNodeState(nodeId: string): NodeState {
    return this.graph.nodes.get(nodeId)?.state ?? NodeState.UNKNOWN
  }

  // ── Edge state ops ────────────────────────────────────────────────────

  markEdgeTaken(edgeId: string): void {
    const edge = this.graph.edges.get(edgeId)
    if (edge) edge.state = NodeState.TAKEN
  }

  markEdgeSkipped(edgeId: string): void {
    const edge = this.graph.edges.get(edgeId)
    if (edge) edge.state = NodeState.SKIPPED
  }

  analyzeEdgeStates(edges: Edge[]): EdgeStateAnalysis {
    const states = new Set(edges.map(e => e.state))
    return {
      hasUnknown: states.has(NodeState.UNKNOWN),
      hasTaken: states.has(NodeState.TAKEN),
      allSkipped: states.size === 0
        ? true
        : states.size === 1 && states.has(NodeState.SKIPPED),
    }
  }

  categorizeBranchEdges(
    nodeId: string,
    selectedHandle: string,
  ): { selectedEdges: Edge[]; unselectedEdges: Edge[] } {
    const outgoing = this.graph.getOutgoingEdges(nodeId)
    const selectedEdges: Edge[] = []
    const unselectedEdges: Edge[] = []

    for (const edge of outgoing) {
      if (edge.sourceHandle === selectedHandle) {
        selectedEdges.push(edge)
      }
      else {
        unselectedEdges.push(edge)
      }
    }

    return { selectedEdges, unselectedEdges }
  }

  // ── Execution tracking ────────────────────────────────────────────────

  startExecution(nodeId: string): void {
    this.executingNodes.add(nodeId)
  }

  finishExecution(nodeId: string): void {
    this.executingNodes.delete(nodeId)
  }

  isExecutionComplete(): boolean {
    return this.readyQueue.length === 0 && this.executingNodes.size === 0
  }

  getQueueDepth(): number {
    return this.readyQueue.length
  }

  getExecutingCount(): number {
    return this.executingNodes.size
  }
}
