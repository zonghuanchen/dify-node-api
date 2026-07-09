import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import type { Database } from '../db/index.js'
import { apiTokens, apps, endUsers, workflowRuns } from '../db/schema.js'
import { AppError, BadRequestError, NotFoundError } from '../lib/errors.js'
import { GraphEngineRunner } from '../graph-engine/runner.js'
import type { GraphDict } from '../graph-engine/graph.js'
import type { RunnerResult } from '../graph-engine/runner.js'

// ── Error classes ────────────────────────────────────────────────────────────

/** 400 Bad Request — App mode is not workflow. */
export class NotWorkflowAppError extends AppError {
  constructor() {
    super(400, 'not_workflow_app', 'App mode must be "workflow".')
    this.name = 'NotWorkflowAppError'
  }
}

/** 401 Unauthorized — Invalid or missing API token. */
export class InvalidApiTokenError extends AppError {
  constructor(message = 'Invalid API token.') {
    super(401, 'unauthorized', message)
    this.name = 'InvalidApiTokenError'
  }
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

const workflowInputFileItemSchema = z.object({
  type: z.enum(['document', 'image', 'audio', 'video', 'custom']),
  transfer_method: z.enum(['remote_url', 'local_file']),
  url: z.string().url().optional(),
  upload_file_id: z.string().optional(),
})

// Node shape for graph_dict.nodes entries
const graphNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

const graphEdgeSchema = z.object({
  source: z.string().optional(),
  target: z.string().optional(),
  sourceHandle: z.string().optional(),
}).passthrough()

const graphDictSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
})

export const workflowRunPayloadSchema = z.object({
  inputs: z.record(z.string(), z.unknown()).default({}),
  files: z.array(workflowInputFileItemSchema).nullable().optional(),
  response_mode: z.enum(['blocking', 'streaming']).optional(),
  graph_dict: graphDictSchema.optional(),
})

export type WorkflowRunPayload = z.infer<typeof workflowRunPayloadSchema>

// ── Response types ───────────────────────────────────────────────────────────

