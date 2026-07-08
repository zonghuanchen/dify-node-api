import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { config } from '../config/index.js'
import {
  COOKIE_NAME_ACCESS_TOKEN,
  COOKIE_NAME_CSRF_TOKEN,
  COOKIE_NAME_REFRESH_TOKEN,
} from './constants.js'

function realCookieName(name: string): string {
  return config.isSecure ? `__Host-${name}` : name
}

function baseCookieOptions(httpOnly: boolean, sameSite: 'Lax' | 'Strict' | 'None' = 'Lax') {
  return {
    domain: config.cookieDomain,
    secure: config.isSecure,
    httpOnly,
    sameSite,
    path: '/',
  } as const
}

/**
 * Sets access token as an HTTP-only secure cookie.
 */
export function setAccessTokenCookie(c: Context, token: string) {
  setCookie(c, realCookieName(COOKIE_NAME_ACCESS_TOKEN), token, {
    ...baseCookieOptions(true),
    maxAge: config.accessTokenExpireMinutes * 60,
  })
}

/**
 * Sets refresh token as an HTTP-only secure cookie.
 */
export function setRefreshTokenCookie(c: Context, token: string) {
  setCookie(c, realCookieName(COOKIE_NAME_REFRESH_TOKEN), token, {
    ...baseCookieOptions(true),
    maxAge: config.refreshTokenExpireDays * 24 * 60 * 60,
  })
}

/**
 * Sets CSRF token as a non-HTTP-only cookie (readable by JS for X-CSRF-Token header).
 */
export function setCsrfTokenCookie(c: Context, token: string) {
  setCookie(c, realCookieName(COOKIE_NAME_CSRF_TOKEN), token, {
    ...baseCookieOptions(false),
    maxAge: config.accessTokenExpireMinutes * 60,
  })
}

/**
 * Gets the access token from cookie.
 */
export function getAccessTokenFromCookie(c: Context): string | undefined {
  return getCookie(c, realCookieName(COOKIE_NAME_ACCESS_TOKEN))
}

/**
 * Gets the refresh token from cookie.
 */
export function getRefreshTokenFromCookie(c: Context): string | undefined {
  return getCookie(c, realCookieName(COOKIE_NAME_REFRESH_TOKEN))
}

/**
 * Gets the CSRF token from cookie.
 */
export function getCsrfTokenFromCookie(c: Context): string | undefined {
  return getCookie(c, realCookieName(COOKIE_NAME_CSRF_TOKEN))
}

/**
 * Clears all auth-related cookies.
 */
export function clearAuthCookies(c: Context) {
  deleteCookie(c, realCookieName(COOKIE_NAME_ACCESS_TOKEN), baseCookieOptions(true))
  deleteCookie(c, realCookieName(COOKIE_NAME_REFRESH_TOKEN), baseCookieOptions(true))
  deleteCookie(c, realCookieName(COOKIE_NAME_CSRF_TOKEN), baseCookieOptions(false))
}
