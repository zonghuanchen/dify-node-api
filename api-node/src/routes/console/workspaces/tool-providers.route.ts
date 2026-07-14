/**
 * Tool providers stub routes.
 * Mirrors Python api/controllers/console/workspace/tool_providers.py.
 *
 * These endpoints depend on the Python plugin system and tool provider registry.
 * Cannot be directly migrated to api-node. Returns empty stub data
 * to prevent frontend errors.
 *
 * GET /console/api/workspaces/current/tool-providers
 * GET /console/api/workspaces/current/tools/builtin
 * GET /console/api/workspaces/current/tools/api
 * GET /console/api/workspaces/current/tools/workflow
 * GET /console/api/workspaces/current/tools/mcp
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const toolProvidersRoute = new Hono<AppEnv>()

const stubHandler = (c: any) => c.json([])

/**
 * GET /workspaces/current/tool-providers
 * Mirrors Python ToolProviderListApi from tool_providers.py L330+.
 */
toolProvidersRoute.get('/workspaces/current/tool-providers', requireAuth, requireAccountInitialized, resolveTenant, stubHandler)

/**
 * GET /workspaces/current/tools/builtin
 * Mirrors Python ToolBuiltinListApi from tool_providers.py L799-815.
 */
toolProvidersRoute.get('/workspaces/current/tools/builtin', requireAuth, requireAccountInitialized, resolveTenant, stubHandler)

/**
 * GET /workspaces/current/tools/api
 * Mirrors Python ToolApiListApi from tool_providers.py L819-834.
 */
toolProvidersRoute.get('/workspaces/current/tools/api', requireAuth, requireAccountInitialized, resolveTenant, stubHandler)

/**
 * GET /workspaces/current/tools/workflow
 * Mirrors Python ToolWorkflowListApi from tool_providers.py L837-854.
 */
toolProvidersRoute.get('/workspaces/current/tools/workflow', requireAuth, requireAccountInitialized, resolveTenant, stubHandler)

/**
 * GET /workspaces/current/tools/mcp
 * Mirrors Python ToolMCPListAllApi from tool_providers.py L1292-1305.
 */
toolProvidersRoute.get('/workspaces/current/tools/mcp', requireAuth, requireAccountInitialized, resolveTenant, stubHandler)
