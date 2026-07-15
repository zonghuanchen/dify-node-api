/**
 * Text embedding runtime protocol.
 * Mirrors Python graphon.model_runtime.protocols.text_embedding_runtime.
 */

import type { EmbeddingInputType, EmbeddingResult } from '../entities/embedding.js'
import type { ModelProviderRuntime } from './provider-runtime.js'

/** Runtime surface required by text and multimodal embedding wrappers. */
export interface TextEmbeddingModelRuntime extends ModelProviderRuntime {
  /** Invoke text embedding generation. */
  invokeTextEmbedding(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    texts: string[]
    input_type: EmbeddingInputType
    request_metadata?: Record<string, unknown> | null
  }): EmbeddingResult | Promise<EmbeddingResult>

  /** Invoke multimodal embedding generation. */
  invokeMultimodalEmbedding(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    documents: Record<string, unknown>[]
    input_type: EmbeddingInputType
    request_metadata?: Record<string, unknown> | null
  }): EmbeddingResult | Promise<EmbeddingResult>

  /** Count tokens for each text input. */
  getTextEmbeddingNumTokens(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    texts: string[]
  }): number[] | Promise<number[]>
}
