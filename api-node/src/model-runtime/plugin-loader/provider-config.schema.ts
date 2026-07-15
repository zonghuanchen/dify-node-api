/**
 * Zod schemas for provider JSON config files.
 * These validate external plugin config input at load time.
 */

import { z } from 'zod'

// ── Shared primitives ────────────────────────────────────────────

const i18nObjectSchema = z.object({
  en_US: z.string(),
  zh_Hans: z.string().nullish(),
}).passthrough()

const formShowOnSchema = z.object({
  variable: z.string(),
  value: z.string(),
})

const formOptionSchema = z.object({
  label: i18nObjectSchema,
  value: z.string(),
  show_on: z.array(formShowOnSchema).optional(),
})

const credentialFormSchema = z.object({
  variable: z.string(),
  label: i18nObjectSchema,
  type: z.enum(['text-input', 'secret-input', 'select', 'radio', 'switch']),
  required: z.boolean().optional(),
  default: z.string().nullish(),
  options: z.array(formOptionSchema).nullish(),
  placeholder: i18nObjectSchema.nullish(),
  max_length: z.number().optional(),
  show_on: z.array(formShowOnSchema).optional(),
})

const providerCredentialSchema = z.object({
  credential_form_schemas: z.array(credentialFormSchema),
})

const fieldModelSchema = z.object({
  label: i18nObjectSchema,
  placeholder: i18nObjectSchema.nullish(),
})

const modelCredentialSchema = z.object({
  model: fieldModelSchema,
  credential_form_schemas: z.array(credentialFormSchema),
})

const providerHelpSchema = z.object({
  title: i18nObjectSchema,
  url: i18nObjectSchema,
})

// ── Model config ─────────────────────────────────────────────────

const modelType = z.enum(['llm', 'text-embedding', 'rerank', 'speech2text', 'moderation', 'tts'])

const parameterRuleSchema = z.object({
  name: z.string(),
  use_template: z.string().nullish(),
  label: i18nObjectSchema,
  type: z.enum(['int', 'float', 'string', 'boolean', 'text']),
  help: i18nObjectSchema.nullish(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  min: z.number().nullish(),
  max: z.number().nullish(),
  precision: z.number().nullish(),
  options: z.array(z.string()).optional(),
})

const priceConfigSchema = z.object({
  input: z.number(),
  output: z.number().nullish(),
  unit: z.number(),
  currency: z.string(),
})

const modelConfigSchema = z.object({
  model: z.string(),
  label: i18nObjectSchema,
  model_type: modelType,
  features: z.array(z.string()).nullish(),
  fetch_from: z.string().default('predefined-model'),
  model_properties: z.record(z.string(), z.unknown()).default({}),
  deprecated: z.boolean().optional(),
  parameter_rules: z.array(parameterRuleSchema).optional(),
  pricing: priceConfigSchema.nullish(),
})

// ── Provider config (top-level file schema) ──────────────────────

/** Zod schema for a single `provider.json` config file. */
export const providerConfigSchema = z.object({
  provider: z.string(),
  provider_name: z.string().optional(),
  label: i18nObjectSchema,
  description: i18nObjectSchema.nullish(),
  icon_small: i18nObjectSchema.nullish(),
  icon_small_dark: i18nObjectSchema.nullish(),
  background: z.string().nullish(),
  help: providerHelpSchema.nullish(),
  supported_model_types: z.array(modelType),
  configurate_methods: z.array(z.enum(['predefined-model', 'customizable-model'])),
  models: z.array(modelConfigSchema).optional(),
  provider_credential_schema: providerCredentialSchema.nullish(),
  model_credential_schema: modelCredentialSchema.nullish(),
  position: z.record(z.string(), z.array(z.string())).nullish(),
})

/** Parsed and validated provider config file. */
export type ProviderConfigFile = z.infer<typeof providerConfigSchema>
