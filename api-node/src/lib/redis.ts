import Redis from 'ioredis'
import { config } from '../config/index.js'

/**
 * Redis client singleton — used for refresh token storage and rate limiting.
 */
export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null // stop retrying after 3 attempts
    return Math.min(times * 500, 3000)
  },
})
