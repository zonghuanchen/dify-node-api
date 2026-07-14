/**
 * Workflow comments service — mirrors Python api/controllers/console/app/workflow_comment.py
 * and api/services/workflow_comment_service.py.
 *
 * Handles listing workflow comments with related replies, mentions, and participants.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { accounts, workflowCommentMentions, workflowCommentReplies, workflowComments } from '../db/schema.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a Date to Unix timestamp (seconds), returns null if not set. */
function toTimestamp(value: Date | null | undefined): number | null {
  if (!value) return null
  return Math.floor(value.getTime() / 1000)
}

/** Build avatar URL from avatar field. */
function buildAvatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) return null
  return avatar
}

// ── Response types ───────────────────────────────────────────────────────────

interface CommentAccount {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

interface CommentBasic {
  id: string
  position_x: number
  position_y: number
  content: string
  created_by: string
  created_by_account: CommentAccount | null
  created_at: number | null
  updated_at: number | null
  resolved: boolean
  resolved_at: number | null
  resolved_by: string | null
  resolved_by_account: CommentAccount | null
  reply_count: number
  mention_count: number
  participants: CommentAccount[]
}

interface CommentListResponse {
  data: CommentBasic[]
}

// ── Service ──────────────────────────────────────────────────────────────────

export const workflowCommentsService = {
  /**
   * Get all comments for a workflow app.
   * Mirrors Python WorkflowCommentListApi.get() from workflow_comment.py L214-232.
   */
  async getComments(
    db: Database,
    tenantId: string,
    appId: string,
  ): Promise<CommentListResponse> {
    // 1. Fetch all comments for this app
    const comments = await db
      .select()
      .from(workflowComments)
      .where(
        and(
          eq(workflowComments.tenantId, tenantId),
          eq(workflowComments.appId, appId),
        ),
      )

    if (comments.length === 0) {
      return { data: [] }
    }

    const commentIds = comments.map((c) => c.id)

    // 2. Fetch all replies for these comments
    const replies = await db
      .select()
      .from(workflowCommentReplies)
      .where(inArray(workflowCommentReplies.commentId, commentIds))

    // 3. Fetch all mentions for these comments
    const mentions = await db
      .select()
      .from(workflowCommentMentions)
      .where(inArray(workflowCommentMentions.commentId, commentIds))

    // 4. Collect all unique account IDs (creators, repliers, mentioned users, resolvers)
    const accountIds = new Set<string>()
    for (const c of comments) {
      accountIds.add(c.createdBy)
      if (c.resolvedBy) accountIds.add(c.resolvedBy)
    }
    for (const r of replies) {
      accountIds.add(r.createdBy)
    }
    for (const m of mentions) {
      accountIds.add(m.mentionedUserId)
    }

    // 5. Batch-fetch all accounts
    const accountMap = new Map<string, CommentAccount>()
    if (accountIds.size > 0) {
      const accountRows = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          email: accounts.email,
          avatar: accounts.avatar,
        })
        .from(accounts)
        .where(inArray(accounts.id, [...accountIds]))

      for (const a of accountRows) {
        accountMap.set(a.id, {
          id: a.id,
          name: a.name,
          email: a.email,
          avatar_url: buildAvatarUrl(a.avatar),
        })
      }
    }

    // 6. Group replies and mentions by comment_id
    const repliesByComment = new Map<string, typeof replies>()
    for (const r of replies) {
      const list = repliesByComment.get(r.commentId) ?? []
      list.push(r)
      repliesByComment.set(r.commentId, list)
    }

    const mentionsByComment = new Map<string, typeof mentions>()
    for (const m of mentions) {
      const list = mentionsByComment.get(m.commentId) ?? []
      list.push(m)
      mentionsByComment.set(m.commentId, list)
    }

    // 7. Build response
    const data: CommentBasic[] = comments.map((c) => {
      const commentReplies = repliesByComment.get(c.id) ?? []
      const commentMentions = mentionsByComment.get(c.id) ?? []

      // Compute participants (unique accounts involved)
      const participantIds = new Set<string>()
      const participants: CommentAccount[] = []

      // Add creator
      participantIds.add(c.createdBy)
      const creatorAccount = accountMap.get(c.createdBy)
      if (creatorAccount) participants.push(creatorAccount)

      // Add repliers
      for (const r of commentReplies) {
        if (!participantIds.has(r.createdBy)) {
          participantIds.add(r.createdBy)
          const replyAccount = accountMap.get(r.createdBy)
          if (replyAccount) participants.push(replyAccount)
        }
      }

      // Add mentioned users
      for (const m of commentMentions) {
        if (!participantIds.has(m.mentionedUserId)) {
          participantIds.add(m.mentionedUserId)
          const mentionAccount = accountMap.get(m.mentionedUserId)
          if (mentionAccount) participants.push(mentionAccount)
        }
      }

      return {
        id: c.id,
        position_x: c.positionX,
        position_y: c.positionY,
        content: c.content,
        created_by: c.createdBy,
        created_by_account: accountMap.get(c.createdBy) ?? null,
        created_at: toTimestamp(c.createdAt),
        updated_at: toTimestamp(c.updatedAt),
        resolved: c.resolved,
        resolved_at: toTimestamp(c.resolvedAt),
        resolved_by: c.resolvedBy ?? null,
        resolved_by_account: c.resolvedBy ? (accountMap.get(c.resolvedBy) ?? null) : null,
        reply_count: commentReplies.length,
        mention_count: commentMentions.length,
        participants,
      }
    })

    return { data }
  },
}
