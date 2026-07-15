# Loro-CRDT 详细教程

## 一、什么是 CRDT？

**CRDT**（Conflict-free Replicated Data Type，无冲突复制数据类型）是一种数据结构，它保证：**任何两个副本，只要接收了相同的编辑集合（无论顺序如何），最终都会收敛到完全一致的状态。**

CRDT 有两种流派：

| 类型 | 原理 | 特点 |
|------|------|------|
| **状态型 (State-based)** | 每次发送完整状态，合并函数满足交换律/结合律 | 实现简单，但带宽开销大 |
| **操作型 (Operation-based)** | 只发送编辑增量（delta），每个操作幂等且按因果序排列 | 带宽小，但实现复杂 |

**Loro 底层采用操作型 CRDT**，但开发者几乎感知不到——你只需操作一个类 JSON 对象，Loro 自动发出微小的二进制变更，通过 WebSocket/WebRTC 广播即可。

---

## 二、什么是 Loro？

**Loro**（意大利语"鹦鹉"之意——会重复所听到的内容）是一个高性能 CRDT 库，由 Rust 编写，编译为 WebAssembly，提供 **JavaScript/TypeScript、Swift、Python** 绑定。

**核心能力：**

- **实时协作编辑** —— 多人同时编辑，自动无冲突合并
- **离线优先** —— 离线编辑，上线后自动同步
- **内置版本控制** —— Git 风格的 commit、checkout、时间旅行
- **撤销/重做** —— UndoManager，支持并发编辑场景
- **极小增量** —— 典型 delta 仅 50~200 字节
- **高性能** —— 加载 1MB 文档约 12ms，10 万次文本插入约 6ms

**与 Yjs、Automerge 对比：**

| 指标 | Yjs | Automerge | Loro |
|------|-----|-----------|------|
| 周下载量 | ~920K | ~85K | ~12K |
| Bundle 大小 | ~18 kB | ~320 kB (WASM) | ~180 kB (WASM) |
| 底层语言 | JavaScript | Rust + WASM | Rust + WASM |
| CRDT 算法 | YATA | RGA + LWW | Fugue + Loro |
| 编码后文档大小 | 160 kB | 250 kB | **68 kB** |
| 内存占用 (加载后) | 28 MB | 41 MB | **15 MB** |

---

## 三、安装与初始化

### 3.1 安装

```bash
npm install loro-crdt
# 或
pnpm add loro-crdt
# 或
yarn add loro-crdt
```

> **Next.js 注意**：由于 loro-crdt 是 Rust 编译的原生模块，需要将其加入 `serverExternalPackages`：
> ```js
> // next.config.js
> module.exports = {
>   serverExternalPackages: ['loro-crdt'],
> }
> ```

### 3.2 基本导入

```typescript
import {
  LoroDoc,
  LoroMap,
  LoroList,
  LoroText,
  LoroTree,
  UndoManager,
} from "loro-crdt";
```

---

## 四、核心数据类型

### 4.1 LoroDoc —— 文档入口

`LoroDoc` 是所有操作的起点。你必须创建一个 Doc 才能使用 Map、List、Text 等容器类型。

```typescript
import { LoroDoc } from "loro-crdt";

// 创建文档
const doc = new LoroDoc();

// 设置唯一 peerId（默认为随机 u64，协作场景建议显式设置）
doc.setPeerId("12345678");

// 获取容器
const map = doc.getMap("profile");     // LoroMap
const list = doc.getList("todos");     // LoroList
const text = doc.getText("content");   // LoroText

// 导出为 JSON
console.log(doc.toJSON());
// { profile: {}, todos: [], content: "" }
```

**关键方法：**

| 方法 | 说明 |
|------|------|
| `getMap(name)` | 获取/创建 LoroMap 容器 |
| `getList(name)` | 获取/创建 LoroList 容器 |
| `getText(name)` | 获取/创建 LoroText 容器 |
| `getTree(name)` | 获取/创建 LoroTree 容器 |
| `getMovableList(name)` | 获取/创建 LoroMovableList 容器 |
| `toJSON()` | 导出完整 JSON 状态 |
| `commit()` | 提交当前变更（触发事件） |
| `fork()` | 创建文档分支 |

