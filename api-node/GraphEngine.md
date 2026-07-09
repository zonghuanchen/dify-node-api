# GraphEngine 执行逻辑

> 来源：`graphon==0.6.0` PyPI 包，解压至 `graphon_src/graphon/graph_engine/`

---

## 架构概览

GraphEngine 采用 DDD 风格，将职责拆分为多个子系统：

```
graph_engine/
├── graph_engine.py              # 主编排器（入口）
├── worker.py                    # Worker 线程（执行节点）
├── graph_state_manager.py       # 节点状态管理
├── worker_management/
│   └── worker_pool.py           # Worker 线程池管理
├── orchestration/
│   ├── dispatcher.py            # 事件分发器
│   └── execution_coordinator.py # 执行协调器
├── event_management/
│   ├── event_manager.py         # 事件收集与发射
│   └── event_handlers.py        # 事件处理器注册
├── graph_traversal/
│   ├── edge_processor.py        # 边处理（决定下游节点）
│   └── skip_propagator.py       # 跳过状态传播
├── command_processing/          # 命令处理（abort / pause / update_variables）
├── layers/                      # 扩展层（hook 机制）
└── ready_queue/                 # 就绪队列（待执行节点 ID）
```

---

## 核心执行流程

```
GraphEngine.run()
  └─ _GraphRunLifecycle.run()
       │
       ├─ 1. initialize_layers()
       │     └─ layer.on_graph_start()          # 通知所有扩展层图开始
       │
       ├─ 2. start_execution(resume=False)
       │     ├─ worker_pool.start()             # 启动 Worker 线程池
       │     ├─ enqueue_node(root_node)         # 根节点入队 ready_queue
       │     └─ dispatcher.start()              # 启动事件分发线程
       │
       ├─ 3. event_manager.emit_events()        # 主线程消费事件流（Generator）
       │     └─ Dispatcher 从 event_queue 取事件
       │        └─ EventHandler 处理节点事件
       │           └─ EdgeProcessor 计算下游节点
       │              └─ state_manager.enqueue_node()  # 下游入队
       │
       └─ 4. emit_terminal_events()             # 发射终态事件
             ├─ GraphRunPausedEvent             # 暂停（HITL）
             ├─ GraphRunAbortedEvent            # 中止（用户命令）
             ├─ GraphRunPartialSucceededEvent   # 部分成功（有异常但继续）
             └─ GraphRunSucceededEvent          # 完全成功
```

---

## Worker 节点执行

Worker 是继承 `threading.Thread` 的守护线程，从就绪队列拉取节点并执行：

```python
# worker.py — Worker.run()
while not self._stop_event.is_set():
    node_id = ready_queue.get(timeout=0.1)   # 阻塞等待节点
    node = graph.nodes[node_id]
    _execute_node(node)

def _execute_node(node: Node):
    # 1. Layer hook: 节点开始
    for layer in layers:
        layer.on_node_run_start(node)

    # 2. 执行节点（节点自己的 run() 是 Generator）
    for event in node.run():
        event_queue.put(event)               # 事件推入队列
        # 事件类型：NodeRunStartedEvent / NodeRunStreamEvent / NodeRunSucceededEvent / ...

    # 3. Layer hook: 节点结束
    for layer in layers:
        layer.on_node_run_end(node, error, result_event)
```

**关键点**：`node.run()` 是一个 Generator，每次 yield 一个事件（流式输出），Worker 将每个事件推入 `event_queue`，由 Dispatcher 在主线程处理。

---

## 组件职责详解

### GraphEngine（主编排器）

| 方法 | 作用 |
|---|---|
| `__init__()` | 初始化所有子系统，绑定 Graph + RuntimeState |
| `layer(layer)` | 注册扩展层（类似中间件） |
| `run()` | 返回事件 Generator，驱动整个生命周期 |
| `request_abort()` | 通过 CommandChannel 发送中止命令 |
| `create_child_engine()` | 创建子引擎（用于子工作流） |

