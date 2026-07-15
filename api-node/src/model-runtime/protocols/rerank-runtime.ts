/**
 * Rerank runtime protocol.
 * Mirrors Python graphon.model_runtime.protocols.rerank_runtime.
 */

import type { MultimodalRerankInput, RerankResult } from '../entities/rerank.js'
import type { ModelProviderRuntime } from './provider-runtime.js'

/** Runtime surface required by rerank model wrappers. */
export interface RerankModelRuntime extends ModelProviderRuntime {
  /** Invoke rerank for text inputs. */
  invokeRerank(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    query: string
    docs: string[]
    score_threshold?: number | null
    top_n?: number | null
    request_metadata?: Record<string, unknown> | null
  }): RerankResult | Promise<RerankResult>

  /** Invoke rerank for multimodal inputs. */
  invokeMultimodalRerank(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    query: MultimodalRerankInput
    docs: MultimodalRerankInput[]
    score_threshold?: number | null
    top_n?: number | null
    request_metadata?: Record<string, unknown> | null
  }): RerankResult | Promise<RerankResult>
}