### 4.2 LoroMap —— 键值映射

类似 JavaScript 的 `Map` / 普通对象，但支持并发合并（Last-Writer-Wins）。

```typescript
const doc = new LoroDoc();
const profile = doc.getMap("profile");

// 设置值
profile.set("name", "张三");
profile.set("age", 28);
profile.set("email", "zhangsan@example.com");

// 读取值
console.log(profile.get("name"));  // "张三"
console.log(profile.get("age"));   // 28

// 删除
profile.delete("email");

// 嵌套容器（子 Map）
const address = profile.getContainerOrCreate("address", "Map");
address.set("city", "北京");
address.set("street", "长安街 1 号");

// 嵌套 List
const hobbies = profile.getContainerOrCreate("hobbies", "List");
hobbies.insert(0, "阅读");
hobbies.insert(1, "编程");

// 提交变更
doc.commit();

console.log(doc.toJSON());
// {
//   profile: {
//     name: "张三",
//     age: 28,
//     address: { city: "北京", street: "长安街 1 号" },
//     hobbies: ["阅读", "编程"]
//   }
// }
```

**LoroMap 主要方法：**

| 方法 | 说明 |
|------|------|
| `set(key, value)` | 设置键值 |
| `get(key)` | 读取值 |
| `delete(key)` | 删除键 |
| `has(key)` | 检查键是否存在 |
| `keys()` / `values()` / `entries()` | 迭代器 |
| `getContainerOrCreate(key, type)` | 获取或创建子容器 |
| `size` | 键值对数量 |

### 4.3 LoroList —— 有序列表

类似 JavaScript 数组，支持并发插入/删除/移动。

```typescript
const doc = new LoroDoc();
const todos = doc.getList("todos");

// 插入元素
todos.insert(0, { text: "买菜", done: false });
todos.insert(1, { text: "写代码", done: true });
todos.insert(2, { text: "看书", done: false });

// 读取
console.log(todos.get(0));  // { text: "买菜", done: false }
console.log(todos.length);  // 3

// 删除
todos.delete(1, 1);  // 从索引 1 开始删除 1 个元素

// 插入子容器
const subList = todos.insertContainer(0, new LoroList());
subList.insert(0, "子项 1");
subList.insert(1, "子项 2");

doc.commit();

console.log(doc.toJSON());
// {
//   todos: [
//     ["子项 1", "子项 2"],
//     { text: "买菜", done: false },
//     { text: "看书", done: false }
//   ]
// }
```

**LoroList 主要方法：**

| 方法 | 说明 |
|------|------|
| `insert(index, value)` | 在指定位置插入 |
| `delete(index, count)` | 从 index 开始删除 count 个元素 |
| `get(index)` | 读取指定位置的值 |
| `length` | 列表长度 |
| `toArray()` | 转为数组 |
| `insertContainer(index, container)` | 插入子容器 |

### 4.4 LoroText —— 协作富文本

LoroText 是 Loro 最强大的类型，支持纯文本和富文本（加粗、斜体、链接等），使用 **Fugue 算法** 防止并发编辑时的字符交错问题。

```typescript
const doc = new LoroDoc();
const text = doc.getText("article");

// === 纯文本操作 ===
text.insert(0, "Hello, ");
text.insert(6, "World!");
console.log(text.toString());  // "Hello, World!"

// 删除
text.delete(5, 1);  // 删除逗号
text.insert(5, " Loro");
console.log(text.toString());  // "Hello Loro World!"

// === 富文本标记 ===
// 配置样式（在操作前配置）
doc.configTextStyle({
  bold: { expand: "after" },
  italic: { expand: "after" },
  link: { expand: "none" },
});

// 加粗
text.mark({ start: 0, end: 5 }, "bold", true);

// 斜体
text.mark({ start: 6, end: 10 }, "italic", true);

// 链接
text.mark({ start: 11, end: 16 }, "link", "https://loro.dev");

// 取消标记
text.unmark({ start: 0, end: 5 }, "bold");

// 获取带格式的 delta
const delta = text.toDelta();
console.log(delta);
// [
//   { insert: "Hello", attributes: {} },
//   { insert: " Loro", attributes: { italic: true } },
//   { insert: " World!", attributes: { link: "https://loro.dev" } }
// ]
```

