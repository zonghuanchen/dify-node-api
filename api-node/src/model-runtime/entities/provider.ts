/**
 * Provider entity types for the model runtime.
 * Mirrors Python graphon.model_runtime.entities.provider_entities.
 */

import type { I18nObject } from './common.js'
import type { AIModelEntity, ModelType } from './model.js'

// ── Enums ────────────────────────────────────────────────────────

/** How a provider can be configured. */
export const ConfigurateMethod = {
  PREDEFINED_MODEL: 'predefined-model',
  CUSTOMIZABLE_MODEL: 'customizable-model',
} as const
export type ConfigurateMethod = (typeof ConfigurateMethod)[keyof typeof ConfigurateMethod]

/** Credential form field type. */
export const FormType = {
  TEXT_INPUT: 'text-input',
  SECRET_INPUT: 'secret-input',
  SELECT: 'select',
  RADIO: 'radio',
  SWITCH: 'switch',
} as const
export type FormType = (typeof FormType)[keyof typeof FormType]

// ── Interfaces ───────────────────────────────────────────────────

/** Conditional visibility rule for a form field. */
export interface FormShowOnObject {
  variable: string
  value: string
}

/** A selectable option within a form field. */
export interface FormOption {
  label: I18nObject
  value: string
  show_on?: FormShowOnObject[]
}

/** Describes a single credential input field. */
export interface CredentialFormSchema {
  variable: string
  label: I18nObject
  type: FormType
  required?: boolean
  default?: string | null
  options?: FormOption[] | null
  placeholder?: I18nObject | null
  max_length?: number
  show_on?: FormShowOnObject[]
}

/** Provider-level credential schema (list of form fields). */
export interface ProviderCredentialSchema {
  credential_form_schemas: CredentialFormSchema[]
}

/** Label/placeholder descriptor for the model name field. */
export interface FieldModelSchema {
  label: I18nObject
  placeholder?: I18nObject | null
}

/** Model-level credential schema (includes model field descriptor + form fields). */
export interface ModelCredentialSchema {
  model: FieldModelSchema
  credential_form_schemas: CredentialFormSchema[]
}

/** Help link for a provider. */
export interface ProviderHelpEntity {
  title: I18nObject
  url: I18nObject
}

/**
 * Full runtime-native provider schema.
 * Mirrors Python ProviderEntity.
 */
export interface ProviderEntity {
  provider: string
  provider_name?: string
  label: I18nObject
  description?: I18nObject | null
  icon_small?: I18nObject | null
  icon_small_dark?: I18nObject | null
  background?: string | null
  help?: ProviderHelpEntity | null
  supported_model_types: ModelType[]
  configurate_methods: ConfigurateMethod[]
  models?: AIModelEntity[]
  provider_credential_schema?: ProviderCredentialSchema | null
  model_credential_schema?: ModelCredentialSchema | null
  position?: Record<string, string[]> | null
}

/** Simplified provider entity for external exposure. */
export interface SimpleProviderEntity {
  provider: string
  provider_name?: string
  label: I18nObject
  icon_small?: I18nObject | null
  supported_model_types: ModelType[]
  models: AIModelEntity[]
}

/** Provider config pairing (provider id + raw credentials). */
export interface ProviderConfig {
  provider: string
  credentials: Record<string, unknown>
}

/**
 * Convert a full ProviderEntity to its simplified public form.
 * Mirrors Python ProviderEntity.to_simple_provider().
 */
export function toSimpleProvider(entity: ProviderEntity): SimpleProviderEntity {
  return {
    provider: entity.provider,
    provider_name: entity.provider_name ?? '',
    label: entity.label,
    icon_small: entity.icon_small,
    supported_model_types: entity.supported_model_types,
    models: entity.models ?? [],
  }
}
