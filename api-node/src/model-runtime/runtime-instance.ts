/**
 * Shared ModelProviderFactory instance backed by the filesystem plugin loader.
 * Providers are loaded from the directory configured via MODEL_PROVIDERS_DIR.
 */

import { config } from '../config/index.js'
import { ModelProviderFactory } from './model-providers/model-provider-factory.js'
import { FilesystemPluginLoader } from './plugin-loader/plugin-loader.js'

let factory: ModelProviderFactory | null = null

/** Get the lazily-initialized, process-wide ModelProviderFactory. */
export function getModelProviderFactory(): ModelProviderFactory {
  if (!factory) {
    const loader = new FilesystemPluginLoader(config.modelProvidersDir)
    factory = new ModelProviderFactory(loader)
  }
  return factory
}
