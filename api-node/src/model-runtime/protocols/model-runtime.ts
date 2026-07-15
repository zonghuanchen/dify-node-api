/**
 * Aggregate model runtime protocol.
 * Mirrors Python graphon.model_runtime.protocols.runtime.ModelRuntime.
 */

import type { LLMModelRuntime } from './llm-runtime.js'
import type { ModerationModelRuntime } from './moderation-runtime.js'
import type { RerankModelRuntime } from './rerank-runtime.js'
import type { SpeechToTextModelRuntime } from './speech-to-text-runtime.js'
import type { TextEmbeddingModelRuntime } from './embedding-runtime.js'
import type { TTSModelRuntime } from './tts-runtime.js'

/**
 * Aggregate runtime for adapters that implement every model capability.
 * Combines all individual runtime protocols into one interface.
 */
export type ModelRuntime =
  & LLMModelRuntime
  & TextEmbeddingModelRuntime
  & RerankModelRuntime
  & SpeechToTextModelRuntime
  & ModerationModelRuntime
  & TTSModelRuntime
