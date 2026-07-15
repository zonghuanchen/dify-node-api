/**
 * Speech-to-text runtime protocol.
 * Mirrors Python graphon.model_runtime.protocols.speech_to_text_runtime.
 */

import type { ModelProviderRuntime } from './provider-runtime.js'

/** Runtime surface required by speech-to-text model wrappers. */
export interface SpeechToTextModelRuntime extends ModelProviderRuntime {
  /** Invoke speech-to-text transcription. */
  invokeSpeechToText(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    file: Buffer | NodeJS.ReadableStream
    request_metadata?: Record<string, unknown> | null
  }): string | Promise<string>
}
