/**
 * Model entity types for the model runtime.
 * Mirrors Python graphon.model_runtime.entities.model_entities.
 */

import type { I18nObject } from './common.js'

// ── Enums ────────────────────────────────────────────────────────

/** Canonical model type identifiers. */
export const ModelType = {
  LLM: 'llm',
  TEXT_EMBEDDING: 'text-embedding',
  RERANK: 'rerank',
  SPEECH2TEXT: 'speech2text',
  MODERATION: 'moderation',
  TTS: 'tts',
} as const
export type ModelType = (typeof ModelType)[keyof typeof ModelType]

/**
 * Mapping from canonical ModelType to the provider-native model type string.
 * Mirrors Python _ORIGIN_MODEL_TYPE_BY_MODEL_TYPE.
 */
const ORIGIN_MODEL_TYPE: Record<string, string> = {
  [ModelType.LLM]: 'text-generation',
  [ModelType.TEXT_EMBEDDING]: 'embeddings',
  [ModelType.RERANK]: 'reranking',
  [ModelType.SPEECH2TEXT]: 'speech2text',
  [ModelType.MODERATION]: 'moderation',
  [ModelType.TTS]: 'tts',
}

/** Reverse mapping: provider-native string -> canonical ModelType. */
const MODEL_TYPE_BY_ORIGIN: Record<string, string> = Object.fromEntries(
  Object.entries(ORIGIN_MODEL_TYPE).map(([k, v]) => [v, k]),
)

/** Convert a provider-native model type string to the canonical ModelType. */
export function fromOriginModelType(origin: string): ModelType | undefined {
  return MODEL_TYPE_BY_ORIGIN[origin] as ModelType | undefined
}

/** Convert a canonical ModelType to the provider-native model type string. */
export function toOriginModelType(modelType: ModelType): string {
  const origin = ORIGIN_MODEL_TYPE[modelType]
  if (!origin) throw new Error(`invalid model type ${modelType}`)
  return origin
}

/** How the model was sourced. */
export const FetchFrom = {
  PREDEFINED_MODEL: 'predefined-model',
  CUSTOMIZABLE_MODEL: 'customizable-model',
} as const
export type FetchFrom = (typeof FetchFrom)[keyof typeof FetchFrom]

/** LLM feature/capability flags. */
export const ModelFeature = {
  TOOL_CALL: 'tool-call',
  MULTI_TOOL_CALL: 'multi-tool-call',
  AGENT_THOUGHT: 'agent-thought',
  VISION: 'vision',
  STREAM_TOOL_CALL: 'stream-tool-call',
  DOCUMENT: 'document',
  VIDEO: 'video',
  AUDIO: 'audio',
  STRUCTURED_OUTPUT: 'structured-output',
  POLLING: 'polling',
} as const
export type ModelFeature = (typeof ModelFeature)[keyof typeof ModelFeature]

/** Well-known default parameter names. */
export const DefaultParameterName = {
  TEMPERATURE: 'temperature',
  TOP_P: 'top_p',
  TOP_K: 'top_k',
  PRESENCE_PENALTY: 'presence_penalty',
  FREQUENCY_PENALTY: 'frequency_penalty',
  MAX_TOKENS: 'max_tokens',
  RESPONSE_FORMAT: 'response_format',
  JSON_SCHEMA: 'json_schema',
} as const
export type DefaultParameterName = (typeof DefaultParameterName)[keyof typeof DefaultParameterName]

/** Parameter value types. */
export const ParameterType = {
  FLOAT: 'float',
  INT: 'int',
  STRING: 'string',
  BOOLEAN: 'boolean',
  TEXT: 'text',
} as const
export type ParameterType = (typeof ParameterType)[keyof typeof ParameterType]

/** Well-known model property keys. */
export const ModelPropertyKey = {
  MODE: 'mode',
  CONTEXT_SIZE: 'context_size',
  MAX_CHUNKS: 'max_chunks',
  FILE_UPLOAD_LIMIT: 'file_upload_limit',
  SUPPORTED_FILE_EXTENSIONS: 'supported_file_extensions',
  MAX_CHARACTERS_PER_CHUNK: 'max_characters_per_chunk',
  DEFAULT_VOICE: 'default_voice',
  VOICES: 'voices',
  WORD_LIMIT: 'word_limit',
  AUDIO_TYPE: 'audio_type',
  MAX_WORKERS: 'max_workers',
} as const
export type ModelPropertyKey = (typeof ModelPropertyKey)[keyof typeof ModelPropertyKey]

