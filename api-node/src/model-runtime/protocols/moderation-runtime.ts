/**
 * Moderation runtime protocol.
 * Mirrors Python graphon.model_runtime.protocols.moderation_runtime.
 */

import type { ModelProviderRuntime } from './provider-runtime.js'

/** Runtime surface required by moderation model wrappers. */
export interface ModerationModelRuntime extends ModelProviderRuntime {
  /** Invoke moderation check and return whether the text is unsafe. */
  invokeModeration(params: {
    provider: string
    model: string
    credentials: Record<string, unknown>
    text: string
    request_metadata?: Record<string, unknown> | null
  }): boolean | Promise<boolean>
}
