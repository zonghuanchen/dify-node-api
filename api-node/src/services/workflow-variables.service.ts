/**
 * Workflow variables service — mirrors Python api/controllers/console/app/workflow_draft_variable.py
 * and api/services/workflow_draft_variable_service.py.
 *
 * Handles listing workflow draft variables, conversation variables, and system variables.
 */

import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { workflowDraftVariables, workflows } from '../db/schema.js'
import { AppError } from '../lib/errors.js'

// ── Constants ────────────────────────────────────────────────────────────────

/** Special node_id value for conversation variables. */
const CONVERSATION_VARIABLE_NODE_ID = 'conversation'

/** Special node_id value for system variables. */
const SYSTEM_VARIABLE_NODE_ID = 'sys'

// ── Error classes ────────────────────────────────────────────────────────────

export class DraftWorkflowNotExistError extends AppError {
  constructor() {
    super(404, 'draft_workflow_not_exist', 'Draft workflow not found.')
    this.name = 'DraftWorkflowNotExistError'
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Determine the variable "type" label from node_id.
 * Mirrors Python WorkflowDraftVariable.get_variable_type().
 */
function getVariableType(nodeId: string): string {
  if (nodeId === CONVERSATION_VARIABLE_NODE_ID) return 'conversation'
  if (nodeId === SYSTEM_VARIABLE_NODE_ID) return 'sys'
  return 'node'
}

// ── Response types ───────────────────────────────────────────────────────────

interface VariableItemWithoutValue {
  id: string
  type: string
  name: string
  description: string
  selector: string[]
  value_type: string
  edited: boolean
  visible: boolean
  is_truncated: boolean
}

interface VariableItemWithValue extends VariableItemWithoutValue {
  value: unknown
  full_content: null
}

interface VariableListWithoutValue {
  items: VariableItemWithoutValue[]
  total: number
}

interface VariableListWithValue {
  items: VariableItemWithValue[]
}

// ── Service ──────────────────────────────────────────────────────────────────

export const workflowVariablesService = {
  /**
   * Check if a draft workflow exists for the given app.
   * Throws DraftWorkflowNotExistError if not found.
   */
  async ensureDraftWorkflowExists(
    db: Database,
    tenantId: string,
    appId: string,
  ): Promise<void> {
    const [wf] = await db
      .select({ id: workflows.id })
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
  },

  /**
   * List workflow variables without values (paginated).
   * Mirrors Python WorkflowVariableCollectionApi.get() from workflow_draft_variable.py L319-356.
   */
  async listVariables(
    db: Database,
    appId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<VariableListWithoutValue> {
    const offset = (page - 1) * limit

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workflowDraftVariables)
      .where(
        and(
          eq(workflowDraftVariables.appId, appId),
          eq(workflowDraftVariables.userId, userId),
        ),
      )

    const total = countResult?.count ?? 0

    // Get paginated items
    const rows = await db
      .select()
      .from(workflowDraftVariables)
      .where(
        and(
          eq(workflowDraftVariables.appId, appId),
          eq(workflowDraftVariables.userId, userId),
        ),
      )
      .limit(limit)
      .offset(offset)

    const items: VariableItemWithoutValue[] = rows.map((row) => ({
      id: row.id,
      type: getVariableType(row.nodeId),
      name: row.name,
      description: row.description,
      selector: safeJsonParse<string[]>(row.selector, []),
      value_type: row.valueType,
      edited: row.lastEditedAt != null,
      visible: row.visible,
      is_truncated: row.fileId != null,
    }))

    return { items, total }
  },

  /**
   * List conversation variables with values.
   * Mirrors Python ConversationVariableCollectionApi.get() from workflow_draft_variable.py L595-615.
   */
  async listConversationVariables(
    db: Database,
    appId: string,
    userId: string,
  ): Promise<VariableListWithValue> {
    const rows = await db
      .select()
      .from(workflowDraftVariables)
      .where(
        and(
          eq(workflowDraftVariables.appId, appId),
          eq(workflowDraftVariables.userId, userId),
          eq(workflowDraftVariables.nodeId, CONVERSATION_VARIABLE_NODE_ID),
        ),
      )

    const items: VariableItemWithValue[] = rows.map((row) => ({
      id: row.id,
      type: 'conversation',
      name: row.name,
      description: row.description,
      selector: safeJsonParse<string[]>(row.selector, []),
      value_type: row.valueType,
      value: safeJsonParse(row.value, null),
      edited: row.lastEditedAt != null,
      visible: row.visible,
      is_truncated: row.fileId != null,
      full_content: null,
    }))

    return { items }
  },

  /**
   * List system variables with values.
   * Mirrors Python SystemVariableCollectionApi.get() from workflow_draft_variable.py L654-664.
   */
  async listSystemVariables(
    db: Database,
    appId: string,
    userId: string,
  ): Promise<VariableListWithValue> {
    const rows = await db
      .select()
      .from(workflowDraftVariables)
      .where(
        and(
          eq(workflowDraftVariables.appId, appId),
          eq(workflowDraftVariables.userId, userId),
          eq(workflowDraftVariables.nodeId, SYSTEM_VARIABLE_NODE_ID),
        ),
      )

    const items: VariableItemWithValue[] = rows.map((row) => ({
      id: row.id,
      type: 'sys',
      name: row.name,
      description: row.description,
      selector: safeJsonParse<string[]>(row.selector, []),
      value_type: row.valueType,
      value: safeJsonParse(row.value, null),
      edited: row.lastEditedAt != null,
      visible: row.visible,
      is_truncated: row.fileId != null,
      full_content: null,
    }))

    return { items }
  },
}
