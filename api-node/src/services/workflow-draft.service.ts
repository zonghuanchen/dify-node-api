/**
 * Workflow draft service — mirrors Python api/controllers/console/app/workflow.py
 * DraftWorkflowApi.get() and api/services/workflow_service.py get_draft_workflow().
 *
 * GET /console/api/apps/{appId}/workflows/draft
 */

import { and, eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'
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
}
