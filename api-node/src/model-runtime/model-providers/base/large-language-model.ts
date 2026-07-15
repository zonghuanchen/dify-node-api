/**
 * LargeLanguageModel base class.
 * Mirrors Python graphon.model_runtime.model_providers.base.large_language_model.
 */

import { randomUUID } from 'node:crypto'

import type { LLMResult, LLMResultChunk, LLMUsage } from '../../entities/llm.js'
import { emptyUsage } from '../../entities/llm.js'
import type {
  AssistantPromptMessage,
  PromptMessage,
  PromptMessageContentUnion,
  PromptMessageTool,
  ToolCall,
} from '../../entities/message.js'
import { PromptMessageContentType, PromptMessageRole } from '../../entities/message.js'
import type { ModelType } from '../../entities/model.js'
import { ModelType as ModelTypeConst, PriceType } from '../../entities/model.js'
import type { LLMModelRuntime } from '../../protocols/llm-runtime.js'
import type {
  AfterInvokeContext,
  Callback,
  CallbackContext,
  InvokeErrorContext,
  NewChunkContext,
} from '../../callbacks/base-callback.js'
import { AIModel } from './ai-model.js'

// ── Tool call merge utilities ────────────────────────────────────

/** Generate a synthetic tool call ID. */
export function generateToolCallId(): string {
  return `chatcmpl-tool-${randomUUID().replace(/-/g, '')}`
}

function getOrCreateToolCall(existingToolCalls: ToolCall[], toolCallId: string): ToolCall {
  if (!toolCallId) {
    const last = existingToolCalls[existingToolCalls.length - 1]
    if (!last) {
      throw new Error(
        'tool_call_id is empty but no existing tool call is available to apply the delta',
      )
    }
    return last
  }

  let toolCall = existingToolCalls.find(tc => tc.id === toolCallId)
  if (!toolCall) {
    toolCall = { id: toolCallId, type: 'function', function: { name: '', arguments: '' } }
    existingToolCalls.push(toolCall)
  }
  return toolCall
}

function mergeToolCallDelta(toolCall: ToolCall, delta: ToolCall): void {
  if (delta.id) toolCall.id = delta.id
  if (delta.type) toolCall.type = delta.type
  if (delta.function.name) toolCall.function.name = delta.function.name
  if (delta.function.arguments) toolCall.function.arguments += delta.function.arguments
}

/** Merge incremental tool call deltas into existing tool calls in place. */
export function mergeToolCallDeltas(
  newToolCalls: ToolCall[],
  existingToolCalls: ToolCall[],
  idGenerator: () => string = generateToolCallId,
): void {
  for (const newToolCall of newToolCalls) {
    if (newToolCall.function.name && !newToolCall.id) {
      newToolCall.id = idGenerator()
    }
    const toolCall = getOrCreateToolCall(existingToolCalls, newToolCall.id)
    mergeToolCallDelta(toolCall, newToolCall)
  }
}

// ── Chunk accumulators ───────────────────────────────────────────

class LLMChunkAccumulator {
  content = ''
  contentList: PromptMessageContentUnion[] = []
  usage: LLMUsage = emptyUsage()
  systemFingerprint: string | null = null
  toolCalls: ToolCall[] = []

  consume(chunk: LLMResultChunk): void {
    this.consumeContent(chunk)
    if (chunk.delta.message.tool_calls?.length) {
      mergeToolCallDeltas(chunk.delta.message.tool_calls, this.toolCalls)
    }
    if (chunk.delta.usage) this.usage = chunk.delta.usage
    if (chunk.system_fingerprint) this.systemFingerprint = chunk.system_fingerprint
  }

  private consumeContent(chunk: LLMResultChunk): void {
    const content = chunk.delta.message.content
    if (typeof content === 'string') this.content += content
    else if (Array.isArray(content)) this.contentList.push(...content)
  }

  toResult(model: string, promptMessages: PromptMessage[]): LLMResult {
    const message: AssistantPromptMessage = {
      role: PromptMessageRole.ASSISTANT,
      content: this.content || this.contentList,
      tool_calls: this.toolCalls,
    }
    return {
      model,
      prompt_messages: promptMessages,
      message,
      usage: this.usage,
      system_fingerprint: this.systemFingerprint,
    }
  }
}

