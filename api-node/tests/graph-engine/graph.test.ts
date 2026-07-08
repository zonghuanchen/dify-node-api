/**
 * Tests for Graph.fromDict parsing.
 */

import { describe, expect, it } from 'vitest'
import { Graph } from '../../src/graph-engine/graph.js'
import type { GraphDict, NodeConfigDict, NodeFactory } from '../../src/graph-engine/graph.js'
import { Node } from '../../src/graph-engine/graph.js'
import { NodeState, NodeExecutionType } from '../../src/graph-engine/types.js'
import type { GraphNodeEvent } from '../../src/graph-engine/events.js'

// ── Mock node ──────────────────────────────────────────────────────────────

class MockNode extends Node {
  constructor(config: NodeConfigDict) {
    super(config)
  }

  async *run(): AsyncGenerator<GraphNodeEvent> {
    // no-op
  }
}

const mockFactory: NodeFactory = {
  createNode(config: NodeConfigDict) {
    return new MockNode(config)
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeNodeConfig(id: string, type = 'code'): NodeConfigDict {
  return { id, type, data: { title: `Node ${id}`, type } }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Graph.fromDict', () => {
  it('should parse a simple linear graph', () => {
    const dict: GraphDict = {
      nodes: [
        makeNodeConfig('start', 'start'),
        makeNodeConfig('code1', 'code'),
        makeNodeConfig('end', 'end'),
      ],
      edges: [
        { source: 'start', target: 'code1' },
        { source: 'code1', target: 'end' },
      ],
    }

    const graph = Graph.fromDict(dict, mockFactory)

    expect(graph.nodes.size).toBe(3)
    expect(graph.edges.size).toBe(2)
    expect(graph.rootNode.id).toBe('start')
    expect(graph.rootNode.executionType).toBe(NodeExecutionType.ROOT)
  })

  it('should build in/out edge indices', () => {
    const dict: GraphDict = {
      nodes: [makeNodeConfig('a'), makeNodeConfig('b'), makeNodeConfig('c')],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
    }

    const graph = Graph.fromDict(dict, mockFactory)

    expect(graph.getOutgoingEdges('a').length).toBe(2)
    expect(graph.getIncomingEdges('b').length).toBe(1)
    expect(graph.getIncomingEdges('c').length).toBe(1)
  })

  it('should set edge states to UNKNOWN initially', () => {
    const dict: GraphDict = {
      nodes: [makeNodeConfig('a'), makeNodeConfig('b')],
      edges: [{ source: 'a', target: 'b' }],
    }

    const graph = Graph.fromDict(dict, mockFactory)

    for (const edge of graph.edges.values()) {
      expect(edge.state).toBe(NodeState.UNKNOWN)
    }
  })

  it('should filter out custom-note nodes', () => {
    const dict: GraphDict = {
      nodes: [
        makeNodeConfig('start', 'start'),
        { id: 'note1', type: 'custom-note', data: {} },
      ],
      edges: [],
    }

    const graph = Graph.fromDict(dict, mockFactory)
    expect(graph.nodes.size).toBe(1)
    expect(graph.nodes.has('note1')).toBe(false)
  })

  it('should use provided rootNodeId', () => {
    const dict: GraphDict = {
      nodes: [
        makeNodeConfig('a'),
        makeNodeConfig('b'),
      ],
      edges: [{ source: 'a', target: 'b' }],
    }

    const graph = Graph.fromDict(dict, mockFactory, 'b')
    expect(graph.rootNode.id).toBe('b')
  })

  it('should throw if no root node can be determined', () => {
    // Empty graph
    expect(() => Graph.fromDict({ nodes: [], edges: [] }, mockFactory)).toThrow()
  })
})
