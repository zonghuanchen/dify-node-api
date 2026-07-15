/**
 * Provider runtime protocol.
 * Mirrors Python graphon.model_runtime.protocols.provider_runtime.ModelProviderRuntime.
 */

import type { AIModelEntity, ModelType } from '../entities/model.js'
import type { ProviderEntity } from '../entities/provider.js'

/** Shared provider discovery, credential validation, and schema lookup. */
export interface ModelProviderRuntime {
  /** Discover all available model providers. */
  fetchModelProviders(): ProviderEntity[] | Promise<ProviderEntity[]>

  /** Retrieve a provider icon as raw bytes + MIME type. */
  getProviderIcon(params: {
    provider: string
    icon_type: string
    lang: string
  }): { data: Buffer; mime_type: string } | Promise<{ data: Buffer; mime_type: string }>

  /** Validate provider-level credentials (makes an API call to verify). */
  validateProviderCredentials(params: {
    provider: string
    credentials: Record<string, unknown>
  }): void | Promise<void>

  /** Validate model-level credentials. */
  validateModelCredentials(params: {
    provider: string
    model_type: ModelType
    model: string
    credentials: Record<string, unknown>
  }): void | Promise<void>

  /** Look up the resolved schema for a specific model. */
  getModelSchema(params: {
    provider: string
    model_type: ModelType
    model: string
    credentials: Record<string, unknown>
  }): AIModelEntity | null | Promise<AIModelEntity | null>
}