class StreamingInvokeAccumulator {
  realModel: string
  messageContent: PromptMessageContentUnion[] = []
  usage: LLMUsage | null = null
  systemFingerprint: string | null = null

  constructor(realModel: string) {
    this.realModel = realModel
  }

  consume(chunk: LLMResultChunk): void {
    this.consumeContent(chunk.delta.message.content)
    this.realModel = chunk.model
    if (chunk.delta.usage) this.usage = chunk.delta.usage
    if (chunk.system_fingerprint) this.systemFingerprint = chunk.system_fingerprint
  }

  private consumeContent(content: string | PromptMessageContentUnion[] | null | undefined): void {
    if (!content) return
    if (Array.isArray(content)) {
      this.messageContent.push(...content)
      return
    }
    this.messageContent.push({ type: PromptMessageContentType.TEXT, data: content })
  }

  toResult(promptMessages: PromptMessage[]): LLMResult {
    const message: AssistantPromptMessage = {
      role: PromptMessageRole.ASSISTANT,
      content: this.messageContent,
    }
    return {
      model: this.realModel,
      prompt_messages: promptMessages,
      message,
      usage: this.usage ?? emptyUsage(),
      system_fingerprint: this.systemFingerprint,
    }
  }
}

// ── Result normalization ─────────────────────────────────────────

function isAsyncGenerator(value: unknown): value is AsyncGenerator<LLMResultChunk> {
  return (
    value != null
    && typeof value === 'object'
    && Symbol.asyncIterator in value
    && typeof (value as AsyncGenerator<LLMResultChunk>).next === 'function'
  )
}

async function buildLLMResultFromChunks(
  model: string,
  promptMessages: PromptMessage[],
  chunks: AsyncGenerator<LLMResultChunk>,
): Promise<LLMResult> {
  const accumulator = new LLMChunkAccumulator()
  try {
    for await (const chunk of chunks) {
      accumulator.consume(chunk)
    }
  }
  catch (error) {
    console.error('Error while consuming non-stream plugin chunk iterator.', error)
    throw error
  }
  finally {
    await chunks.return?.(undefined)
  }
  return accumulator.toResult(model, promptMessages)
}

async function normalizeNonStreamRuntimeResult(
  model: string,
  promptMessages: PromptMessage[],
  result: LLMResult | AsyncGenerator<LLMResultChunk>,
): Promise<LLMResult> {
  if (isAsyncGenerator(result)) {
    return buildLLMResultFromChunks(model, promptMessages, result)
  }
  return result
}

// ── Callback runner ──────────────────────────────────────────────

function runCallbacks(
  callbacks: Callback[] | undefined,
  event: string,
  invoke: (callback: Callback) => void,
): void {
  if (!callbacks?.length) return
  for (const callback of callbacks) {
    try {
      invoke(callback)
    }
    catch (error) {
      if (callback.raiseError) throw error
      console.warn(`Callback ${callback.constructor.name} ${event} failed with error`, error)
    }
  }
}

// ── Public invoke params ─────────────────────────────────────────

/** Parameters for the public LargeLanguageModel.invoke() API. */
export interface LlmInvokeParams {
  model: string
  credentials: Record<string, unknown>
  promptMessages: PromptMessage[]
  modelParameters?: Record<string, unknown> | null
  tools?: PromptMessageTool[] | null
  stop?: string[] | null
  stream?: boolean
  callbacks?: Callback[] | null
  requestMetadata?: Record<string, unknown> | null
}

/** Model class for large language model. */
export class LargeLanguageModel extends AIModel<LLMModelRuntime> {
  readonly modelType: ModelType = ModelTypeConst.LLM

