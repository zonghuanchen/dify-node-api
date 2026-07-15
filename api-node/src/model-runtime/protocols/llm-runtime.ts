/**
 * LLM runtime protocol.
 * Mirrors Python graphon.model_runtime.protocols.llm_runtime.LLMModelRuntime.
 */

import type {
  LLMResult,
  LLMResultChunk,
  LLMResultChunkWithStructuredOutput,
  LLMResultWithStructuredOutput,
} from '../entities/llm.js'
import type { PromptMessage, PromptMessageTool } from '../entities/message.js'
import type { ModelType } from '../entities/model.js'
import type { ModelProviderRuntime } from './provider-runtime.js'

/** Parameters for an LLM invocation. */
export interface InvokeLlmParams {
  provider: string
  model: string
  credentials: Record<string, unknown>
  model_parameters: Record<string, unknown>
  prompt_messages: PromptMessage[]
  tools?: PromptMessageTool[] | null
  stop?: string[] | null
  stream: boolean
  request_metadata?: Record<string, unknown> | null
}

/** Parameters for an LLM invocation with structured output. */
export interface InvokeLlmWithStructuredOutputParams {
  provider: string
  model: string
  credentials: Record<string, unknown>
  json_schema: Record<string, unknown>
  model_parameters: Record<string, unknown>
  prompt_messages: PromptMessage[]
  stop?: string[] | null
  stream: boolean
}

/** Runtime surface required by LLM-backed model wrappers. */
export interface LLMModelRuntime extends ModelProviderRuntime {
  /** Invoke an LLM, returning a full result or async stream of chunks. */
  invokeLlm(
    params: InvokeLlmParams,
  ): LLMResult | AsyncGenerator<LLMResultChunk> | Promise<LLMResult | AsyncGenerator<LLMResultChunk>>

  /** Invoke an LLM with a JSON schema constraint on the output. */
  invokeLlmWithStructuredOutput(
    params: InvokeLlmWithStructuredOutputParams,
  ):
    | LLMResultWithStructuredOutput
    | AsyncGenerator<LLMResultChunkWithStructuredOutput>
    | Promise<LLMResultWithStructuredOutput | AsyncGenerator<LLMResultChunkWithStructuredOutput>>

  /** Count tokens for the given prompt messages and tools. */
  getLlmNumTokens(params: {
    provider: string
    model_type: ModelType
    model: string
    credentials: Record<string, unknown>
    prompt_messages: PromptMessage[]
    tools?: PromptMessageTool[] | null
  }): number | Promise<number>
}
