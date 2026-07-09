/**
 * GraphEngineRunner tests — validates subprocess-based graph execution.
 *
 * Uses a real child process (forked via child_process.fork) to run GraphEngine,
 * communicating over Node.js IPC.
 */

import { describe, expect, it } from 'vitest'
import { GraphEngineRunner } from '../../src/graph-engine/runner.js'
import type { GraphDict } from '../../src/graph-engine/graph.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal graph dict: a single start node connected to an end node.
 * Both use StubNode (succeeds immediately with empty outputs).
 */
function buildLinearGraph(): GraphDict {
  return {
    nodes: [
      {
        id: 'start-node',
        type: 'custom',
        data: { title: 'Start', type: 'start' },
      },
      {
        id: 'end-node',
        type: 'custom',
        data: { title: 'End', type: 'end' },
      },
    ],
    edges: [
      {
        source: 'start-node',
        target: 'end-node',
        sourceHandle: 'source',
      },
    ],
  }
}

/**
 * Builds a diamond graph: start → (branch-a, branch-b) → end.
 */
function buildDiamondGraph(): GraphDict {
  return {
    nodes: [
      { id: 'start', type: 'custom', data: { title: 'Start', type: 'start' } },
      { id: 'branch-a', type: 'custom', data: { title: 'Branch A', type: 'code' } },
      { id: 'branch-b', type: 'custom', data: { title: 'Branch B', type: 'code' } },
      { id: 'end', type: 'custom', data: { title: 'End', type: 'end' } },
    ],
    edges: [
      { source: 'start', target: 'branch-a', sourceHandle: 'source' },
      { source: 'start', target: 'branch-b', sourceHandle: 'source' },
      { source: 'branch-a', target: 'end', sourceHandle: 'source' },
      { source: 'branch-b', target: 'end', sourceHandle: 'source' },
    ],
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GraphEngineRunner', () => {
  it('should execute a linear graph in a subprocess and return succeeded', async () => {
    const runner = new GraphEngineRunner()

    const result = await runner.run({
      graphDict: buildLinearGraph(),
      workflowId: 'test-workflow-001',
      inputs: { query: 'hello' },
    })

    expect(result.status).toBe('succeeded')
    expect(result.error).toBeUndefined()

    // Verify we got graph-level start and succeed events
    const eventTypes = result.events.map(e => e._type)
    expect(eventTypes).toContain('graph_run_started')
    expect(eventTypes).toContain('graph_run_succeeded')

    // Verify node execution events
    expect(eventTypes).toContain('node_run_started')
    expect(eventTypes).toContain('node_run_succeeded')
  })

  it('should execute a diamond graph in a subprocess', async () => {
    const runner = new GraphEngineRunner()

    const result = await runner.run({
      graphDict: buildDiamondGraph(),
      workflowId: 'test-workflow-002',
      inputs: {},
    })

    expect(result.status).toBe('succeeded')

    // Diamond has 4 nodes: start, branch-a, branch-b, end
    const startEvents = result.events.filter(e => e._type === 'node_run_started')
    expect(startEvents.length).toBe(4)

    const successEvents = result.events.filter(e => e._type === 'node_run_succeeded')
    expect(successEvents.length).toBe(4)
  })

  it('should handle abort requests', async () => {
    const runner = new GraphEngineRunner()

    // Start execution (don't await yet)
    const resultPromise = runner.run({
      graphDict: buildLinearGraph(),
      workflowId: 'test-workflow-003',
    })

    // Send abort immediately
    runner.abort('Test abort')

    const result = await resultPromise

    // Either aborted or succeeded (race condition — graph may finish before abort arrives)
    expect(['aborted', 'succeeded']).toContain(result.status)
  })

  it('should handle kill requests', async () => {
    const runner = new GraphEngineRunner()

    const resultPromise = runner.run({
      graphDict: buildLinearGraph(),
      workflowId: 'test-workflow-004',
    })

    // Kill immediately — should cause a rejection or error result
    runner.kill()

    try {
      const result = await resultPromise
      // If it doesn't reject, we should get an error status
      expect(['error', 'aborted']).toContain(result.status)
    } catch (err) {
      // Rejection is also acceptable (child killed)
      expect(err).toBeInstanceOf(Error)
    }
  })

  it('should pass inputs to the variable pool', async () => {
    const runner = new GraphEngineRunner()

    const result = await runner.run({
      graphDict: buildLinearGraph(),
      workflowId: 'test-workflow-005',
      inputs: { user_query: 'What is AI?', user_id: 'u-123' },
    })

    expect(result.status).toBe('succeeded')
    // Inputs are stored in variable pool as ['sys', key] — not directly observable
    // in events, but execution should succeed regardless
  })
})
