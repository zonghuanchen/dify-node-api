import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config/index.js'
import * as schema from './schema.js'

const client = postgres(config.databaseUrl, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export type Database = typeof db
