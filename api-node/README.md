# Dify Backend API (Node.js)

Node.js 重写版本的 Dify 后端 API，替代原有的 Python (Flask) 实现。

## 目标

- 将 `api/` 下的 Python 后端代码逐步迁移至 Node.js / TypeScript
- 保持与现有前端 (`web/`) 和基础设施 (PostgreSQL / Redis) 的完全兼容
- 复用已有的 API 契约（OpenAPI 规范），确保接口行为一致

## 技术栈

| 层面 | 选型 | 说明 |
|------|------|------|
| Runtime | **Node.js 22 LTS** | monorepo 统一锁定版本 |
| Language | **TypeScript (strict)** | ESM 模式，类型安全 |
| Framework | **Hono** | 轻量高性能，原生 TS 支持 |
| ORM | **Drizzle ORM** | TypeScript-first，SQL-like API |
| DB Driver | **postgres.js** | 高性能 PostgreSQL 客户端 |
| 校验 | **Zod** | 运行时类型校验 |
| 配置 | **c12** + dotenv | 环境变量 + 配置文件 |
| Dev | **tsx watch** | 热重载开发 |
| Build | **tsup** | 快速 ESM 构建 |
| Testing | **Vitest** | 与前端测试框架统一 |
| Package Manager | **pnpm** | monorepo workspace |

## 目录结构

```
api-node/
├── src/
│   ├── config/         # 配置加载（Zod 校验环境变量）
│   ├── controllers/    # 路由 & 请求处理
│   ├── services/       # 业务逻辑
│   ├── models/         # 数据模型
│   ├── repositories/   # 数据访问层
│   ├── middlewares/     # 中间件（认证、错误处理等）
│   ├── db/
│   │   ├── index.ts    # Drizzle 数据库连接
│   │   └── schema.ts   # 表结构定义
│   └── index.ts        # 应用入口（Hono + @hono/node-server）
├── drizzle/            # Drizzle Kit 生成的迁移文件
├── tests/
├── drizzle.config.ts   # Drizzle Kit 配置
├── tsup.config.ts      # 构建配置
├── tsconfig.json       # TypeScript 配置
├── .env.example        # 环境变量示例
├── Dockerfile
├── package.json
└── README.md
```

## 开发

```bash
# 安装依赖（在 monorepo 根目录）
pnpm install

# 启动开发服务器（热重载）
pnpm --filter @dify/api-node dev

# 构建生产版本
pnpm --filter @dify/api-node build

# 启动生产服务器
pnpm --filter @dify/api-node start

# 类型检查
pnpm --filter @dify/api-node type-check
```

## 数据库

```bash
# 生成迁移文件
pnpm --filter @dify/api-node db:generate

# 执行迁移
pnpm --filter @dify/api-node db:migrate

# 打开 Drizzle Studio
pnpm --filter @dify/api-node db:studio
```

## 测试

```bash
pnpm --filter @dify/api-node test           # 运行所有测试
pnpm --filter @dify/api-node test:watch     # Watch 模式
```

## Docker

```bash
# 在 monorepo 根目录构建镜像
docker build -t dify-api-node -f api-node/Dockerfile .

# 运行容器
docker run -p 5001:5001 --env-file api-node/.env dify-api-node
```

## 迁移进度

| 模块 | 状态 |
|------|------|
| 项目初始化 | ✅ 完成 |
| Hono 框架 + 路由 | ✅ 基础搭建完成 |
| Drizzle ORM + DB | ✅ 基础搭建完成 |
| 配置管理（Zod） | ✅ 完成 |
| 认证系统 | 🔲 待开始 |
| 对话 API | 🔲 待开始 |
| 工作流引擎 | 🔲 待开始 |
| 模型管理 | 🔲 待开始 |
# Dify Backend API (Node.js)

Node.js 重写版本的 Dify 后端 API，替代原有的 Python (Flask) 实现。

## 目标

- 将 `api/` 下的 Python 后端代码逐步迁移至 Node.js / TypeScript
- 保持与现有前端 (`web/`) 和基础设施 (PostgreSQL / Redis) 的完全兼容
- 复用已有的 API 契约（OpenAPI 规范），确保接口行为一致

## 技术栈

- **Runtime**: Node.js 22 LTS
- **Language**: TypeScript (strict mode)
- **Framework**: 待定（Express / Fastify / Hono）
- **Package Manager**: pnpm
- **ORM**: 待定（Drizzle / Prisma）
- **Testing**: Vitest

## 目录结构（规划）

```
api-node/
├── src/
│   ├── controllers/    # 路由 & 请求处理
│   ├── services/       # 业务逻辑
│   ├── models/         # 数据模型
│   ├── repositories/   # 数据访问层
│   ├── middlewares/     # 中间件（认证、错误处理等）
│   ├── config/         # 配置加载
│   └── index.ts        # 应用入口
├── tests/
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
cd api-node
pnpm install
pnpm dev        # 启动开发服务器（热重载）
pnpm build      # 构建生产版本
pnpm start      # 启动生产服务器
```

## 测试

```bash
pnpm test          # 运行所有测试
pnpm test:unit     # 单元测试
pnpm test:integration  # 集成测试
```

## Docker

```bash
# 构建镜像
docker build -t dify-api-node -f api-node/Dockerfile .

# 运行容器
docker run -p 5001:5001 --env-file api-node/.env dify-api-node
```

## 迁移进度

| 模块 | 状态 |
|------|------|
| 项目初始化 | ✅ 进行中 |
| 数据库模型 | 🔲 待开始 |
| 认证系统 | 🔲 待开始 |
| 对话 API | 🔲 待开始 |
| 工作流引擎 | 🔲 待开始 |
| 模型管理 | 🔲 待开始 |
