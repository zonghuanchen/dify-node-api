/**
 * Model providers routes.
 * Mirrors Python api/controllers/console/workspace/model_providers.py and models.py.
 *
 * Provider/model discovery is backed by the TypeScript model-runtime module
 * (FilesystemPluginLoader + ModelProviderFactory). Credential-backed endpoints
 * (default-model) remain stubs pending migration of provider credential storage.
 *
 * GET /console/api/workspaces/current/model-providers
 * GET /console/api/workspaces/current/models/model-types/:model_type
 * GET /console/api/workspaces/current/default-model?model_type=llm
 * GET /console/api/workspaces/current/model-providers/:provider/models/parameter-rules
 */

import { Hono } from 'hono'
import type { ModelType } from '../../../model-runtime/entities/model.js'
import { getModelProviderFactory } from '../../../model-runtime/runtime-instance.js'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const modelProvidersRoute = new Hono<AppEnv>()

// GET /workspaces/current/model-providers
modelProvidersRoute.get(
  '/workspaces/current/model-providers',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    // Load predefined providers from the filesystem plugin loader.
    // Credential-backed provider config is not yet migrated from Python.
    const providers = await getModelProviderFactory().getProviders()
    return c.json({ data: providers })
  },
)

// GET /workspaces/current/models/model-types/:model_type
modelProvidersRoute.get(
  '/workspaces/current/models/model-types/:model_type',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const modelType = c.req.param('model_type') as ModelType
    const models = await getModelProviderFactory().getModels({ modelType })
    return c.json({ data: models })
  },
)

/**
 * GET /workspaces/current/default-model?model_type=llm
 * Returns the default model for a given model type.
 * Mirrors Python DefaultModelApi.get() from models.py L200-216.
 *
 * NOTE: Returns null stub — full implementation requires Python plugin system.
 */
modelProvidersRoute.get(
  '/workspaces/current/default-model',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  (c) => {
    // Stub: return null default model.
    // Full implementation requires Python ModelProviderService.
    return c.json({ data: null })
  },
)

/**
 * GET /workspaces/current/model-providers/:provider/models/parameter-rules?model=:model
 * Returns parameter rules for a specific model.
 * Mirrors Python ModelProviderModelParameterRuleApi.get() from models.py L594-610.
 *
 * NOTE: Returns empty array stub — full implementation requires Python plugin system.
 */
modelProvidersRoute.get(
  '/workspaces/current/model-providers/:provider{.+}/models/parameter-rules',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const provider = c.req.param('provider')
    const model = c.req.query('model')
    if (!model) {
      return c.json({ data: [] })
    }

    const factory = getModelProviderFactory()
    const providerEntity = (await factory.getProviders()).find(
      p => p.provider === provider || p.provider_name === provider,
    )
    const modelSchema = providerEntity?.models?.find(m => m.model === model)
    return c.json({ data: modelSchema?.parameter_rules ?? [] })
  },
)
