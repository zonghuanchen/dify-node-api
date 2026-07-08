import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accounts } from '../../db/schema.js'

/**
 * GET /ping-db
 * Development-only endpoint to verify database connectivity.
 * Returns the total count of accounts in the database.
 */
export const pingDbRoute = new Hono()

pingDbRoute.get('/ping-db', async (c) => {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)

    return c.json({
      status: 'ok',
      accountCount: result[0]?.count ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({
      status: 'error',
      message: `Database connection failed: ${message}`,
    }, 503)
  }
})