export interface WorkflowRunResponse {
  id: string
  workflow_id: string
  status: string
  inputs: unknown
  outputs: Record<string, unknown>
  error: string | null
  total_steps: number | null
  total_tokens: number | null
  created_at: number | null
  finished_at: number | null
  elapsed_time: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a Date to Unix timestamp (seconds), or null. */
function toTimestamp(value: Date | null | undefined): number | null {
  if (!value) return null
  return Math.floor(value.getTime() / 1000)
}

/** Parses JSON string safely, returns null on failure. */
function safeParseJson(value: string | null | undefined): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/** Serializes a WorkflowRun row into the API response shape. */
export function serializeWorkflowRun(row: typeof workflowRuns.$inferSelect): WorkflowRunResponse {
  const rawOutputs = safeParseJson(row.outputs)
  const outputs: Record<string, unknown>
    = row.status === 'paused' || rawOutputs === null
      ? {}
      : (rawOutputs as Record<string, unknown>)

  return {
    id: row.id,
    workflow_id: row.workflowId,
    status: row.status,
    inputs: safeParseJson(row.inputs),
    outputs,
    error: row.error,
    total_steps: row.totalSteps,
    total_tokens: row.totalTokens,
    created_at: toTimestamp(row.createdAt),
    finished_at: toTimestamp(row.finishedAt),
    elapsed_time: row.elapsedTime,
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

export const workflowService = {
  /**
   * Validates a Service API Bearer token and returns the associated app.
   * Mirrors Python `validate_app_token` decorator.
   *
   * API keys are stored in `api_tokens` table with type='app'.
   * The token value in the Authorization header matches the stored token directly.
   */
  async validateApiToken(db: Database, token: string) {
    const [apiToken] = await db
      .select()
      .from(apiTokens)
      .where(and(
        eq(apiTokens.token, token),
        eq(apiTokens.type, 'app'),
      ))
      .limit(1)

    if (!apiToken || !apiToken.appId) {
      throw new InvalidApiTokenError()
    }

    // Update last_used_at (best-effort, don't block)
    db.update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, apiToken.id))
      .catch(() => { /* non-fatal */ })

    const [app] = await db
      .select()
      .from(apps)
      .where(eq(apps.id, apiToken.appId))
      .limit(1)

    if (!app) {
      throw new InvalidApiTokenError('App not found for this API token.')
    }

    return app
  },

  /**
   * Gets or creates an EndUser for the Service API request.
   * Mirrors Python FetchUserArg logic — user info comes from JSON body.
   */
  async getOrCreateEndUser(
    db: Database,
    app: typeof apps.$inferSelect,
    userBody: { user: string } | undefined,
  ) {
    const externalUserId = userBody?.user ?? 'default-user'

    const [existing] = await db
      .select()
      .from(endUsers)
      .where(and(
        eq(endUsers.tenantId, app.tenantId),
        eq(endUsers.externalUserId, externalUserId),
        eq(endUsers.type, 'service_api'),
      ))
      .limit(1)

    if (existing) return existing

    const now = new Date()
    const id = uuidv4()
    const [created] = await db
      .insert(endUsers)
      .values({
        id,
        tenantId: app.tenantId,
        appId: app.id,
        type: 'service_api',
        externalUserId,
        name: externalUserId,
        isAnonymous: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return created!
  },

  /**
   * Gets a workflow run by ID, scoped to the app's tenant.
   * Mirrors Python WorkflowRunDetailApi.get().
   */
  async getWorkflowRunById(
    db: Database,
    app: typeof apps.$inferSelect,
    workflowRunId: string,
  ) {
    const [run] = await db
      .select()
      .from(workflowRuns)
      .where(and(
        eq(workflowRuns.id, workflowRunId),
        eq(workflowRuns.tenantId, app.tenantId),
        eq(workflowRuns.appId, app.id),
      ))
      .limit(1)

    if (!run) {
      throw new NotFoundError('Workflow run not found.')
    }

    return run
  },

  /**
   * Creates and returns a new WorkflowRun record, then executes the graph
   * in a child process if `graph_dict` is provided in the payload.
   *
   * When `graph_dict` is absent, only the run record is created (legacy behavior).
   * The graph execution is delegated to GraphEngineRunner (subprocess), mirroring
   * Python's Worker/Dispatcher architecture where Celery workers run GraphEngine.
   */
  async runWorkflow(
    db: Database,
    app: typeof apps.$inferSelect,
    endUser: typeof endUsers.$inferSelect,
    payload: WorkflowRunPayload,
    workflowId?: string,
  ) {
    // Validate app mode
    if (app.mode !== 'workflow') {
      throw new NotWorkflowAppError()
    }

    const effectiveWorkflowId = workflowId ?? app.workflowId
    if (!effectiveWorkflowId) {
      throw new BadRequestError('No workflow associated with this app.')
    }

    const now = new Date()
    const runId = uuidv4()
    const startTime = Date.now()

    const [run] = await db
      .insert(workflowRuns)
      .values({
        id: runId,
        tenantId: app.tenantId,
        appId: app.id,
        workflowId: effectiveWorkflowId,
        type: 'workflow',
        triggeredFrom: 'app-run',
        version: '1.0.0',
        graph: payload.graph_dict ? JSON.stringify(payload.graph_dict) : null,
        inputs: JSON.stringify(payload.inputs),
        status: 'running',
        outputs: '{}',
        error: null,
        elapsedTime: 0,
        totalTokens: 0,
        totalSteps: 0,
        createdByRole: 'end_user',
        createdBy: endUser.id,
        createdAt: now,
        finishedAt: null,
        exceptionsCount: 0,
      })
      .returning()

    const createdRun = run!

    // Execute graph in subprocess if graph_dict is provided
    if (payload.graph_dict) {
      // Fire-and-forget: update record when execution completes
      void this.executeInSubprocess(db, createdRun, payload.graph_dict as GraphDict, payload.inputs)
    }

    return createdRun
  },

  /**
   * Executes a workflow graph in a child process and updates the DB record.
   */
  async executeInSubprocess(
    db: Database,
    run: typeof workflowRuns.$inferSelect,
    graphDict: GraphDict,
    inputs: Record<string, unknown>,
  ): Promise<RunnerResult> {
    const runner = new GraphEngineRunner()
    const startTime = Date.now()

    let result: RunnerResult
    try {
      result = await runner.run({
        graphDict,
        workflowId: run.workflowId,
        inputs,
      })
    } catch (err) {
      // Runner spawn failure
      const errorMsg = err instanceof Error ? err.message : String(err)
      await db
        .update(workflowRuns)
        .set({
          status: 'failed',
          error: errorMsg,
          finishedAt: new Date(),
          elapsedTime: (Date.now() - startTime) / 1000,
        })
        .where(eq(workflowRuns.id, run.id))

      return { events: [], status: 'error', error: errorMsg, outputs: {} }
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000

    // Map runner status to DB status
    const statusMap: Record<RunnerResult['status'], string> = {
      succeeded: 'succeeded',
      failed: 'failed',
      aborted: 'stopped',
      partial_succeeded: 'partial-succeeded',
      error: 'failed',
    }

    await db
      .update(workflowRuns)
      .set({
        status: statusMap[result.status] ?? 'failed',
        outputs: JSON.stringify(result.outputs),
        error: result.error ?? null,
        finishedAt: new Date(),
        elapsedTime: elapsedSeconds,
        totalSteps: result.events.filter(e => e._type === 'node_run_succeeded').length,
      })
      .where(eq(workflowRuns.id, run.id))

    return result
  },
}
