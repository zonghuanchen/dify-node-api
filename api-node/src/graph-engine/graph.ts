/**
 * Graph data structures: Edge, Node (abstract), Graph.
 * Ported from graphon/graph/edge.py and graphon/graph/graph.py.
 */

import { v4 as uuidv4 } from 'uuid'
import type { GraphNodeEvent } from './events.js'
import {
  ErrorStrategy,
  NodeExecutionType,
  type NodeType,
  NodeState,
} from './types.js'

// ── Edge ───────────────────────────────────────────────────────────────────

export interface Edge {
  id: string
  tail: string   // source node id
  head: string   // target node id
  sourceHandle: string
  state: NodeState
}

// ── Node config (from graph_dict JSON) ─────────────────────────────────────

export interface NodeConfigDict {
  id: string
  type: string
  data: {
    title?: string
    type?: string
    desc?: string
    error_strategy?: string
    retry_config?: {
      max_retries?: number
      retry_interval_seconds?: number
    }
    default_value?: Array<{ key: string; value: unknown }>
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface EdgeConfigDict {
  source?: string
  target?: string
  sourceHandle?: string
  [key: string]: unknown
}

export interface GraphDict {
  nodes: NodeConfigDict[]
  edges: EdgeConfigDict[]
}

// ── Retry config ───────────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number
  retryIntervalSeconds: number
}

// ── Abstract Node ──────────────────────────────────────────────────────────

export abstract class Node {
  readonly id: string
  readonly title: string
  readonly nodeType: NodeType
  readonly rawData: NodeConfigDict['data']

  executionType: NodeExecutionType
  errorStrategy: ErrorStrategy | null
  state: NodeState
  retry: boolean
  retryConfig: RetryConfig
  defaultValueDict: Record<string, unknown>

  protected _executionId: string | null = null

  constructor(config: NodeConfigDict) {
    this.id = config.id
    this.title = config.data.title ?? config.id
    this.nodeType = (config.data.type ?? config.type) as NodeType
    this.rawData = config.data

    // Execution type defaults to NORMAL; ROOT is set by Graph builder
    this.executionType = NodeExecutionType.NORMAL
    this.state = NodeState.UNKNOWN

    // Error strategy
    const strategy = config.data.error_strategy
    this.errorStrategy = strategy === 'fail-branch'
      ? ErrorStrategy.FAIL_BRANCH
      : strategy === 'default-value'
        ? ErrorStrategy.DEFAULT_VALUE
        : null

    // Retry config
    const rc = config.data.retry_config
    this.retryConfig = {
      maxRetries: rc?.max_retries ?? 0,
      retryIntervalSeconds: rc?.retry_interval_seconds ?? 0,
    }
    this.retry = this.retryConfig.maxRetries > 0

    // Default values
    this.defaultValueDict = {}
    if (Array.isArray(config.data.default_value)) {
      for (const item of config.data.default_value) {
        if (item.key) {
          this.defaultValueDict[item.key] = item.value
        }
      }
    }
  }

  /**
   * Execute the node. Implementations yield events as they progress.
   */
  abstract run(): AsyncGenerator<GraphNodeEvent>

  /** Assign a unique execution ID if not already set. */
  ensureExecutionId(): void {
    if (!this._executionId) {
      this._executionId = uuidv4()
    }
  }

  get executionId(): string | null {
    return this._executionId
  }

  /** Reset execution ID for retry scenarios. */
  resetExecutionId(): void {
    this._executionId = null
  }
}

// ── Node factory ───────────────────────────────────────────────────────────

export interface NodeFactory {
  createNode(config: NodeConfigDict): Node
}

// ── Graph ──────────────────────────────────────────────────────────────────

export class Graph {
  readonly nodes: Map<string, Node>
  readonly edges: Map<string, Edge>
  readonly inEdges: Map<string, string[]>
  readonly outEdges: Map<string, string[]>
  readonly rootNode: Node

  constructor(opts: {
    nodes: Map<string, Node>
    edges: Map<string, Edge>
    inEdges: Map<string, string[]>
    outEdges: Map<string, string[]>
    rootNode: Node
  }) {
    this.nodes = opts.nodes
    this.edges = opts.edges
    this.inEdges = opts.inEdges
    this.outEdges = opts.outEdges
    this.rootNode = opts.rootNode
  }

  /**
   * Parse a workflow graph_dict JSON into a Graph instance.
   */
  static fromDict(
    graphDict: GraphDict,
    nodeFactory: NodeFactory,
    rootNodeId?: string,
  ): Graph {
    // Filter out canvas-only nodes (e.g. custom-note)
    const nodeConfigs = graphDict.nodes.filter(
      n => n.type !== 'custom-note',
    )

    // Build node config map
    const configMap = new Map<string, NodeConfigDict>()
    for (const nc of nodeConfigs) {
      configMap.set(nc.id, nc)
    }

    // Build edges
    const edges = new Map<string, Edge>()
    const inEdges = new Map<string, string[]>()
    const outEdges = new Map<string, string[]>()
    let edgeCounter = 0

    for (const ec of (graphDict.edges ?? [])) {
      const source = ec.source
      const target = ec.target
      if (typeof source !== 'string' || typeof target !== 'string') continue

      const edgeId = `edge_${edgeCounter++}`
      const sourceHandle = typeof ec.sourceHandle === 'string' ? ec.sourceHandle : 'source'

      edges.set(edgeId, {
        id: edgeId,
        tail: source,
        head: target,
        sourceHandle,
        state: NodeState.UNKNOWN,
      })

      if (!outEdges.has(source)) outEdges.set(source, [])
      outEdges.get(source)!.push(edgeId)

      if (!inEdges.has(target)) inEdges.set(target, [])
      inEdges.get(target)!.push(edgeId)
    }

    // Create node instances
    const nodes = new Map<string, Node>()
    for (const [nodeId, nc] of configMap) {
      const node = nodeFactory.createNode(nc)
      nodes.set(nodeId, node)
    }

    // Promote fail-branch nodes to BRANCH execution type
    for (const node of nodes.values()) {
      if (node.errorStrategy === ErrorStrategy.FAIL_BRANCH) {
        node.executionType = NodeExecutionType.BRANCH
      }
    }

    // Determine root node
    let rootNode: Node | undefined
    if (rootNodeId) {
      rootNode = nodes.get(rootNodeId)
    }
    if (!rootNode) {
      // Find start node or first node with no incoming edges
      for (const node of nodes.values()) {
        if (node.nodeType === 'start') {
          rootNode = node
          break
        }
      }
      if (!rootNode) {
        // Pick first node with no incoming edges
        for (const node of nodes.values()) {
          const incoming = inEdges.get(node.id)
          if (!incoming || incoming.length === 0) {
            rootNode = node
            break
          }
        }
      }
    }
    if (!rootNode) {
      throw new Error('Could not determine root node for graph')
    }

    // Mark root node execution type
    rootNode.executionType = NodeExecutionType.ROOT

    return new Graph({ nodes, edges, inEdges, outEdges, rootNode })
  }

  getOutgoingEdges(nodeId: string): Edge[] {
    const edgeIds = this.outEdges.get(nodeId) ?? []
    return edgeIds
      .map(id => this.edges.get(id))
      .filter((e): e is Edge => e !== undefined)
  }

  getIncomingEdges(nodeId: string): Edge[] {
    const edgeIds = this.inEdges.get(nodeId) ?? []
    return edgeIds
      .map(id => this.edges.get(id))
      .filter((e): e is Edge => e !== undefined)
  }

  get nodeIds(): string[] {
    return [...this.nodes.keys()]
  }
}