**LoroText 主要方法：**

| 方法 | 说明 |
|------|------|
| `insert(pos, text)` | 在位置 pos 插入文本 |
| `delete(pos, len)` | 从 pos 开始删除 len 个字符 |
| `mark(range, key, value)` | 给范围添加格式标记 |
| `unmark(range, key)` | 移除格式标记 |
| `toString()` | 获取纯文本 |
| `toDelta()` | 获取带格式的 delta 数组 |
| `getCursor(pos)` | 获取稳定光标位置 |
| `length` | 文本长度 |

### 4.5 LoroMovableList —— 可移动列表

支持拖拽排序场景——元素可以 `mov` 到新位置而不丢失身份信息。

```typescript
const doc = new LoroDoc();
const playlist = doc.getMovableList("playlist");

playlist.insert(0, "Song A");
playlist.insert(1, "Song B");
playlist.insert(2, "Song C");

// 将索引 2 的元素移动到索引 0
playlist.mov(2, 0);

doc.commit();
console.log(doc.toJSON());
// { playlist: ["Song C", "Song A", "Song B"] }
```

### 4.6 LoroTree —— 可移动树

用于文件浏览器、思维导图等有层级结构的场景，支持节点重新挂载（reparenting）。

```typescript
const doc = new LoroDoc();
const tree = doc.getTree("files");

// 创建根节点
const root = tree.createNode();
const rootId = root.id;

// 创建子节点
const child1 = tree.createNode(rootId);
const child2 = tree.createNode(rootId);

// 在子节点上存储数据
const child1Map = child1.data as LoroMap;
child1Map.set("name", "src");

const child2Map = child2.data as LoroMap;
child2Map.set("name", "docs");

// 移动节点（重新挂载）
tree.move(child2.id, rootId);  // 移到 root 下

doc.commit();
```

---

## 五、数据同步

Loro 是**传输无关**的——只要某种管道能传递二进制 delta 即可。

### 5.1 基本导出/导入

```typescript
// === 发送端 ===
const docA = new LoroDoc();
docA.setPeerId("peer-a");
docA.getMap("data").set("key", "value");
docA.commit();

// 导出所有更新（Uint8Array）
const updates = docA.export({ mode: "update", from: new Map() });

// === 接收端 ===
const docB = new LoroDoc();
docB.setPeerId("peer-b");

// 导入更新
docB.import(updates);

console.log(docB.toJSON());  // { data: { key: "value" } }
```

### 5.2 增量同步（最常用）

通过 **Version Vector**（版本向量）追踪对方已见过的数据，只发送增量。

```typescript
const docA = new LoroDoc();
const docB = new LoroDoc();
docA.setPeerId("peer-a");
docB.setPeerId("peer-b");

// A 做一些编辑
docA.getText("content").insert(0, "第一段内容");
docA.commit();

// B 也做一些编辑
docB.getText("content").insert(0, "B的修改");
docB.commit();

// === 同步：只发送对方没见过的变更 ===
// 获取 B 的版本向量
const bVersion = docB.version();

// A 导出 B 没见过的更新
const delta = docA.export({ mode: "update", from: bVersion });

// B 导入
docB.import(delta);

// 反之亦然
const aVersion = docA.version();
const deltaB = docB.export({ mode: "update", from: aVersion });
docA.import(deltaB);

// 现在两者状态一致
console.log(docA.toJSON());
console.log(docB.toJSON());
// 输出相同
```

### 5.3 WebSocket 实时协作完整示例