/** Price direction: input or output. */
export const PriceType = {
  INPUT: 'input',
  OUTPUT: 'output',
} as const
export type PriceType = (typeof PriceType)[keyof typeof PriceType]

// ── Prompt content type → required feature mapping ───────────────

/**
 * Mirrors Python _REQUIRED_MODEL_FEATURE_BY_CONTENT_TYPE.
 * Key is a PromptMessageContentType value, value is the ModelFeature required.
 */
export const REQUIRED_FEATURE_BY_CONTENT_TYPE: Partial<Record<string, ModelFeature>> = {
  image: ModelFeature.VISION,
  document: ModelFeature.DOCUMENT,
  video: ModelFeature.VIDEO,
  audio: ModelFeature.AUDIO,
}

// ── Interfaces ───────────────────────────────────────────────────

/** Pricing information for a model. */
export interface PriceConfig {
  input: number
  output?: number | null
  unit: number
  currency: string
}

/** Resolved price calculation result. */
export interface PriceInfo {
  unit_price: number
  unit: number
  total_amount: number
  currency: string
}

/** A single parameter rule for a model. */
export interface ParameterRule {
  name: string
  use_template?: string | null
  label: I18nObject
  type: ParameterType
  help?: I18nObject | null
  required?: boolean
  default?: unknown
  min?: number | null
  max?: number | null
  precision?: number | null
  options?: string[]
}

/** Base model descriptor exposed by a provider. */
export interface ProviderModel {
  model: string
  label: I18nObject
  model_type: ModelType
  features?: ModelFeature[] | null
  fetch_from: FetchFrom
  model_properties: Record<string, unknown>
  deprecated?: boolean
}

/**
 * Full AI model entity including parameter rules and pricing.
 * Extends ProviderModel with additional configuration.
 */
export interface AIModelEntity extends ProviderModel {
  parameter_rules?: ParameterRule[]
  pricing?: PriceConfig | null
}

/**
 * Check whether an AIModelEntity supports a given prompt content type.
 * Mirrors Python AIModelEntity.supports_prompt_content_type().
 */
export function supportsPromptContentType(
  entity: AIModelEntity,
  contentType: string,
): boolean {
  if (!entity.features?.length) {
    return contentType === 'text'
  }
  const requiredFeature = REQUIRED_FEATURE_BY_CONTENT_TYPE[contentType]
  return !requiredFeature || entity.features.includes(requiredFeature)
}

/**
 * Check whether an AIModelEntity declares STRUCTURED_OUTPUT support.
 * Mirrors Python ProviderModel.support_structure_output property.
 */
export function supportsStructureOutput(entity: ProviderModel): boolean {
  return !!entity.features?.includes(ModelFeature.STRUCTURED_OUTPUT)
}

/**
 * Check whether an AIModelEntity declares POLLING support.
 * Mirrors Python ProviderModel.support_polling property.
 */
export function supportsPolling(entity: ProviderModel): boolean {
  return !!entity.features?.includes(ModelFeature.POLLING)
}

/**
 * Derive STRUCTURED_OUTPUT feature from parameter_rules containing json_schema.
 * Mirrors Python AIModelEntity.validate_model model_validator.
 */
export function ensureStructuredOutputFeature(entity: AIModelEntity): void {
  const hasJsonSchemaRule = entity.parameter_rules?.some(r => r.name === 'json_schema')
  if (!hasJsonSchemaRule) return

  if (!entity.features) {
    entity.features = [ModelFeature.STRUCTURED_OUTPUT]
  }
  else if (!entity.features.includes(ModelFeature.STRUCTURED_OUTPUT)) {
    entity.features.push(ModelFeature.STRUCTURED_OUTPUT)
  }
}

/** Empty usage marker. */
export interface ModelUsage {
  // marker interface — subtypes add specific fields
}
