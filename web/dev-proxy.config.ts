import type { CookieRewriteOptions, DevProxyConfig } from '@langgenius/dev-proxy'

const DIFY_CLOUD_TARGET = 'https://cloud.dify.ai'
const DEV_PROXY_TARGET = process.env.DEV_PROXY_TARGET || DIFY_CLOUD_TARGET
const DEV_PROXY_ENTERPRISE_TARGET = process.env.DEV_PROXY_ENTERPRISE_TARGET || DEV_PROXY_TARGET
const DEV_PROXY_PUBLIC_TARGET = process.env.DEV_PROXY_PUBLIC_TARGET || DEV_PROXY_TARGET
const DEV_PROXY_API_NODE_TARGET = process.env.DEV_PROXY_API_NODE_TARGET || 'http://127.0.0.1:5002'
const DEV_PROXY_HOST = process.env.DEV_PROXY_HOST || '127.0.0.1'
const DEV_PROXY_PORT = Number(process.env.DEV_PROXY_PORT || 5001)

const difyCookieRewrite: CookieRewriteOptions = {
  hostPrefixCookies: [
    'access_token',
    'csrf_token',
    'refresh_token',
    'webapp_access_token',
    /^passport-/,
  ],
  localCookieScope: 'target-origin',
  csrfHeader: {
    cookieName: 'csrf_token',
    headerName: 'X-CSRF-Token',
  },
}

export default {
  server: {
    host: DEV_PROXY_HOST,
    port: DEV_PROXY_PORT,
  },
  routes: [
    {
      paths: [
        '/console/api/enterprise',
        '/api/enterprise',
        '/admin-api',
        '/inner/api',
        '/mfa',
        '/scim',
        '/v1/audit',
        '/v1/dashboard',
        '/v1/healthz',
        '/v1/plugin-manager',
      ],
      target: DEV_PROXY_ENTERPRISE_TARGET,
      cookieRewrite: difyCookieRewrite,
    },
    // Routes migrated to api-node — must appear BEFORE the catch-all /console/api route.
    {
      paths: [
        '/console/api/workspaces/current/model-providers',
        '/console/api/workspaces/current/models',
        '/console/api/workspaces/current/default-model',
        '/console/api/workspaces/current/plugin/tasks',
        '/console/api/workspaces/current/plugin/debugging-key',
        '/console/api/workspaces/current/plugin/list/latest-versions',
        '/console/api/workspaces/current/plugin/list/installations/ids',
        '/console/api/workspaces/current/plugin/fetch-manifest',
        '/console/api/workspaces/current/plugin/icon',
        '/console/api/workspaces/current/plugin/asset',
        '/console/api/workspaces/current/plugin/readme',
        '/console/api/workspaces/current/plugin/upload',
        '/console/api/workspaces/current/plugin/install',
        '/console/api/workspaces/current/plugin/marketplace/pkg',
        '/console/api/workspaces/current/plugin/uninstall',
        '/console/api/workspaces/current/plugin/upgrade',
        '/console/api/workspaces/current/plugin/list',
        '/console/api/workspaces/current/plugin/permission',
        '/console/api/workspaces/current/plugin/auto-upgrade',
        '/console/api/workspaces/current/plugin/model/list',
        '/console/api/workspaces/current/plugin/tool/list',
        '/console/api/workspaces/current/plugin/extension/list',
        '/console/api/workspaces/current/plugin/agent-strategy/list',
        '/console/api/workspaces/current/plugin/datasource/list',
        '/console/api/workspaces/current/plugin/trigger/list',
      ],
      target: DEV_PROXY_API_NODE_TARGET,
      cookieRewrite: difyCookieRewrite,
    },
    {
      paths: [
        '/console/api',
      ],
      target: DEV_PROXY_TARGET,
      cookieRewrite: difyCookieRewrite,
    },
    {
      paths: [
        '/api',
      ],
      target: DEV_PROXY_PUBLIC_TARGET,
      cookieRewrite: difyCookieRewrite,
    },
  ],
} satisfies DevProxyConfig
