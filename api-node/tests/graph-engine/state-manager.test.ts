/**
 * Tests for GraphStateManager node/edge state transitions.
 */

import { describe, expect, it } from 'vitest'
import { GraphStateManager } from '../../src/graph-engine/state-manager.js'
import { Graph, Node } from '../../src/graph-engine/graph.js'
import type { GraphDict, NodeConfigDict, NodeFactory } from '../../src/graph-engine/graph.js'
import { NodeState } from '../../src/graph-engine/types.js'
import type { GraphNodeEvent } from '../../src/graph-engine/events.js'

// ── Mock node ──────────────────────────────────────────────────────────────

class MockNode extends Node {
  constructor(config: NodeConfigDict) { super(config) }
  async *run(): AsyncGenerator<GraphNodeEvent> { /* no-op */ }
}

const factory: NodeFactory = {
  createNode(c: NodeConfigDict) { return new MockNode(c) },
}

function nc(id: string): NodeConfigDict {
  return { id, type: 'code', data: { title: id, type: 'code' } }
}

function buildGraph(): Graph {
  return Graph.fromDict(
    {
      nodes: [nc('a'), nc('b'), nc('c')],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
    },
    factory,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GraphStateManager', () => {
  describe('node operations', () => {
    it('enqueueNode sets node state to TAKEN and adds to queue', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      sm.enqueueNode('b')

      expect(graph.nodes.get('b')!.state).toBe(NodeState.TAKEN)
      expect(sm.getQueueDepth()).toBe(1)
    })

    it('dequeueNode returns nodes in FIFO order', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      sm.enqueueNode('b')
      sm.enqueueNode('c')

      expect(sm.dequeueNode()).toBe('b')
      expect(sm.dequeueNode()).toBe('c')
      expect(sm.dequeueNode()).toBeUndefined()
    })

    it('markNodeSkipped sets node state to SKIPPED', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      sm.markNodeSkipped('b')
      expect(graph.nodes.get('b')!.state).toBe(NodeState.SKIPPED)
    })

    it('isNodeReady returns true when no incoming edges', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      expect(sm.isNodeReady('a')).toBe(true)
    })

    it('isNodeReady returns false when incoming edges are UNKNOWN', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      expect(sm.isNodeReady('b')).toBe(false)
    })

    it('isNodeReady returns true when at least one incoming edge is TAKEN', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      // Mark the edge a->b as taken
      const edge = graph.getOutgoingEdges('a').find(e => e.head === 'b')!
      sm.markEdgeTaken(edge.id)

      expect(sm.isNodeReady('b')).toBe(true)
    })
  })

  describe('edge operations', () => {
    it('markEdgeTaken and markEdgeSkipped update edge state', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      const edge = graph.getOutgoingEdges('a')[0]!
      sm.markEdgeTaken(edge.id)
      expect(graph.edges.get(edge.id)!.state).toBe(NodeState.TAKEN)

      const edge2 = graph.getOutgoingEdges('a')[1]!
      sm.markEdgeSkipped(edge2.id)
      expect(graph.edges.get(edge2.id)!.state).toBe(NodeState.SKIPPED)
    })

    it('analyzeEdgeStates returns correct flags', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      const edges = graph.getOutgoingEdges('a')

      // All unknown
      expect(sm.analyzeEdgeStates(edges)).toEqual({
        hasUnknown: true,
        hasTaken: false,
        allSkipped: false,
      })

      // Mark one taken
      sm.markEdgeTaken(edges[0]!.id)
      expect(sm.analyzeEdgeStates(edges)).toEqual({
        hasUnknown: true,
        hasTaken: true,
        allSkipped: false,
      })

      // Mark the other skipped
      sm.markEdgeSkipped(edges[1]!.id)
      expect(sm.analyzeEdgeStates(edges)).toEqual({
        hasUnknown: false,
        hasTaken: true,
        allSkipped: false,
      })
    })
  })

  describe('execution tracking', () => {
    it('startExecution and finishExecution track active nodes', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      sm.startExecution('a')
      sm.startExecution('b')
      expect(sm.getExecutingCount()).toBe(2)

      sm.finishExecution('a')
      expect(sm.getExecutingCount()).toBe(1)
    })

    it('isExecutionComplete when queue empty and no executing nodes', () => {
      const graph = buildGraph()
      const sm = new GraphStateManager(graph)

      expect(sm.isExecutionComplete()).toBe(true)

      sm.enqueueNode('a')
      expect(sm.isExecutionComplete()).toBe(false)

      sm.dequeueNode()
      sm.startExecution('a')
      expect(sm.isExecutionComplete()).toBe(false)

      sm.finishExecution('a')
      expect(sm.isExecutionComplete()).toBe(true)
    })
  })
})
