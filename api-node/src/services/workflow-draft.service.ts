/**
 * Workflow draft service — mirrors Python api/controllers/console/app/workflow.py
 * DraftWorkflowApi and api/services/workflow_service.py.
 *
 * GET  /console/api/apps/{appId}/workflows/draft
 * POST /console/api/apps/{appId}/workflows/draft
 */

import { and, eq } from 'drizzle-orm'
import { createHash, randomUUID } from 'node:crypto'
import type { Database } from '../db/index.js'
import { accounts, workflows } from '../db/schema.js'
import { AppError } from '../lib/errors.js'

// ── Error classes ────────────────────────────────────────────────────────────

/** 404 — Draft workflow does not exist for this app. */
export class DraftWorkflowNotExistError extends AppError {
  constructor() {
    super(404, 'draft_workflow_not_exist', 'Draft workflow not found.')
    this.name = 'DraftWorkflowNotExistError'
  }
}

/** 400 — Workflow hash does not match (optimistic concurrency conflict). */
export class DraftWorkflowNotSyncError extends AppError {
  constructor() {
    super(400, 'draft_workflow_not_sync', 'Workflow has been modified by another user.')
    this.name = 'DraftWorkflowNotSyncError'
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a Date to Unix timestamp (seconds). */
function toTimestamp(value: Date | null | undefined): number {
  if (!value) return 0
  return Math.floor(value.getTime() / 1000)
}

/** Safely parse a JSON string, returning the fallback on failure. */
function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  }
  catch {
    return fallback
  }
}

/** Compute a unique hash for the workflow (mirrors Python Workflow.unique_hash). */
function computeHash(wf: { id: string; graph: string | null; features: string | null }): string {
  const content = `${wf.id}:${wf.graph || ''}:${wf.features || ''}`
  return createHash('sha256').update(content).digest('hex')
}

// ── Response types ───────────────────────────────────────────────────────────

interface SimpleAccount {
  id: string
  name: string
  email: string
}

export interface WorkflowDraftResponse {
  id: string
  graph: Record<string, unknown>
  features: Record<string, unknown>
  hash: string
  version: string
  marked_name: string
  marked_comment: string
  created_by: SimpleAccount | null
  created_at: number
  updated_by: SimpleAccount | null
  updated_at: number
  tool_published: boolean
  environment_variables: unknown[]
  conversation_variables: unknown[]
  rag_pipeline_variables: unknown[]
}

// ── Request types ────────────────────────────────────────────────────────────

export interface SyncDraftWorkflowPayload {
  graph: Record<string, unknown>
  features: Record<string, unknown>
  hash?: string | null
  environment_variables?: unknown[]
  conversation_variables?: unknown[]
}

export interface SyncDraftWorkflowResult {
  result: 'success'
  hash: string
  updated_at: number
}

// ── Service ──────────────────────────────────────────────────────────────────

