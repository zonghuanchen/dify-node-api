/**
 * Trigger service — mirrors Python api/controllers/console/app/workflow_trigger.py
 * AppTriggersApi.
 *
 * GET /console/api/apps/{appId}/triggers
 */

import { and, desc, eq } from 'drizzle-orm'
import { config } from '../config/index.js'
import type { Database } from '../db/index.js'
import { appTriggers } from '../db/schema.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a Date to Unix timestamp (seconds), or null. */
function toTimestamp(value: Date | null | undefined): number | null {
  if (!value) return null
  return Math.floor(value.getTime() / 1000)
}

// ── Response types ───────────────────────────────────────────────────────────

export interface TriggerResponse {
  id: string
  trigger_type: string
  title: string
  node_id: string
  provider_name: string
  icon: string
  status: string
  created_at: number | null
  updated_at: number | null
}

export interface TriggerListResponse {
  data: TriggerResponse[]
}

// ── Service ──────────────────────────────────────────────────────────────────

export const triggerService = {
  /**
   * Get all triggers for an app.
   * Mirrors Python AppTriggersApi.get() from workflow_trigger.py L128-164.
   */
  async getTriggers(
    db: Database,
    tenantId: string,
    appId: string,
  ): Promise<TriggerListResponse> {
    const triggers = await db
      .select()
      .from(appTriggers)
      .where(
        and(
          eq(appTriggers.tenantId, tenantId),
          eq(appTriggers.appId, appId),
        ),
      )
      .orderBy(desc(appTriggers.createdAt), desc(appTriggers.id))

    const urlPrefix = `${config.consoleApiUrl}/console/api/workspaces/current/tool-provider/builtin/`

    const data: TriggerResponse[] = triggers.map((trigger) => {
      const icon = trigger.triggerType === 'trigger-plugin'
        ? `${urlPrefix}${trigger.providerName || ''}/icon`
        : ''

      return {
        id: String(trigger.id),
        trigger_type: String(trigger.triggerType),
        title: String(trigger.title),
        node_id: String(trigger.nodeId || ''),
        provider_name: String(trigger.providerName || ''),
        icon,
        status: String(trigger.status),
        created_at: toTimestamp(trigger.createdAt),
        updated_at: toTimestamp(trigger.updatedAt),
      }
    })

    return { data }
  },
}
