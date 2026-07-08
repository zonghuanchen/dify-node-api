import { config } from '../config/index.js'

/**
 * System service — handles non-domain logic like health checks and version info.
 */
export const systemService = {
  /**
   * Get current system health status.
   */
  getPing() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  },

  /**
   * Get application version.
   */
  getVersion() {
    return {
      version: config.appVersion,
    }
  },
}
