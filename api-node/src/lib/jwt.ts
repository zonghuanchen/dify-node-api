import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { AuthError } from './errors.js'

/**
 * JWT passport service — mirrors Python api/libs/passport.py `PassportService`.
 * Signs and verifies HS256 JWTs using SECRET_KEY.
 */
export class PassportService {
  private readonly sk: string

  constructor() {
    this.sk = config.secretKey
  }

  /** Signs a payload and returns the JWT string. */
  issue(payload: Record<string, unknown>): string {
    return jwt.sign(payload, this.sk, { algorithm: 'HS256' })
  }

  /** Verifies and decodes a JWT. Throws AuthError on failure. */
  verify(token: string): Record<string, unknown> {
    try {
      return jwt.verify(token, this.sk, { algorithms: ['HS256'] }) as Record<string, unknown>
    }
    catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AuthError('Token has expired.')
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AuthError(err.message === 'invalid signature' ? 'Invalid token signature.' : 'Invalid token.')
      }
      throw new AuthError('Invalid token.')
    }
  }
}

/**
 * Issues a console access JWT for the given account.
 * Mirrors Python `AccountService.get_account_jwt_token()`.
 */
export function issueAccessToken(accountId: string): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + config.accessTokenExpireMinutes * 60
  return new PassportService().issue({
    user_id: accountId,
    exp,
    iss: 'SELF_HOSTED',
    sub: 'Console API Passport',
  })
}

/**
 * Issues a CSRF token for the given user.
 * Mirrors Python `generate_csrf_token()`.
 */
export function issueCsrfToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + config.accessTokenExpireMinutes * 60
  return new PassportService().issue({ exp, sub: userId })
}

/**
 * Verifies a JWT access token and returns the decoded payload.
 * @throws {AuthError} if the token is invalid or expired
 */
export function verifyAccessToken(token: string): { user_id: string; exp: number } {
  const decoded = new PassportService().verify(token)
  if (typeof decoded.user_id !== 'string') {
    throw new AuthError('Invalid token payload.')
  }
  return decoded as { user_id: string; exp: number }
}