  /** Invoke the large language model and optionally stream result chunks. */
  async invoke(params: LlmInvokeParams): Promise<LLMResult | AsyncGenerator<LLMResultChunk>> {
    const {
      model,
      credentials,
      promptMessages,
      tools,
      stop,
      stream = true,
      requestMetadata,
    } = params
    const modelParameters = params.modelParameters ?? {}
    const callbacks = params.callbacks ? [...params.callbacks] : []

    this.startedAt = performance.now() / 1000

    const context: CallbackContext = {
      llmInstance: this,
      model,
      credentials,
      promptMessages,
      modelParameters,
      tools,
      stop,
      stream,
      requestMetadata,
    }

    runCallbacks(callbacks, 'on_before_invoke', cb => cb.onBeforeInvoke(context))

    let result: LLMResult | AsyncGenerator<LLMResultChunk>
    try {
      const invoked = await this.modelRuntime.invokeLlm({
        provider: this.provider,
        model,
        credentials,
        model_parameters: modelParameters,
        prompt_messages: promptMessages,
        tools,
        stop,
        stream,
        request_metadata: requestMetadata,
      })

      result = stream
        ? invoked
        : await normalizeNonStreamRuntimeResult(model, promptMessages, invoked)
    }
    catch (error) {
      const errorContext: InvokeErrorContext = { ...context, ex: error }
      runCallbacks(callbacks, 'on_invoke_error', cb => cb.onInvokeError(errorContext))
      throw this.transformInvokeError(error)
    }

    if (stream && isAsyncGenerator(result)) {
      return this.invokeResultGenerator(result, context, callbacks)
    }

    if (!isAsyncGenerator(result)) {
      const afterContext: AfterInvokeContext = { ...context, result }
      runCallbacks(callbacks, 'on_after_invoke', cb => cb.onAfterInvoke(afterContext))
      // Ensure prompt_messages are present (removed on the plugin daemon side).
      result.prompt_messages = promptMessages
      return result
    }

    throw new Error('unsupported invoke result type')
  }

  private async *invokeResultGenerator(
    result: AsyncGenerator<LLMResultChunk>,
    context: CallbackContext,
    callbacks: Callback[],
  ): AsyncGenerator<LLMResultChunk> {
    const accumulator = new StreamingInvokeAccumulator(context.model)

    try {
      for await (const chunk of result) {
        // Ensure prompt_messages are present (removed on the plugin daemon side).
        chunk.prompt_messages = context.promptMessages
        yield chunk

        const chunkContext: NewChunkContext = { ...context, chunk }
        runCallbacks(callbacks, 'on_new_chunk', cb => cb.onNewChunk(chunkContext))
        accumulator.consume(chunk)
      }
    }
    catch (error) {
      throw this.transformInvokeError(error)
    }

    const afterContext: AfterInvokeContext = {
      ...context,
      result: accumulator.toResult(context.promptMessages),
    }
    runCallbacks(callbacks, 'on_after_invoke', cb => cb.onAfterInvoke(afterContext))
  }

  /** Count prompt tokens for the given messages and optional tools. */
  async getNumTokens(
    model: string,
    credentials: Record<string, unknown>,
    promptMessages: PromptMessage[],
    tools?: PromptMessageTool[] | null,
  ): Promise<number> {
    return this.modelRuntime.getLlmNumTokens({
      provider: this.provider,
      model_type: this.modelType,
      model,
      credentials,
      prompt_messages: promptMessages,
      tools,
    })
  }

  /** Calculate unified usage and pricing metadata for a response. */
  calcResponseUsage(
    model: string,
    credentials: Record<string, unknown>,
    promptTokens: number,
    completionTokens: number,
  ): LLMUsage {
    const promptPriceInfo = this.getPrice(model, credentials, PriceType.INPUT, promptTokens)
    const completionPriceInfo = this.getPrice(model, credentials, PriceType.OUTPUT, completionTokens)

    return {
      prompt_tokens: promptTokens,
      prompt_unit_price: promptPriceInfo.unit_price,
      prompt_price_unit: promptPriceInfo.unit,
      prompt_price: promptPriceInfo.total_amount,
      completion_tokens: completionTokens,
      completion_unit_price: completionPriceInfo.unit_price,
      completion_price_unit: completionPriceInfo.unit,
      completion_price: completionPriceInfo.total_amount,
      total_tokens: promptTokens + completionTokens,
      total_price: promptPriceInfo.total_amount + completionPriceInfo.total_amount,
      currency: promptPriceInfo.currency,
      latency: performance.now() / 1000 - this.startedAt,
      time_to_first_token: null,
      time_to_generate: null,
    }
  }
}
