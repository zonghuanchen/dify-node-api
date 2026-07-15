/**
 * Text embedding entity types.
 * Mirrors Python graphon.model_runtime.entities.text_embedding_entities.
 */

import type { ModelUsage } from './model.js'

// ── Enums ────────────────────────────────────────────────────────

/** Embedding request input variant. */
export const EmbeddingInputType = {
  DOCUMENT: 'document',
  QUERY: 'query',
} as const
export type EmbeddingInputType = (typeof EmbeddingInputType)[keyof typeof EmbeddingInputType]

// ── Interfaces ───────────────────────────────────────────────────

/** Token usage and pricing for an embedding invocation. */
export interface EmbeddingUsage extends ModelUsage {
  tokens: number
  total_tokens: number
  unit_price: number
  price_unit: number
  total_price: number
  currency: string
  latency: number
}

/** Result of a text embedding invocation. */
export interface EmbeddingResult {
  model: string
  embeddings: number[][]
  usage: EmbeddingUsage
}

/** Result of a file embedding invocation. */
export interface FileEmbeddingResult {
  model: string
  embeddings: number[][]
  usage: EmbeddingUsage
}
