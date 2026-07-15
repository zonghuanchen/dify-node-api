/**
 * Text-to-speech runtime protocol.
 * Mirrors Python graphon.model_runtime.protocols.tts_runtime.
 */

import type { ModelProviderRuntime } from './provider-runtime.js'

/** Runtime surface required by TTS model wrappers. */
export interface TTSModelRuntime extends ModelProviderRuntime {
  /** Invoke TTS and return an async iterable of audio byte chunks. */
  invokeTts(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    content_text: string
    voice: string
    request_metadata?: Record<string, unknown> | null
  }): AsyncGenerator<Buffer> | Promise<AsyncGenerator<Buffer>>

  /** Retrieve the voices supported by a TTS model. */
  getTtsModelVoices(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    language?: string | null
  }): unknown | Promise<unknown>
}
