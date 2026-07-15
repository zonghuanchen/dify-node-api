/**
 * LLM entity types.
 * Mirrors Python graphon.model_runtime.entities.llm_entities.
 */

import type { AssistantPromptMessage, PromptMessage } from './message.js'
import type { ModelUsage, PriceInfo } from './model.js'

// ── Enums ────────────────────────────────────────────────────────

/** LLM invocation mode. */
export const LLMMode = {
  COMPLETION: 'completion',
  CHAT: 'chat',
} as const
export type LLMMode = (typeof LLMMode)[keyof typeof LLMMode]

/** Polling lifecycle status. */
export const LLMPollingStatus = {
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const
export type LLMPollingStatus = (typeof LLMPollingStatus)[keyof typeof LLMPollingStatus]

// ── Usage ────────────────────────────────────────────────────────

/** Token usage and pricing metadata for an LLM response. */
export interface LLMUsage extends ModelUsage {
  prompt_tokens: number
  prompt_unit_price: number
  prompt_price_unit: number
  prompt_price: number
  completion_tokens: number
  completion_unit_price: number
  completion_price_unit: number
  completion_price: number
  total_tokens: number
  total_price: number
  currency: string
  latency: number
  time_to_first_token?: number | null
  time_to_generate?: number | null
}

/** Create an empty LLMUsage with zeroed fields. */
export function emptyUsage(): LLMUsage {
  return {
    prompt_tokens: 0,
    prompt_unit_price: 0,
    prompt_price_unit: 0,
    prompt_price: 0,
    completion_tokens: 0,
    completion_unit_price: 0,
    completion_price_unit: 0,
    completion_price: 0,
    total_tokens: 0,
    total_price: 0,
    currency: 'USD',
    latency: 0,
    time_to_first_token: null,
    time_to_generate: null,
  }
}

/**
 * Build LLMUsage from a raw metadata dictionary.
 * Mirrors Python LLMUsage.from_metadata().
 */
export function usageFromMetadata(metadata: Record<string, unknown>): LLMUsage {
  const get = <T>(key: string, fallback: T): T =>
    key in metadata ? (metadata[key] as T) : fallback

  const promptTokens = get('prompt_tokens', 0)
  const completionTokens = get('completion_tokens', 0)
  let totalTokens = get('total_tokens', 0)
  if (totalTokens === 0 && (promptTokens > 0 || completionTokens > 0)) {
    totalTokens = promptTokens + completionTokens
  }

  return {
    prompt_tokens: promptTokens,
    prompt_unit_price: Number(get('prompt_unit_price', 0)),
    prompt_price_unit: Number(get('prompt_price_unit', 0)),
    prompt_price: Number(get('prompt_price', 0)),
    completion_tokens: completionTokens,
    completion_unit_price: Number(get('completion_unit_price', 0)),
    completion_price_unit: Number(get('completion_price_unit', 0)),
    completion_price: Number(get('completion_price', 0)),
    total_tokens: totalTokens,
    total_price: Number(get('total_price', 0)),
    currency: String(get('currency', 'USD')),
    latency: Number(get('latency', 0)),
    time_to_first_token: get<number | null>('time_to_first_token', null),
    time_to_generate: get<number | null>('time_to_generate', null),
  }
}

/**
 * Add two LLMUsage instances together.
 * Mirrors Python LLMUsage.plus().
 */
export function plusUsage(a: LLMUsage, b: LLMUsage): LLMUsage {
  if (a.total_tokens === 0) return b
  return {
    prompt_tokens: a.prompt_tokens + b.prompt_tokens,
    prompt_unit_price: b.prompt_unit_price,
    prompt_price_unit: b.prompt_price_unit,
    prompt_price: a.prompt_price + b.prompt_price,
    completion_tokens: a.completion_tokens + b.completion_tokens,
    completion_unit_price: b.completion_unit_price,
    completion_price_unit: b.completion_price_unit,
    completion_price: a.completion_price + b.completion_price,
    total_tokens: a.total_tokens + b.total_tokens,
    total_price: a.total_price + b.total_price,
    currency: b.currency,
    latency: a.latency + b.latency,
    time_to_first_token: b.time_to_first_token,
    time_to_generate: b.time_to_generate,
  }
}

// ── Result types ─────────────────────────────────────────────────

/** Full LLM invocation result. */
export interface LLMResult {
  id?: string | null
  model: string
  prompt_messages?: PromptMessage[]
  message: AssistantPromptMessage
  usage: LLMUsage
  system_fingerprint?: string | null
  reasoning_content?: string | null
}

/** Structured output wrapper. */
export interface LLMStructuredOutput {
  structured_output?: Record<string, unknown> | null
}

/** LLM result with structured output. */
export interface LLMResultWithStructuredOutput extends LLMResult, LLMStructuredOutput {}

/** A single delta chunk in a streaming response. */
export interface LLMResultChunkDelta {
  index: number
  message: AssistantPromptMessage
  usage?: LLMUsage | null
  finish_reason?: string | null
}

/** A streaming response chunk. */
export interface LLMResultChunk {
  model: string
  prompt_messages?: PromptMessage[]
  system_fingerprint?: string | null
  delta: LLMResultChunkDelta
}

/** Streaming chunk with structured output. */
export interface LLMResultChunkWithStructuredOutput extends LLMResultChunk, LLMStructuredOutput {}

// ── Polling types ────────────────────────────────────────────────

/** Result of a polling operation. */
export interface LLMPollingResult {
  status: LLMPollingStatus
  plugin_state?: Record<string, unknown> | null
  result?: LLMResult | LLMResultWithStructuredOutput | null
  error?: string | null
  next_check_after_seconds?: number | null
  expires_after_seconds?: number | null
  max_attempts?: number | null
}

/** Configuration for polling behavior. */
export interface LLMPollingConfig {
  min_check_interval_seconds?: number
  max_check_interval_seconds?: number
  max_wait_seconds?: number
  max_attempts?: number
  wake_interval_seconds?: number
}

// ── Token counting ───────────────────────────────────────────────

/** Token count result with pricing metadata. */
export interface NumTokensResult extends PriceInfo {
  tokens: number
}
