/**
 * Filesystem-based provider discovery + JSON parsing.
 * Loads `provider.json` config files and exposes them as a ModelProviderRuntime.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'

import type { AIModelEntity, FetchFrom, ModelFeature, ModelType, ParameterRule } from '../entities/model.js'
import type { ProviderEntity } from '../entities/provider.js'
import type { ModelProviderRuntime } from '../protocols/provider-runtime.js'
import type { ProviderConfigFile } from './provider-config.schema.js'
import { providerConfigSchema } from './provider-config.schema.js'

type ModelConfig = NonNullable<ProviderConfigFile['models']>[number]

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/**
 * Loads provider definitions from `provider.json` files under a base directory.
 * Implements ModelProviderRuntime so it can back a ModelProviderFactory directly.
 */
export class FilesystemPluginLoader implements ModelProviderRuntime {
  private readonly baseDir: string
  private providers: ProviderEntity[] | null = null
  private readonly providerDirs = new Map<string, string>()

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  /** Load, parse, and validate all provider config files (cached). */
  loadProviders(): ProviderEntity[] {
    if (this.providers) return this.providers

    const entities: ProviderEntity[] = []
    for (const file of this.findProviderConfigFiles(this.baseDir)) {
      const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
      const config = providerConfigSchema.parse(raw)
      const entity = FilesystemPluginLoader.toProviderEntity(config)
      this.providerDirs.set(entity.provider, dirname(file))
      entities.push(entity)
    }

    this.providers = entities
    return entities
  }

  // ── ModelProviderRuntime implementation ────────────────────────

  fetchModelProviders(): ProviderEntity[] {
    return this.loadProviders()
  }

  getProviderIcon(params: {
    provider: string
    icon_type: string
    lang: string
  }): { data: Buffer; mime_type: string } {
    const { data, mimeType } = this.loadProviderIcon(params.provider, params.icon_type, params.lang)
    return { data, mime_type: mimeType }
  }

  validateProviderCredentials(_params: {
    provider: string
    credentials: Record<string, unknown>
  }): void {
    // Config-backed loader performs no remote validation; schema validation
    // is handled by ModelProviderFactory before this point.
  }

  validateModelCredentials(_params: {
    provider: string
    model_type: ModelType
    model: string
    credentials: Record<string, unknown>
  }): void {
    // Config-backed loader performs no remote validation.
  }

  getModelSchema(params: {
    provider: string
    model_type: ModelType
    model: string
    credentials: Record<string, unknown>
  }): AIModelEntity | null {
    const providerEntity = this.loadProviders().find(
      p => p.provider === params.provider || p.provider_name === params.provider,
    )
    if (!providerEntity) return null

    return (
      (providerEntity.models ?? []).find(
        m => m.model === params.model && m.model_type === params.model_type,
      ) ?? null
    )
  }

  /** Load a provider icon file, resolving the localized filename from config. */
  loadProviderIcon(
    provider: string,
    _iconType: string,
    lang: string,
  ): { data: Buffer; mimeType: string } {
    this.loadProviders()
    const providerDir = this.providerDirs.get(provider)
    if (!providerDir) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    const providerEntity = this.providers?.find(p => p.provider === provider)
    const icon = providerEntity?.icon_small
    const filename = icon?.[lang === 'zh_Hans' ? 'zh_Hans' : 'en_US'] ?? icon?.en_US
    if (!filename) {
      throw new Error(`Provider ${provider} does not define an icon`)
    }

    const iconPath = join(providerDir, filename)
    const data = readFileSync(iconPath)
    const mimeType = MIME_TYPE_BY_EXTENSION[extname(filename).toLowerCase()] ?? 'application/octet-stream'
    return { data, mimeType }
  }

  // ── Config → entity conversion ─────────────────────────────────

  private static toProviderEntity(config: ProviderConfigFile): ProviderEntity {
    return {
      provider: config.provider,
      provider_name: config.provider_name,
      label: config.label,
      description: config.description,
      icon_small: config.icon_small,
      icon_small_dark: config.icon_small_dark,
      background: config.background,
      help: config.help,
      supported_model_types: config.supported_model_types as ModelType[],
      configurate_methods: config.configurate_methods,
      models: (config.models ?? []).map(FilesystemPluginLoader.toModelEntity),
      provider_credential_schema: config.provider_credential_schema,
      model_credential_schema: config.model_credential_schema,
      position: config.position,
    }
  }

  private static toModelEntity(model: ModelConfig): AIModelEntity {
    return {
      model: model.model,
      label: model.label,
      model_type: model.model_type as ModelType,
      features: (model.features ?? undefined) as ModelFeature[] | undefined,
      fetch_from: model.fetch_from as FetchFrom,
      model_properties: model.model_properties,
      deprecated: model.deprecated,
      parameter_rules: model.parameter_rules as ParameterRule[] | undefined,
      pricing: model.pricing,
    }
  }

  private findProviderConfigFiles(dir: string): string[] {
    const results: string[] = []
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    }
    catch {
      return results
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...this.findProviderConfigFiles(fullPath))
      }
      else if (entry.isFile() && entry.name === 'provider.json') {
        results.push(fullPath)
      }
    }
    return results
  }
}