### Dispatcher（事件分发器）

- 独立线程，持续从 `event_queue` 取事件
- 调用 `EventHandler` 处理节点事件
- 调用 `CommandProcessor` 处理外部命令
- 判断执行是否结束（所有节点完成 / 中止 / 暂停）

### EdgeProcessor（边处理器）

节点执行完成后，根据输出 + 边条件决定下游节点：

```
NodeRunSucceededEvent
  └─ EdgeProcessor.process(node_id, outputs)
       ├─ 遍历下游边（edges）
       ├─ 评估条件分支（if/else）
       ├─ SkipPropagator：不满足条件的分支 → 标记 skip
       └─ state_manager.enqueue_node(next_node_id)  # 满足条件的入队
```

### CommandProcessor（命令处理器）

通过 `CommandChannel`（内存 / Redis）接收外部命令：

| 命令 | Handler | 效果 |
|---|---|---|
| `AbortCommand` | `AbortCommandHandler` | 设置 `graph_execution.aborted = True`，停止 Worker |
| `PauseCommand` | `PauseCommandHandler` | 设置 `graph_execution.is_paused = True`（用于 HITL） |
| `UpdateVariablesCommand` | `UpdateVariablesCommandHandler` | 更新 `VariablePool` 中的变量 |

### Layer（扩展层）

类似中间件的 hook 机制，Dify 通过 Layer 实现：

- `PauseStatePersistenceLayer`：持久化暂停状态（HITL 恢复用）
- `TriggerPostLayer`：触发后置动作（异步触发工作流）
- `DebugLoggingLayer`：调试日志

```python
class GraphEngineLayer:
    def initialize(self, runtime_state, command_channel): ...
    def on_graph_start(self): ...
    def on_node_run_start(self, node): ...
    def on_node_run_end(self, node, error, result_event): ...
    def on_graph_end(self, error): ...
```

---

## 与 Dify API 的集成

在 `api/core/app/apps/workflow/app_generator.py` 的 `_generate_worker()` 中：

```python
# 1. 构建 GraphEngine
engine = GraphEngine(
    workflow_id=workflow.id,
    graph=Graph.from_dict(workflow.graph_dict),
    graph_runtime_state=graph_runtime_state,
    command_channel=InMemoryCommandChannel(),  # 或 RedisCommandChannel
)

# 2. 注册 Dify 自定义 Layer
engine.layer(PauseStatePersistenceLayer(...))
engine.layer(TriggerPostLayer(...))

# 3. 执行并消费事件流
for event in engine.run():
    queue_manager.put(event)   # 事件推入 Flask QueueManager

# 4. Flask 响应层从 QueueManager 消费事件
#    - blocking 模式：等待所有事件，组装完整响应
#    - streaming 模式：逐事件 SSE 推送给客户端
```

---

## 数据流向

```
HTTP 请求
  → WorkflowAppGenerator.generate()
    → _generate_worker() [新线程]
      → GraphEngine.run() [Generator]
        → Worker.run() [Worker 线程]
          → node.run() [节点自己的 Generator]
            → yield NodeRunStartedEvent
            → yield NodeRunStreamEvent (流式)
            → yield NodeRunSucceededEvent
        → Dispatcher [分发线程]
          → EventHandler.process()
            → EdgeProcessor.process()
              → enqueue_node(下游节点)
        → emit_events() [主线程 yield]
      → queue_manager.put(event)
    → _handle_response()
      → WorkflowAppGenerateTaskPipeline
        → 消费 queue 事件
        → 生成 HTTP 响应 / SSE 流
```

---

## 关键数据结构

