/**
 * Base application error class.
 * All domain-specific errors should extend this.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/** 404 Not Found error. */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'not_found', message)
    this.name = 'NotFoundError'
  }
}

/** 401 Unauthorized error. */
export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'unauthorized', message)
    this.name = 'AuthError'
  }
}

/** 403 Forbidden error. */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'forbidden', message)
    this.name = 'ForbiddenError'
  }
}

/** 400 Bad Request error. */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(400, 'bad_request', message)
    this.name = 'BadRequestError'
  }
}

/** 429 Too Many Requests error. */
export class RateLimitError extends AppError {
  constructor(code: string, message: string) {
    super(429, code, message)
    this.name = 'RateLimitError'
  }
}

// ── Auth domain errors ────────────────────────────────────────────

/** Invalid email or password (401). */
export class AuthenticationFailedError extends AppError {
  constructor() {
    super(401, 'authentication_failed', 'Invalid email or password.')
    this.name = 'AuthenticationFailedError'
  }
}

/** Too many incorrect password attempts (429). */
export class EmailPasswordLoginLimitError extends RateLimitError {
  constructor() {
    super('email_code_login_limit', 'Too many incorrect password attempts. Please try again later.')
    this.name = 'EmailPasswordLoginLimitError'
  }
}

/** Account is banned (403). */
export class AccountBannedError extends AppError {
  constructor() {
    super(403, 'account_banned', 'Account is banned.')
    this.name = 'AccountBannedError'
  }
}

/** Account not found (404). */
export class AccountNotFoundError extends AppError {
  constructor() {
    super(404, 'account_not_found', 'Account not found.')
    this.name = 'AccountNotFoundError'
  }
}

/** Email already in use (400). */
export class EmailAlreadyInUseError extends AppError {
  constructor() {
    super(400, 'email_already_in_use', 'A user with this email already exists.')
    this.name = 'EmailAlreadyInUseError'
  }
}

/** Invalid or expired token (400). */
export class InvalidTokenError extends AppError {
  constructor() {
    super(400, 'invalid_or_expired_token', 'The token is invalid or has expired.')
    this.name = 'InvalidTokenError'
  }
}

/** Passwords do not match (400). */
export class PasswordMismatchError extends AppError {
  constructor() {
    super(400, 'password_mismatch', 'The passwords do not match.')
    this.name = 'PasswordMismatchError'
  }
}

/** Invalid email address (400). */
export class InvalidEmailError extends AppError {
  constructor() {
    super(400, 'invalid_email', 'The email address is not valid.')
    this.name = 'InvalidEmailError'
  }
}

/** Email code is invalid or expired (400). */
export class EmailCodeError extends AppError {
  constructor() {
    super(400, 'email_code_error', 'Email code is invalid or expired.')
    this.name = 'EmailCodeError'
  }
}

/** Too many failed email register attempts (429). */
export class EmailRegisterLimitError extends RateLimitError {
  constructor() {
    super('email_register_limit', 'Too many failed email register attempts. Please try again in 24 hours.')
    this.name = 'EmailRegisterLimitError'
  }
}

/** Refresh token not found or invalid (401). */
export class RefreshTokenNotFoundError extends AuthError {
  constructor(message = 'Invalid refresh token') {
    super(message)
    this.name = 'RefreshTokenNotFoundError'
    this.code = 'invalid_refresh_token'
  }
}

/** Account associated with refresh token not found or invalid (401). */
export class RefreshTokenAccountNotFoundError extends AuthError {
  constructor(message = 'Invalid account') {
    super(message)
    this.name = 'RefreshTokenAccountNotFoundError'
    this.code = 'invalid_refresh_token_account'
  }
}