```typescript
// ================== 客户端 A ==================
import { LoroDoc } from "loro-crdt";

const doc = new LoroDoc();
doc.setPeerId("client-a");

const ws = new WebSocket("wss://your-server.com/collab/doc-123");

// 监听本地变更，发送给服务端
doc.subscribeLocalUpdate((update) => {
  ws.send(update);  // Uint8Array 直接发送
});

// 接收服务端广播的变更
ws.onmessage = (event) => {
  const data = new Uint8Array(event.data);
  doc.import(data);
};

// 连接建立后，同步初始状态
ws.onopen = () => {
  const snapshot = doc.export({ mode: "snapshot" });
  ws.send(snapshot);
};

// 本地编辑
doc.getText("content").insert(0, "Hello from A!");
doc.commit();  // 触发 subscribeLocalUpdate，自动广播


// ================== 服务端（Node.js） ==================
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  
  ws.on("message", (data) => {
    // 广播给其他客户端
    for (const client of clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(data);
      }
    }
  });

  ws.on("close", () => clients.delete(ws));
});


// ================== 客户端 B ==================
const docB = new LoroDoc();
docB.setPeerId("client-b");

const wsB = new WebSocket("wss://your-server.com/collab/doc-123");

docB.subscribeLocalUpdate((update) => {
  wsB.send(update);
});

wsB.onmessage = (event) => {
  docB.import(new Uint8Array(event.data));
};

// B 看到的文档会自动与 A 同步
docB.subscribeRoot((event) => {
  console.log("文档已更新:", docB.toJSON());
});
```

### 5.4 三种导出模式

```typescript
// 1. 快照 (Snapshot) —— 完整状态 + 压缩历史，用于初始化
const snapshot = doc.export({ mode: "snapshot" });

// 2. 增量更新 (Update) —— 只发差异，用于实时同步
const update = doc.export({ mode: "update", from: peerVersion });

// 3. 浅快照 (Shallow Snapshot) —— 不含完整历史，减少初始同步体积
const shallow = doc.export({ mode: "shallowSnapshot", frontiers: doc.frontiers() });
```

---

## 六、事件监听

### 6.1 订阅变更

```typescript
const doc = new LoroDoc();

// 订阅根容器变更
const unsub = doc.subscribeRoot((event) => {
  console.log("变更触发:", event);
  // event.events 包含所有变更的容器
  // event.trigger 表示触发来源："local" | "import" | "checkout"
});

// 订阅特定容器
const map = doc.getMap("profile");
const unsubMap = map.subscribe((event) => {
  console.log("profile 变更:", event);
});

// 订阅本地更新（仅本地操作产生的二进制 delta）
const unsubLocal = doc.subscribeLocalUpdate((update) => {
  // update: Uint8Array，直接通过 WebSocket 发送
  console.log("本地更新大小:", update.length, "bytes");
});

// 取消订阅
unsub();
unsubMap();
unsubLocal();
```

> **重要**：事件在 `commit()`、`import()`、`checkout()` 时触发，不是在每次 `set()`/`insert()` 时立即触发。

---

## 七、版本控制与时间旅行

### 7.1 Commit 与 Frontiers

```typescript
const doc = new LoroDoc();
const text = doc.getText("doc");

text.insert(0, "第一版");
doc.commit();
const v1 = doc.frontiers();  // 记录当前版本位置

text.insert(3, "，第二版");
doc.commit();
const v2 = doc.frontiers();

text.insert(8, "，第三版");
doc.commit();

console.log(text.toString());  // "第一版，第二版，第三版"
```

### 7.2 Checkout（时间旅行）

```typescript
// 回到 v1 的状态（只读）
doc.checkout(v1);
console.log(text.toString());  // "第一版"

// 回到 v2
doc.checkout(v2);
console.log(text.toString());  // "第一版，第二版"

// 回到最新
doc.checkoutToLatest();
console.log(text.toString());  // "第一版，第二版，第三版"
```

### 7.3 Revert（撤销到某版本）

```typescript
// revert 会生成新操作来"抵消"中间变更，不丢失历史
doc.revertTo(v1);
console.log(text.toString());  // "第一版"
// 但历史记录仍然保留
```

### 7.4 Fork（分支）

```typescript
const mainDoc = new LoroDoc();
mainDoc.getText("content").insert(0, "主干内容");
mainDoc.commit();

// 创建分支
const branchDoc = mainDoc.fork();
branchDoc.getText("content").insert(4, " [分支修改]");
branchDoc.commit();

// 主分支也继续编辑
mainDoc.getText("content").insert(4, " [主干继续]");
mainDoc.commit();

// 合并分支回主干
const branchUpdate = branchDoc.export({
  mode: "update",
  from: mainDoc.version(),
});
mainDoc.import(branchUpdate);

console.log(mainDoc.toJSON());
// 两者的修改都保留了
```

