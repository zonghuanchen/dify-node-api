/**
 * PromptMessageMemory port for loading conversation history as prompt messages.
 * Mirrors Python graphon.model_runtime.memory.prompt_message_memory.
 */

import type { PromptMessage } from '../entities/message.js'

/** Default maximum token budget for loaded memory. */
export const DEFAULT_MEMORY_MAX_TOKEN_LIMIT = 2000

/** Port for loading memory as prompt messages. */
export interface PromptMessageMemory {
  /** Return historical prompt messages constrained by token/message limits. */
  getHistoryPromptMessages(
    maxTokenLimit?: number,
    messageLimit?: number | null,
  ): PromptMessage[] | Promise<PromptMessage[]>
}
