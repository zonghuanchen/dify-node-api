// Console auth cookie names (mirrors Python api/constants/__init__.py)
export const COOKIE_NAME_ACCESS_TOKEN = 'access_token'
export const COOKIE_NAME_REFRESH_TOKEN = 'refresh_token'
export const COOKIE_NAME_CSRF_TOKEN = 'csrf_token'

// Header names
export const HEADER_NAME_CSRF_TOKEN = 'X-CSRF-Token'

// Refresh token Redis key prefixes
export const REFRESH_TOKEN_PREFIX = 'refresh_token:'
export const ACCOUNT_REFRESH_TOKEN_PREFIX = 'account_refresh_token:'

// Email register Redis key prefixes
export const EMAIL_REGISTER_TOKEN_PREFIX = 'email_register:'
export const EMAIL_REGISTER_ERROR_PREFIX = 'email_register_error:'
export const LOGIN_ERROR_RATE_LIMIT_PREFIX = 'login_error_rate_limit:'
