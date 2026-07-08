import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(5001),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/dify'),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  CORS_ORIGINS: z.string().default('*'),
  SECRET_KEY: z.string().default('change-me-in-production'),
  APP_VERSION: z.string().default('1.0.0'),
  COOKIE_DOMAIN: z.string().default(''),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().default(60),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().default(30),
  CONSOLE_WEB_URL: z.string().default('http://localhost:3000'),
  CONSOLE_API_URL: z.string().default('http://localhost:5001'),
})

function loadConfig() {
  const parsed = envSchema.parse(process.env)
  const isSecure = parsed.CONSOLE_WEB_URL.startsWith('https') && parsed.CONSOLE_API_URL.startsWith('https')
  const cookieDomain = parsed.COOKIE_DOMAIN.replace(/^\./, '') || undefined
  return {
    env: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map((s) => s.trim()),
    secretKey: parsed.SECRET_KEY,
    appVersion: parsed.APP_VERSION,
    isDev: parsed.NODE_ENV === 'development',
    isProd: parsed.NODE_ENV === 'production',
    cookieDomain,
    accessTokenExpireMinutes: parsed.ACCESS_TOKEN_EXPIRE_MINUTES,
    refreshTokenExpireDays: parsed.REFRESH_TOKEN_EXPIRE_DAYS,
    consoleWebUrl: parsed.CONSOLE_WEB_URL,
    consoleApiUrl: parsed.CONSOLE_API_URL,
    isSecure,
  }
}

export const config = loadConfig()
export type Config = ReturnType<typeof loadConfig>
