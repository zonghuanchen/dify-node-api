/**
 * Model providers routes.
 * Mirrors Python api/controllers/console/workspace/model_providers.py and models.py.
 *
 * Provider/model discovery is backed by the TypeScript model-runtime module
 * (FilesystemPluginLoader + ModelProviderFactory). The default-model endpoint
 * remains a stub pending migration of provider credential storage.
 *
 * GET /console/api/workspaces/current/model-providers
 * GET /console/api/workspaces/current/models/model-types/:model_type
 * GET /console/api/workspaces/current/default-model?model_type=llm
 * GET /console/api/workspaces/current/model-providers/:provider/models/parameter-rules
 */

import { Hono } from 'hono'
import { ModelType } from '../../../model-runtime/entities/model.js'
import { getModelProviderFactory } from '../../../model-runtime/runtime-instance.js'
import { BadRequestError } from '../../../lib/errors.js'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import { getModelParameterRules } from '../../../services/model-provider.service.js'
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
 * Mirrors Python ModelProviderModelParameterRuleApi.get() from models.py L594-610
 * and ModelProviderService.get_model_parameter_rules() (LLM only).
 *
 * Resolves the tenant's stored provider/model credentials, decrypts them, and
 * returns the resulting parameter rules — or `[]` when no credentials exist.
 *
 * NOTE: Hono `*` wildcards only match a single path segment (no slashes).
 * Provider IDs like `langgenius/deepseek/deepseek` span multiple segments
 * (mirrors Flask `<path:provider>`), so we use a catch-all `/*` at the
 * `model-providers/` level and validate the suffix with a regex inside the
 * handler. Non-matching paths fall through to the Hono 404 handler.
 */
modelProvidersRoute.get(
  '/workspaces/current/model-providers/*',
  async (c, next) => {
    // Only handle paths ending in /models/parameter-rules.
    // Other sub-paths under model-providers/ are not implemented yet and
    // should fall through to the global 404 handler.
    const match = c.req.path.match(/model-providers\/(.+)\/models\/parameter-rules$/)
    if (!match) {
      return c.json(
        { status: 'error', code: 'not_found', message: `Route ${c.req.method} ${c.req.path} not found` },
        404,
      )
    }
    await next()
  },
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    // `provider` is a plugin id containing slashes (e.g. langgenius/deepseek/deepseek).
    const match = c.req.path.match(/model-providers\/(.+)\/models\/parameter-rules$/)
    const provider = match ? decodeURIComponent(match[1]!) : ''
    const model = c.req.query('model')
    // Mirrors Python ParserParameter: `model` is a required field.
    if (!model) {
      throw new BadRequestError('model is required.')
    }

    const rules = await getModelParameterRules({
      db: c.get('db'),
      tenantId: c.get('tenantId')!,
      provider,
      model,
    })

    return c.json({ data: rules })
  },
)
