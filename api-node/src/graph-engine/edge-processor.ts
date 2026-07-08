/**
 * Edge processor with integrated skip propagation.
 * Ported from graphon/graph_engine/graph_traversal/edge_processor.py
 * and graphon/graph_engine/graph_traversal/skip_propagator.py.
 */

import type { Edge } from './graph.js'
import { Graph } from './graph.js'
import type { GraphStateManager } from './state-manager.js'
import type { GraphEdgeSkippedEvent, GraphEdgeTakenEvent, GraphTraversalEvent } from './events.js'
import { NodeExecutionType } from './types.js'

// ── Edge processor ─────────────────────────────────────────────────────────

export class EdgeProcessor {
  private readonly graph: Graph
  private readonly stateManager: GraphStateManager

  constructor(graph: Graph, stateManager: GraphStateManager) {
    this.graph = graph
    this.stateManager = stateManager
  }

  /**
   * Process edges after a node succeeds.
   * Returns downstream node IDs that are ready and traversal events.
   */
  processNodeSuccess(
    nodeId: string,
    selectedHandle?: string | null,
  ): { readyNodes: string[]; events: GraphTraversalEvent[] } {
    const node = this.graph.nodes.get(nodeId)
    if (!node) return { readyNodes: [], events: [] }

    if (node.executionType === NodeExecutionType.BRANCH) {
      return this.handleBranchCompletion(nodeId, selectedHandle ?? null)
    }
    return this.processNonBranchEdges(nodeId)
  }

  /**
   * Handle branch (if-else / question-classifier) node completion.
   */
  handleBranchCompletion(
    nodeId: string,
    selectedHandle: string | null,
  ): { readyNodes: string[]; events: GraphTraversalEvent[] } {
    if (!selectedHandle) {
      throw new Error(`Branch node ${nodeId} completed without selecting a branch`)
    }

    const { selectedEdges, unselectedEdges } = this.stateManager.categorizeBranchEdges(
      nodeId,
      selectedHandle,
    )

    // Skip unselected paths
    const skipEvents = this.skipBranchPaths(unselectedEdges)

    // Process selected (taken) edges
    const { readyNodes, events: takenEvents } = this.processTakenEdges(selectedEdges)

    return {
      readyNodes,
      events: [...skipEvents, ...takenEvents],
    }
  }

  // ── Non-branch edges ──────────────────────────────────────────────────

  private processNonBranchEdges(
    nodeId: string,
  ): { readyNodes: string[]; events: GraphTraversalEvent[] } {
    const edges = this.graph.getOutgoingEdges(nodeId)
    return this.processTakenEdges(edges)
  }

  private processTakenEdges(
    edges: Edge[],
  ): { readyNodes: string[]; events: GraphEdgeTakenEvent[] } {
    const readyNodes: string[] = []
    const events: GraphEdgeTakenEvent[] = []

    for (const edge of edges) {
      const { nodes, event } = this.processTakenEdge(edge)
      readyNodes.push(...nodes)
      events.push(event)
    }

    return { readyNodes, events }
  }

  private processTakenEdge(
    edge: Edge,
  ): { nodes: string[]; event: GraphEdgeTakenEvent } {
    this.stateManager.markEdgeTaken(edge.id)

    const nodes: string[] = []
    if (this.stateManager.isNodeReady(edge.head)) {
      nodes.push(edge.head)
    }

    return {
      nodes,
      event: {
        _type: 'graph_edge_taken',
        edgeId: edge.id,
        sourceNodeId: edge.tail,
        targetNodeId: edge.head,
        sourceHandle: edge.sourceHandle,
      },
    }
  }

  // ── Skip propagation ──────────────────────────────────────────────────

  private skipBranchPaths(unselectedEdges: Edge[]): GraphEdgeSkippedEvent[] {
    const events: GraphEdgeSkippedEvent[] = []
    for (const edge of unselectedEdges) {
      events.push(...this.skipEdgePath(edge))
    }
    return events
  }

  private skipEdgePath(edge: Edge): GraphEdgeSkippedEvent[] {
    this.stateManager.markEdgeSkipped(edge.id)
    return [
      this.buildSkippedEvent(edge),
      ...this.propagateSkipFromEdge(edge.id),
    ]
  }

  /**
   * Recursively propagate skip state from a skipped edge.
   */
  private propagateSkipFromEdge(edgeId: string): GraphEdgeSkippedEvent[] {
    const edge = this.graph.edges.get(edgeId)
    if (!edge) return []

    const downstreamNodeId = edge.head
    const incoming = this.graph.getIncomingEdges(downstreamNodeId)
    const analysis = this.stateManager.analyzeEdgeStates(incoming)

    // Stop if there are unknown edges (not yet processed)
    if (analysis.hasUnknown) return []

    // If any edge is taken, node may still execute
    if (analysis.hasTaken) {
      this.stateManager.enqueueNode(downstreamNodeId)
      this.stateManager.startExecution(downstreamNodeId)
      return []
    }

    // All edges skipped — propagate to this node
    if (analysis.allSkipped) {
      return this.propagateSkipToNode(downstreamNodeId)
    }

    return []
  }

  private propagateSkipToNode(nodeId: string): GraphEdgeSkippedEvent[] {
    this.stateManager.markNodeSkipped(nodeId)

    const events: GraphEdgeSkippedEvent[] = []
    const outgoing = this.graph.getOutgoingEdges(nodeId)
    for (const edge of outgoing) {
      events.push(...this.skipEdgePath(edge))
    }
    return events
  }

  // ── Event builders ────────────────────────────────────────────────────

  private buildSkippedEvent(edge: Edge): GraphEdgeSkippedEvent {
    return {
      _type: 'graph_edge_skipped',
      edgeId: edge.id,
      sourceNodeId: edge.tail,
      targetNodeId: edge.head,
      sourceHandle: edge.sourceHandle,
    }
  }
}