---

## 八、UndoManager（撤销/重做）

```typescript
import { LoroDoc, UndoManager } from "loro-crdt";

const doc = new LoroDoc();
doc.setPeerId("user-1");

// 创建 UndoManager
const undoManager = new UndoManager(doc);

// 可选：配置合并间隔（多少毫秒内的操作合并为一次 undo）
// undoManager.setMergeInterval(200);

const text = doc.getText("content");

// 编辑 1
text.insert(0, "Hello");
doc.commit();

// 编辑 2
text.insert(5, " World");
doc.commit();

// 编辑 3
text.insert(11, "!");
doc.commit();

console.log(text.toString());  // "Hello World!"

// === 撤销 ===
undoManager.undo();
console.log(text.toString());  // "Hello World"

undoManager.undo();
console.log(text.toString());  // "Hello"

undoManager.undo();
console.log(text.toString());  // ""

// === 重做 ===
undoManager.redo();
console.log(text.toString());  // "Hello"

undoManager.redo();
console.log(text.toString());  // "Hello World"

// 检查状态
console.log(undoManager.canUndo());  // true
console.log(undoManager.canRedo());  // true
```

> **并发安全**：UndoManager 只撤销**当前 peer** 的操作，不会影响其他用户的编辑。这是它与简单 "Ctrl+Z" 的本质区别。

---

## 九、持久化存储

### 9.1 浏览器 IndexedDB

```typescript
import { openDB } from "idb";

const db = await openDB("loro-docs", 1, {
  stores: { documents: "++id" },
});

// 保存
const snapshot = doc.export({ mode: "snapshot" });
await db.put("documents", { id: "doc-1", data: snapshot });

// 加载
const saved = await db.get("documents", "doc-1");
if (saved) {
  const newDoc = new LoroDoc();
  newDoc.import(saved.data);
  console.log(newDoc.toJSON());  // 恢复完整状态
}
```

### 9.2 Node.js 文件系统

```typescript
import { writeFileSync, readFileSync, existsSync } from "fs";

// 保存
const snapshot = doc.export({ mode: "snapshot" });
writeFileSync("./doc.lob", snapshot);

// 加载
if (existsSync("./doc.lob")) {
  const data = readFileSync("./doc.lob");
  const restored = new LoroDoc();
  restored.import(data);
}
```

### 9.3 增量持久化（推荐）

```typescript
// 监听本地更新，追加写入
const pendingUpdates: Uint8Array[] = [];

doc.subscribeLocalUpdate((update) => {
  pendingUpdates.push(update);
  
  // 定期批量持久化
  if (pendingUpdates.length >= 10) {
    saveToStorage(pendingUpdates);
    pendingUpdates.length = 0;
  }
});

// 启动时加载
const savedUpdates = loadFromStorage();
const doc = new LoroDoc();
for (const update of savedUpdates) {
  doc.import(update);
}
```

---

## 十、实战：协作 Todo 应用