| 结构 | 说明 |
|---|---|
| `Graph` | 节点 + 边的有向图，从 `workflow.graph_dict` 反序列化 |
| `GraphRuntimeState` | 运行时状态：变量池、执行状态、子引擎构建器 |
| `GraphExecution` | 执行状态跟踪：started / paused / aborted / error |
| `VariablePool` | 节点间共享变量池，节点通过 key 读写 |
| `ReadyQueue` | 待执行节点 ID 队列（内存实现） |
| `CommandChannel` | 命令通道（内存 / Redis），用于外部控制 |

---

## Node.js 最小化实现计划

> 以下为 GraphEngine 移植到 Node.js 的实现计划，采用单线程异步事件循环架构。

### 架构

单线程异步事件循环。无 Worker 线程，无独立分发器。节点通过 `for await` 遍历 `AsyncGenerator` 顺序执行，引擎在每个节点完成后内联处理边。

```
src/graph-engine/
├── types.ts                  # 枚举: NodeState, NodeExecutionType, NodeType, ErrorStrategy
├── events.ts                 # 事件类型层次 (graph, node, traversal events)
├── graph.ts                  # Edge, Node (abstract), Graph (with fromDict)
├── variable-pool.ts          # 简单 key-value 存储，用于节点输出
├── graph-execution.ts        # 执行状态跟踪 (started/paused/aborted/error)
├── state-manager.ts          # 节点/边状态 + 执行跟踪
├── edge-processor.ts         # 边处理 + 跳过传播 (合并)
├── graph-engine.ts           # 主编排器: run() 返回 AsyncGenerator<GraphEngineEvent>
└── index.ts                  # Barrel export
```

### Task 1: 定义枚举和事件类型 (`types.ts`, `events.ts`)

**`types.ts`** — 移植 Python 枚举：
- `NodeState`: `UNKNOWN`, `TAKEN`, `SKIPPED`
- `NodeExecutionType`: `ROOT`, `BRANCH`, `RESPONSE`, `NORMAL`
- `NodeType`: 所有 Dify 节点类型的字符串联合 (`start`, `llm`, `code`, `if-else`, `end` 等)
- `ErrorStrategy`: `FAIL_BRANCH`, `DEFAULT_VALUE`
- `WorkflowNodeExecutionStatus`: `RUNNING`, `SUCCEEDED`, `FAILED`, `EXCEPTION`

**`events.ts`** — 移植事件层次为可区分联合类型：
- `GraphEngineEvent` (基类，`_type` 区分)
- 图事件: `GraphRunStartedEvent`, `GraphRunSucceededEvent`, `GraphRunFailedEvent`, `GraphRunAbortedEvent`, `GraphRunPartialSucceededEvent`
- 节点事件: `NodeRunStartedEvent`, `NodeRunSucceededEvent`, `NodeRunFailedEvent`, `NodeRunStreamChunkEvent`, `NodeRunExceptionEvent`, `NodeRunRetryEvent`
- 遍历事件: `GraphEdgeTakenEvent`, `GraphEdgeSkippedEvent`

### Task 2: 定义图数据结构 (`graph.ts`)

从 `graphon/graph/edge.py` 和 `graphon/graph/graph.py` 移植：

- **`Edge`**: `{ id, tail, head, sourceHandle, state }` (state = NodeState)
- **`Node`** (抽象类/接口):
  - 属性: `id`, `title`, `nodeType`, `executionType`, `errorStrategy`, `state`, `retryConfig`, `defaultValueDict`
  - 方法: `run(): AsyncGenerator<GraphNodeEvent>` — 节点执行逻辑
  - 方法: `ensureExecutionId()` — 分配唯一执行 ID
- **`Graph`**:
  - 属性: `nodes: Map<string, Node>`, `edges: Map<string, Edge>`, `inEdges`, `outEdges`, `rootNode`
  - `static fromDict(graphDict, nodeFactory)` — 从 Python `workflow.graph_dict` JSON 格式解析
  - `getOutgoingEdges(nodeId)`, `getIncomingEdges(nodeId)`
- **`NodeFactory`** 接口: `createNode(config): Node`

