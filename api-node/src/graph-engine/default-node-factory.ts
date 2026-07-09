/**
 * Default NodeFactory — provides stub node implementations for GraphEngine.
 *
 * Stub nodes execute successfully with empty outputs, serving as placeholders
 * until real node type implementations (llm, code, http-request, etc.) are added.
 */

import { Node } from './graph.js'
import type { NodeConfigDict, NodeFactory } from './graph.js'
import type { GraphNodeEvent } from './events.js'
import { defaultNodeRunResult } from './events.js'
import { WorkflowNodeExecutionStatus } from './types.js'

// ── Stub node (passthrough — succeeds immediately) ──────────────────────────

export class StubNode extends Node {
  constructor(config: NodeConfigDict) {
    super(config)
  }

  async *run(): AsyncGenerator<GraphNodeEvent> {
    const now = new Date()
    yield {
      _type: 'node_run_started',
      id: this._executionId!,
      nodeId: this.id,
      nodeType: this.nodeType,
      nodeTitle: this.title,
      startAt: now,
      nodeRunResult: defaultNodeRunResult(),
    }

    yield {
      _type: 'node_run_succeeded',
      id: this._executionId!,
      nodeId: this.id,
      nodeType: this.nodeType,
      startAt: now,
      finishedAt: new Date(),
      nodeRunResult: {
        status: WorkflowNodeExecutionStatus.SUCCEEDED,
        outputs: {},
        edgeSourceHandle: 'source',
      },
    }
  }
}

// ── Default factory ─────────────────────────────────────────────────────────

export class DefaultNodeFactory implements NodeFactory {
  createNode(config: NodeConfigDict): Node {
    // All node types currently use the stub implementation.
    // Real implementations (llm, code, http-request, etc.) will be registered here.
    return new StubNode(config)
  }
}