```typescript
import { LoroDoc, UndoManager } from "loro-crdt";

// ========== 模型定义 ==========
interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

class CollaborativeTodoStore {
  private doc: LoroDoc;
  private todos: LoroList;
  private undoManager: UndoManager;

  constructor(peerId: string) {
    this.doc = new LoroDoc();
    this.doc.setPeerId(peerId);
    this.todos = this.doc.getList("todos");
    this.undoManager = new UndoManager(this.doc);
  }

  // 添加 todo
  addTodo(text: string): void {
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: Date.now(),
    };
    this.todos.insert(this.todos.length, todo);
    this.doc.commit();
  }

  // 切换完成状态
  toggleTodo(index: number): void {
    const todo = this.todos.get(index) as Todo;
    this.todos.delete(index, 1);
    this.todos.insert(index, { ...todo, done: !todo.done });
    this.doc.commit();
  }

  // 删除
  removeTodo(index: number): void {
    this.todos.delete(index, 1);
    this.doc.commit();
  }

  // 获取所有 todo
  getAll(): Todo[] {
    return this.todos.toArray() as Todo[];
  }

  // 撤销/重做
  undo(): boolean { return this.undoManager.undo(); }
  redo(): boolean { return this.undoManager.redo(); }

  // === 同步相关 ===

  // 监听变更
  onRemoteChange(callback: () => void): () => void {
    return this.doc.subscribeRoot((event) => {
      if (event.origin === "import") {
        callback();
      }
    });
  }

  // 监听本地更新（用于网络发送）
  onLocalUpdate(callback: (update: Uint8Array) => void): () => void {
    return this.doc.subscribeLocalUpdate(callback);
  }

  // 接收远端更新
  applyRemote(update: Uint8Array): void {
    this.doc.import(update);
  }

  // 获取全量快照（用于初次同步）
  getSnapshot(): Uint8Array {
    return this.doc.export({ mode: "snapshot" });
  }

  // 从快照恢复
  static fromSnapshot(
    peerId: string,
    snapshot: Uint8Array,
  ): CollaborativeTodoStore {
    const store = new CollaborativeTodoStore(peerId);
    store.doc.import(snapshot);
    return store;
  }
}

// ========== 使用示例 ==========
const store = new CollaborativeTodoStore("user-alice");

store.addTodo("买菜");
store.addTodo("写代码");
store.addTodo("看书");

console.log(store.getAll());
// [
//   { id: "...", text: "买菜", done: false, createdAt: ... },
//   { id: "...", text: "写代码", done: false, createdAt: ... },
//   { id: "...", text: "看书", done: false, createdAt: ... }
// ]

store.toggleTodo(1);
console.log(store.getAll()[1]);
// { id: "...", text: "写代码", done: true, createdAt: ... }

store.undo();
console.log(store.getAll()[1].done);  // false

store.redo();
console.log(store.getAll()[1].done);  // true
```

---

## 十一、最佳实践

| 场景 | 建议 |
|------|------|
| **PeerId 设置** | 每个设备/用户设置唯一 peerId，避免冲突 |
| **事件触发** | 批量操作后统一 `commit()`，避免频繁触发事件 |
| **增量同步** | 优先用 `version()` + `export({ mode: "update", from })` 发送增量 |
| **初次同步** | 用 `export({ mode: "snapshot" })` 发送完整快照 |
| **持久化** | 定期保存增量更新，而非每次保存完整快照 |
| **Next.js** | 必须将 `loro-crdt` 加入 `serverExternalPackages` |
| **大文档** | 使用浅快照（shallowSnapshot）减少初始加载体积 |
| **协作编辑** | 使用 `UndoManager` 而非手动 revert，确保并发安全 |
| **光标同步** | 使用 `getCursor()` + `getCursorPos()` 获取跨编辑的稳定位置 |

---

## 十二、API 速查表

```
// 文档
new LoroDoc()
doc.setPeerId(id)
doc.commit()
doc.toJSON()
doc.fork()
doc.version()              // 获取版本向量
doc.frontiers()            // 获取 frontiers
doc.checkout(frontiers)    // 时间旅行
doc.checkoutToLatest()
doc.revertTo(frontiers)

// 导入导出
doc.export({ mode: "snapshot" })
doc.export({ mode: "update", from: versionVector })
doc.export({ mode: "shallowSnapshot", frontiers })
doc.import(data)

// 容器获取
doc.getMap(name)
doc.getList(name)
doc.getText(name)
doc.getTree(name)
doc.getMovableList(name)

// 事件
doc.subscribeRoot(callback)
doc.subscribeLocalUpdate(callback)
container.subscribe(callback)

// 撤销
new UndoManager(doc)
undoManager.undo()
undoManager.redo()
undoManager.canUndo()
undoManager.canRedo()
```

---

## 十三、学习资源

- **官网**：https://loro.dev
- **文档**：https://loro.dev/docs
- **GitHub**：https://github.com/loro-dev/loro
- **npm**：`loro-crdt`
- **Rust API 文档**：https://docs.rs/loro/
- **ProseMirror 绑定**：https://github.com/loro-dev/loro-prosemirror
