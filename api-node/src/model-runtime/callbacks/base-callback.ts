/**
 * Callback base class for LLM invocation lifecycle hooks.
 * Mirrors Python graphon.model_runtime.callbacks.base_callback.Callback.
 */

import type { LLMResult, LLMResultChunk } from '../entities/llm.js'
import type { PromptMessage, PromptMessageTool } from '../entities/message.js'
import type { AIModel } from '../model-providers/base/ai-model.js'

const TEXT_COLOR_MAPPING: Record<string, string> = {
  blue: '36;1',
  yellow: '33;1',
  pink: '38;5;200',
  green: '32;1',
  red: '31;1',
}

/** Shared context passed to every callback event. */
export interface CallbackContext {
  llmInstance: AIModel
  model: string
  credentials: Record<string, unknown>
  promptMessages: PromptMessage[]
  modelParameters: Record<string, unknown>
  tools?: PromptMessageTool[] | null
  stop?: string[] | null
  stream?: boolean
  user?: string | null
  requestMetadata?: Record<string, unknown> | null
}

/** Context for the on-new-chunk event. */
export interface NewChunkContext extends CallbackContext {
  chunk: LLMResultChunk
}

/** Context for the on-after-invoke event. */
export interface AfterInvokeContext extends CallbackContext {
  result: LLMResult
}

/** Context for the on-invoke-error event. */
export interface InvokeErrorContext extends CallbackContext {
  ex: unknown
}

/**
 * Base class for LLM lifecycle callbacks.
 * Set `raiseError` to true to propagate callback errors instead of logging.
 */
export abstract class Callback {
  raiseError = false

  /** Invoked before the LLM call is dispatched. */
  abstract onBeforeInvoke(context: CallbackContext): void

  /** Invoked for each streamed chunk. */
  abstract onNewChunk(context: NewChunkContext): void

  /** Invoked after a successful LLM call completes. */
  abstract onAfterInvoke(context: AfterInvokeContext): void

  /** Invoked when the LLM call raises an error. */
  abstract onInvokeError(context: InvokeErrorContext): void

  /** Print text with optional ANSI color highlighting and no trailing newline. */
  printText(text: string, color?: string, end = ''): void {
    const textToPrint = color ? this.getColoredText(text, color) : text
    process.stdout.write(textToPrint + end)
  }

  private getColoredText(text: string, color: string): string {
    const colorStr = TEXT_COLOR_MAPPING[color] ?? '0'
    return `\u001b[${colorStr}m\u001b[1;3m${text}\u001b[0m`
  }
}