export const workflowDraftService = {
  /**
   * Get the draft workflow for an app.
   * Mirrors Python DraftWorkflowApi.get() from workflow.py L502-539.
   *
   * NOTE: Agent binding projection (WorkflowAgentPublishService.project_draft_bindings_to_graph)
   * is intentionally skipped in this initial implementation. The raw graph JSON is returned as-is.
   * If agent_v2 nodes need binding projection, add it later.
   */
  async getDraftWorkflow(
    db: Database,
    tenantId: string,
    appId: string,
  ): Promise<WorkflowDraftResponse> {
    // Query draft workflow
    const [wf] = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.tenantId, tenantId),
          eq(workflows.appId, appId),
          eq(workflows.version, 'draft'),
        ),
      )
      .limit(1)

    if (!wf) {
      throw new DraftWorkflowNotExistError()
    }

    // Resolve created_by account
    let createdByAccount: SimpleAccount | null = null
    if (wf.createdBy) {
      const [acct] = await db
        .select({ id: accounts.id, name: accounts.name, email: accounts.email })
        .from(accounts)
        .where(eq(accounts.id, wf.createdBy))
        .limit(1)
      if (acct) createdByAccount = acct
    }

    // Resolve updated_by account
    let updatedByAccount: SimpleAccount | null = null
    if (wf.updatedBy) {
      const [acct] = await db
        .select({ id: accounts.id, name: accounts.name, email: accounts.email })
        .from(accounts)
        .where(eq(accounts.id, wf.updatedBy))
        .limit(1)
      if (acct) updatedByAccount = acct
    }

    // Parse JSON fields
    const graph = safeJsonParse(wf.graph, {}) as Record<string, unknown>
    const features = safeJsonParse(wf.features, {}) as Record<string, unknown>
    const envVars = safeJsonParse(wf.environmentVariables, []) as unknown[]
    const convVars = safeJsonParse(wf.conversationVariables, []) as unknown[]
    const ragVars = safeJsonParse(wf.ragPipelineVariables, []) as unknown[]

    return {
      id: wf.id,
      graph,
      features,
      hash: computeHash(wf),
      version: wf.version || 'draft',
      marked_name: wf.markedName || '',
      marked_comment: wf.markedComment || '',
      created_by: createdByAccount,
      created_at: toTimestamp(wf.createdAt),
      updated_by: updatedByAccount,
      updated_at: toTimestamp(wf.updatedAt),
      tool_published: false,
      environment_variables: Array.isArray(envVars) ? envVars : [],
      conversation_variables: Array.isArray(convVars) ? convVars : [],
      rag_pipeline_variables: Array.isArray(ragVars) ? ragVars : [],
    }
  },

  /**
   * Get the published workflow for an app.
   * Mirrors Python WorkflowService.get_published_workflow() from workflow_service.py L247-270.
   * Returns null if no workflow has been published yet.
   */
  async getPublishedWorkflow(
    db: Database,
    tenantId: string,
    appId: string,
    publishedWorkflowId: string | null,
  ): Promise<WorkflowDraftResponse | null> {
    if (!publishedWorkflowId) return null

    const [wf] = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.tenantId, tenantId),
          eq(workflows.appId, appId),
          eq(workflows.id, publishedWorkflowId),
        ),
      )
      .limit(1)

    if (!wf) return null

    // Resolve created_by account
    let createdByAccount: SimpleAccount | null = null
    if (wf.createdBy) {
      const [acct] = await db
        .select({ id: accounts.id, name: accounts.name, email: accounts.email })
        .from(accounts)
        .where(eq(accounts.id, wf.createdBy))
        .limit(1)
      if (acct) createdByAccount = acct
    }

    // Resolve updated_by account
    let updatedByAccount: SimpleAccount | null = null
    if (wf.updatedBy) {
      const [acct] = await db
        .select({ id: accounts.id, name: accounts.name, email: accounts.email })
        .from(accounts)
        .where(eq(accounts.id, wf.updatedBy))
        .limit(1)
      if (acct) updatedByAccount = acct
    }

    const graph = safeJsonParse(wf.graph, {}) as Record<string, unknown>
    const features = safeJsonParse(wf.features, {}) as Record<string, unknown>
    const envVars = safeJsonParse(wf.environmentVariables, []) as unknown[]
    const convVars = safeJsonParse(wf.conversationVariables, []) as unknown[]
    const ragVars = safeJsonParse(wf.ragPipelineVariables, []) as unknown[]

    return {
      id: wf.id,
      graph,
      features,
      hash: computeHash(wf),
      version: wf.version || '',
      marked_name: wf.markedName || '',
      marked_comment: wf.markedComment || '',
      created_by: createdByAccount,
      created_at: toTimestamp(wf.createdAt),
      updated_by: updatedByAccount,
      updated_at: toTimestamp(wf.updatedAt),
      tool_published: false,
      environment_variables: Array.isArray(envVars) ? envVars : [],
      conversation_variables: Array.isArray(convVars) ? convVars : [],
      rag_pipeline_variables: Array.isArray(ragVars) ? ragVars : [],
    }
  },

  /**
   * Sync (create or update) the draft workflow for an app.
   * Mirrors Python WorkflowService.sync_draft_workflow() from workflow_service.py L320-390.
   */
  async syncDraftWorkflow(
    db: Database,
    tenantId: string,
    appId: string,
    appMode: string,
    accountId: string,
    payload: SyncDraftWorkflowPayload,
  ): Promise<SyncDraftWorkflowResult> {
    // Fetch existing draft
    const [existing] = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.tenantId, tenantId),
          eq(workflows.appId, appId),
          eq(workflows.version, 'draft'),
        ),
      )
      .limit(1)

    // Optimistic concurrency check
    if (existing && payload.hash != null) {
      const currentHash = computeHash(existing)
      if (currentHash !== payload.hash) {
        throw new DraftWorkflowNotSyncError()
      }
    }

    const graphJson = JSON.stringify(payload.graph)
    const featuresJson = JSON.stringify(payload.features)
    const envVarsJson = JSON.stringify(payload.environment_variables ?? [])
    const convVarsJson = JSON.stringify(payload.conversation_variables ?? [])
    const now = new Date()

    if (!existing) {
      // Map app mode → workflow type (mirrors Python WorkflowType.from_app_mode)
      const wfType = appMode === 'advanced-chat' ? 'chatflow' : 'workflow'
      const newId = randomUUID()

      await db.insert(workflows).values({
        id: newId,
        tenantId,
        appId,
        type: wfType,
        version: 'draft',
        graph: graphJson,
        features: featuresJson,
        createdBy: accountId,
        createdAt: now,
        updatedBy: accountId,
        updatedAt: now,
        environmentVariables: envVarsJson,
        conversationVariables: convVarsJson,
      })

      return {
        result: 'success',
        hash: computeHash({ id: newId, graph: graphJson, features: featuresJson }),
        updated_at: toTimestamp(now),
      }
    }

    // Update existing draft
    await db
      .update(workflows)
      .set({
        graph: graphJson,
        features: featuresJson,
        updatedBy: accountId,
        updatedAt: now,
        environmentVariables: envVarsJson,
        conversationVariables: convVarsJson,
      })
      .where(eq(workflows.id, existing.id))

    return {
      result: 'success',
      hash: computeHash({ id: existing.id, graph: graphJson, features: featuresJson }),
      updated_at: toTimestamp(now),
    }
  },
}
