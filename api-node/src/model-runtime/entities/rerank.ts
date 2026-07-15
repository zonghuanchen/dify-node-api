/**
 * Rerank entity types.
 * Mirrors Python graphon.model_runtime.entities.rerank_entities.
 */

/** Input for multimodal rerank. */
export interface MultimodalRerankInput {
  content: string
  content_type: string
}

/** A single reranked document. */
export interface RerankDocument {
  index: number
  text: string
  score: number
}

/** Result of a rerank invocation. */
export interface RerankResult {
  model: string
  docs: RerankDocument[]
}