### Task 3: 实现 VariablePool 和 GraphExecution (`variable-pool.ts`, `graph-execution.ts`)

**`variable-pool.ts`** — 简单变量存储：
- `set(selector: string[], value: unknown)` — 按选择器元组存储
- `get(selector: string[]): unknown`
- `add(selector: string[], value: unknown)` — set 的别名

**`graph-execution.ts`** — 执行状态聚合：
- 属性: `workflowId`, `started`, `completed`, `aborted`, `paused`, `error`, `exceptionsCount`, `nodeExecutions`
- 方法: `start()`, `complete()`, `abort(reason)`, `fail(error)`, `recordNodeFailure()`, `getOrCreateNodeExecution(nodeId)`
- `NodeExecution`: `{ state, retryCount, executionId, markStarted(), markTaken(), markFailed(), incrementRetry() }`

### Task 4: 实现 StateManager 和 EdgeProcessor (`state-manager.ts`, `edge-processor.ts`)

**`state-manager.ts`** — 从 `graph_state_manager.py` 移植：
- 节点操作: `enqueueNode(nodeId)`, `markNodeSkipped(nodeId)`, `isNodeReady(nodeId)`
- 边操作: `markEdgeTaken(edgeId)`, `markEdgeSkipped(edgeId)`, `analyzeEdgeStates(edges)`, `categorizeBranchEdges(nodeId, selectedHandle)`
- 执行跟踪: `startExecution(nodeId)`, `finishExecution(nodeId)`, `isExecutionComplete()`
- 就绪队列: 简单 `string[]` 数组（无需多线程）

**`edge-processor.ts`** — 从 `edge_processor.py` + `skip_propagator.py` 合并移植：
- `processNodeSuccess(nodeId, selectedHandle?)` -> `{ readyNodes, events }`
- 分支处理: 将边分类为已选择/未选择，跳过未选择路径
- 跳过传播: 当所有入边都被跳过时，递归标记下游为跳过

### Task 5: 实现 GraphEngine 编排器 (`graph-engine.ts`)

从 `graph_engine.py` 移植核心生命周期，简化为单线程异步：

```typescript
class GraphEngine {
  constructor(opts: {
    workflowId: string
    graph: Graph
    variablePool: VariablePool
    nodeFactory: NodeFactory
  })

  async *run(): AsyncGenerator<GraphEngineEvent> {
    // 1. Yield GraphRunStartedEvent
    // 2. 根节点入队
    // 3. While 就绪队列有节点:
    //    a. 出队下一个节点
    //    b. for await (event of node.run()):
    //       - yield event
    //    c. NodeRunSucceeded 时: 处理边，入队下游
    //    d. NodeRunFailed 时: 应用错误策略 (retry/fail-branch/default-value/abort)
    // 4. Yield 终态事件 (Succeeded/Failed/Aborted/PartialSucceeded)
  }

  requestAbort(reason?: string): void  // 设置中止标志
}
```

相比 Python 的关键简化：
- 无 Worker 池 — 节点在 `run()` 循环中顺序执行
- 无分发线程 — 边处理在每个节点完成后内联执行
- 无命令通道 — 中止是一个简单方法调用
- 无 Layers — 可后续作为 hook 添加

### Task 6: Barrel export 和单元测试 (`index.ts`, tests)

- 创建 `index.ts` barrel export
- 在 `api-node/tests/graph-engine/` 编写基础单元测试：
  - `graph.test.ts` — Graph.fromDict 解析
  - `state-manager.test.ts` — 节点/边状态转换
  - `edge-processor.test.ts` — 分支选择、跳过传播
  - `graph-engine.test.ts` — 端到端：构建简单图 + mock 节点，运行引擎，验证事件序列

### Task 7: 验证 type-check 和 lint

- 在 `api-node/` 运行 `pnpm type-check` 和 `pnpm lint` 确保无错误
