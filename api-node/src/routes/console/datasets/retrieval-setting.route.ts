/**
 * Dataset retrieval setting route.
 * Mirrors Python api/controllers/console/datasets/datasets.py DatasetRetrievalSettingApi.
 *
 * GET /console/api/datasets/retrieval-setting
 *
 * Returns supported retrieval methods based on the configured vector store type.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { config } from '../../../config/index.js'
import type { AppEnv } from '../../../types/hono-env.js'

// Vector types that only support semantic search
const SEMANTIC_ONLY_TYPES = new Set([
  'relyt',
  'tidb_vector',
  'chroma',
  'pgvecto-rs',
  'vikingdb',
  'upstash',
])

// Vector types that support full search (semantic + full-text + hybrid)
const FULL_SEARCH_TYPES = new Set([
  'qdrant',
  'weaviate',
  'opensearch',
  'analyticdb',
  'myscale',
  'oracle',
  'elasticsearch',
  'elasticsearch-ja',
  'pgvector',
  'vastbase',
  'tidb_on_qdrant',
  'lindorm',
  'couchbase',
  'opengauss',
  'oceanbase',
  'seekdb',
  'tablestore',
  'huawei_cloud',
  'tencent',
  'matrixone',
  'clickzetta',
  'baidu',
  'alibabacloud_mysql',
  'iris',
  'hologres',
])

const SEMANTIC_METHODS = { retrieval_method: ['semantic_search'] }
const FULL_METHODS = { retrieval_method: ['semantic_search', 'full_text_search', 'hybrid_search'] }

function getRetrievalMethods(vectorType: string) {
  if (vectorType === 'milvus') {
    return FULL_METHODS
  }
  if (SEMANTIC_ONLY_TYPES.has(vectorType)) {
    return SEMANTIC_METHODS
  }
  if (FULL_SEARCH_TYPES.has(vectorType)) {
    return FULL_METHODS
  }
  // Default to full methods for unknown types to avoid breaking the UI
  return FULL_METHODS
}

export const retrievalSettingRoute = new Hono<AppEnv>()

retrievalSettingRoute.get(
  '/datasets/retrieval-setting',
  requireAuth,
  requireAccountInitialized,
  (c) => {
    const vectorType = config.vectorStore
    return c.json(getRetrievalMethods(vectorType))
  },
)
