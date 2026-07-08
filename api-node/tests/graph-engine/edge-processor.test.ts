/**
 * Tests for EdgeProcessor — branch selection and skip propagation.
 */

import { describe, expect, it } from 'vitest'
import { EdgeProcessor } from '../../src/graph-engine/edge-processor.js'
import { GraphStateManager } from '../../src/graph-engine/state-manager.js'
import { Graph, Node } from '../../src/graph-engine/graph.js'
import type { NodeConfigDict, NodeFactory } from '../../src/graph-engine/graph.js'
import { NodeExecutionType, NodeState } from '../../src/graph-engine/types.js'
import type { GraphNodeEvent } from '../../src/graph-engine/events.js'

// ── Mock node ──────────────────────────────────────────────────────────────

class MockNode extends Node {
  constructor(config: NodeConfigDict) { super(config) }
  async *run(): AsyncGenerator<GraphNodeEvent> { /* no-op */ }
}

const factory: NodeFactory = {
  createNode(c: NodeConfigDict) { return new MockNode(c) },
}

function nc(id: string, type = 'code'): NodeConfigDict {
  return { id, type, data: { title: id, type } }
}

// ── Linear graph: A -> B -> C ──────────────────────────────────────────────

function buildLinear(): { graph: Graph; sm: GraphStateManager; ep: EdgeProcessor } {
  const graph = Graph.fromDict(
    {
      nodes: [nc('a', 'start'), nc('b'), nc('c', 'end')],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    },
    factory,
  )
  const sm = new GraphStateManager(graph)
  const ep = new EdgeProcessor(graph, sm)
  return { graph, sm, ep }
}

// ── Branch graph: A -> (B | C) via if-else handles ────────────────────────

function buildBranch(): { graph: Graph; sm: GraphStateManager; ep: EdgeProcessor } {
  const graph = Graph.fromDict(
    {
      nodes: [
        nc('a', 'if-else'),
        nc('b', 'end'),
        nc('c', 'end'),
      ],
      edges: [
        { source: 'a', target: 'b', sourceHandle: 'true' },
        { source: 'a', target: 'c', sourceHandle: 'false' },
      ],
    },
    factory,
  )
  // Mark A as branch type
  graph.nodes.get('a')!.executionType = NodeExecutionType.BRANCH

  const sm = new GraphStateManager(graph)
  const ep = new EdgeProcessor(graph, sm)
  return { graph, sm, ep }
}

// ── Diamond graph: A -> B, A -> C, B -> D, C -> D ────────────────────────

function buildDiamond(): { graph: Graph; sm: GraphStateManager; ep: EdgeProcessor } {
  const graph = Graph.fromDict(
    {
      nodes: [nc('a', 'start'), nc('b'), nc('c'), nc('d', 'end')],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
        { source: 'b', target: 'd' },
        { source: 'c', target: 'd' },
      ],
    },
    factory,
  )
  const sm = new GraphStateManager(graph)
  const ep = new EdgeProcessor(graph, sm)
  return { graph, sm, ep }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('EdgeProcessor', () => {
  describe('linear graph', () => {
    it('processes node success and enqueues downstream', () => {
      const { sm, ep } = buildLinear()

      const { readyNodes, events } = ep.processNodeSuccess('a')

      expect(readyNodes).toEqual(['b'])
      expect(events.length).toBe(1)
      expect(events[0]!._type).toBe('graph_edge_taken')
    })

    it('chain: a -> b -> c', () => {
      const { sm, ep } = buildLinear()

      // Process a
      const r1 = ep.processNodeSuccess('a')
      expect(r1.readyNodes).toEqual(['b'])

      // Process b
      const r2 = ep.processNodeSuccess('b')
      expect(r2.readyNodes).toEqual(['c'])
    })
  })

  describe('branch graph', () => {
    it('selects true branch and skips false branch', () => {
      const { graph, sm, ep } = buildBranch()

      const { readyNodes, events } = ep.processNodeSuccess('a', 'true')

      // B should be ready (true branch taken)
      expect(readyNodes).toEqual(['b'])

      // Should have skip event for false branch + taken event for true branch
      const skipEvents = events.filter(e => e._type === 'graph_edge_skipped')
      const takenEvents = events.filter(e => e._type === 'graph_edge_taken')
      expect(skipEvents.length).toBe(1)
      expect(takenEvents.length).toBe(1)

      // C should be skipped
      expect(graph.nodes.get('c')!.state).toBe(NodeState.SKIPPED)
    })

    it('selects false branch and skips true branch', () => {
      const { graph, sm, ep } = buildBranch()

      const { readyNodes, events } = ep.processNodeSuccess('a', 'false')

      expect(readyNodes).toEqual(['c'])
      expect(graph.nodes.get('b')!.state).toBe(NodeState.SKIPPED)
    })

    it('throws when no branch selected', () => {
      const { ep } = buildBranch()
      expect(() => ep.processNodeSuccess('a', null)).toThrow()
    })
  })

  describe('diamond graph — skip propagation', () => {
    it('both branches taken → D is ready', () => {
      const { ep } = buildDiamond()

      // A -> B, C (both taken)
      const r1 = ep.processNodeSuccess('a')
      expect(r1.readyNodes).toEqual(expect.arrayContaining(['b', 'c']))

      // B -> D
      const r2 = ep.processNodeSuccess('b')
      // D not ready yet because C's edge is still UNKNOWN
      expect(r2.readyNodes).toEqual([])

      // C -> D
      const r3 = ep.processNodeSuccess('c')
      expect(r3.readyNodes).toEqual(['d'])
    })
  })
})
