/**
 * Tag service — mirrors Python api/services/tag_service.py TagService.
 *
 * Provides tag listing with binding count aggregation.
 */

import { and, count, desc, eq, ilike, type SQL } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { tagBindings, tags } from '../db/schema.js'

// ── Types ────────────────────────────────────────────────────────

export interface TagResponse {
  id: string
  name: string
  type: string | null
  binding_count: string | null
}

// ── Helpers ──────────────────────────────────────────────────────

/** Escape special LIKE characters in user input. */
function escapeLike(s: string): string {
  return s.replace(/[%\\_]/g, '\\$&')
}

// ── Service ──────────────────────────────────────────────────────

export const tagService = {
  /**
   * Get tags for a tenant, optionally filtered by type and keyword.
   * Mirrors Python `TagService.get_tags()` from tag_service.py L44.
   *
   * Returns tags with their binding count (as a string to match Python behavior).
   */
  async getTags(
    db: Database,
    tenantId: string,
    type: string,
    keyword?: string,
  ): Promise<TagResponse[]> {
    const conditions: SQL[] = [
      eq(tags.tenantId, tenantId),
      eq(tags.type, type),
    ]

    if (keyword) {
      conditions.push(ilike(tags.name, `%${escapeLike(keyword)}%`))
    }

    const rows = await db
      .select({
        id: tags.id,
        name: tags.name,
        type: tags.type,
        bindingCount: count(tagBindings.id),
      })
      .from(tags)
      .leftJoin(tagBindings, eq(tags.id, tagBindings.tagId))
      .where(and(...conditions))
      .groupBy(tags.id, tags.type, tags.name, tags.createdAt)
      .orderBy(desc(tags.createdAt))

    if (!rows || !Array.isArray(rows)) {
      return []
    }

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      binding_count: String(r.bindingCount),
    }))
  },
}
