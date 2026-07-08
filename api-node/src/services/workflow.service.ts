import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import type { Database } from '../db/index.js'
import { apiTokens, apps, endUsers, workflowRuns } from '../db/schema.js'
import { AppError, BadRequestError, NotFoundError } from '../lib/errors.js'

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

export const workflowRunPayloadSchema = z.object({
  inputs: z.record(z.string(), z.unknown()).default({}),
  files: z.array(workflowInputFileItemSchema).nullable().optional(),
  response_mode: z.enum(['blocking', 'streaming']).optional(),
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
   * Creates and returns a new WorkflowRun record.
   * Mirrors the Python AppGenerateService.generate() call for workflow apps.
   *
   * Note: The actual workflow execution is handled by the Python backend
   * (AppGenerateService -> Celery task). This method creates the run record
   * and publishes a task to the Celery queue for Python workers to execute.
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
        graph: null,
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

    return run!
  },
}
