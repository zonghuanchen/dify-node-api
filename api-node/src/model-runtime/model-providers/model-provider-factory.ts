/**
 * ModelProviderFactory: provider schemas and credential flows backed by a runtime.
 * Mirrors Python graphon.model_runtime.model_providers.model_provider_factory.
 */

import type { AIModelEntity, ModelType } from '../entities/model.js'
import type { ProviderEntity, SimpleProviderEntity } from '../entities/provider.js'
import { toSimpleProvider } from '../entities/provider.js'
import type { ModelProviderRuntime } from '../protocols/provider-runtime.js'
import { ModelCredentialSchemaValidator } from '../schema-validators/model-credential-validator.js'
import { ProviderCredentialSchemaValidator } from '../schema-validators/provider-credential-validator.js'

/** Factory for provider schemas and credential flows backed by a runtime. */
export class ModelProviderFactory {
  private readonly runtime: ModelProviderRuntime

  constructor(runtime: ModelProviderRuntime) {
    if (!runtime) {
      throw new Error('runtime is required.')
    }
    this.runtime = runtime
  }

  /** Get all providers. */
  async getProviders(): Promise<ProviderEntity[]> {
    return this.getModelProviders()
  }

  /** Get all model providers exposed by the runtime adapter. */
  async getModelProviders(): Promise<ProviderEntity[]> {
    return this.runtime.fetchModelProviders()
  }

  /** Get provider schema. */
  async getProviderSchema(provider: string): Promise<ProviderEntity> {
    return this.getModelProvider(provider)
  }

  /** Get provider schema, throwing if the provider is unknown. */
  async getModelProvider(provider: string): Promise<ProviderEntity> {
    const providerEntity = await this.resolveProvider(provider)
    if (!providerEntity) {
      throw new Error(`Invalid provider: ${provider}`)
    }
    return providerEntity
  }

  /** Validate provider credentials and return the filtered credential map. */
  async providerCredentialsValidate(params: {
    provider: string
    credentials: Record<string, unknown>
  }): Promise<Record<string, string | boolean>> {
    const providerEntity = await this.getModelProvider(params.provider)

    const providerCredentialSchema = providerEntity.provider_credential_schema
    if (!providerCredentialSchema) {
      throw new Error(`Provider ${params.provider} does not have provider_credential_schema`)
    }

    const validator = new ProviderCredentialSchemaValidator(providerCredentialSchema)
    const filteredCredentials = validator.validateAndFilter(params.credentials)

    await this.runtime.validateProviderCredentials({
      provider: providerEntity.provider,
      credentials: filteredCredentials,
    })

    return filteredCredentials
  }

  /** Validate model credentials and return the filtered credential map. */
  async modelCredentialsValidate(params: {
    provider: string
    modelType: ModelType
    model: string
    credentials: Record<string, unknown>
  }): Promise<Record<string, string | boolean>> {
    const providerEntity = await this.getModelProvider(params.provider)

    const modelCredentialSchema = providerEntity.model_credential_schema
    if (!modelCredentialSchema) {
      throw new Error(`Provider ${params.provider} does not have model_credential_schema`)
    }

    const validator = new ModelCredentialSchemaValidator(params.modelType, modelCredentialSchema)
    const filteredCredentials = validator.validateAndFilter(params.credentials)

    await this.runtime.validateModelCredentials({
      provider: providerEntity.provider,
      model_type: params.modelType,
      model: params.model,
      credentials: filteredCredentials,
    })

    return filteredCredentials
  }

  /** Get model schema. */
  async getModelSchema(params: {
    provider: string
    modelType: ModelType
    model: string
    credentials?: Record<string, unknown> | null
  }): Promise<AIModelEntity | null> {
    const providerEntity = await this.getModelProvider(params.provider)
    return this.runtime.getModelSchema({
      provider: providerEntity.provider,
      model_type: params.modelType,
      model: params.model,
      credentials: params.credentials ?? {},
    })
  }

  /** Get all models for a given model type. */
  async getModels(params?: {
    provider?: string | null
    modelType?: ModelType | null
  }): Promise<SimpleProviderEntity[]> {
    const provider = params?.provider ?? null
    const modelType = params?.modelType ?? null

    const providers: SimpleProviderEntity[] = []
    for (const providerEntity of await this.getModelProviders()) {
      if (provider && !ModelProviderFactory.matchesProvider(providerEntity, provider)) {
        continue
      }
      if (modelType && !providerEntity.supported_model_types.includes(modelType)) {
        continue
      }

      const simpleProviderSchema = toSimpleProvider(providerEntity)
      if (modelType != null) {
        simpleProviderSchema.models = (providerEntity.models ?? []).filter(
          modelSchema => modelSchema.model_type === modelType,
        )
      }
      providers.push(simpleProviderSchema)
    }

    return providers
  }

  /** Get provider icon as raw bytes + MIME type. */
  async getProviderIcon(
    provider: string,
    iconType: string,
    lang: string,
  ): Promise<{ data: Buffer; mime_type: string }> {
    const providerEntity = await this.getModelProvider(provider)
    return this.runtime.getProviderIcon({
      provider: providerEntity.provider,
      icon_type: iconType,
      lang,
    })
  }

  private async resolveProvider(provider: string): Promise<ProviderEntity | null> {
    const providers = await this.getModelProviders()
    return providers.find(item => ModelProviderFactory.matchesProvider(item, provider)) ?? null
  }

  private static matchesProvider(providerEntity: ProviderEntity, provider: string): boolean {
    return provider === providerEntity.provider || provider === providerEntity.provider_name
  }
}
