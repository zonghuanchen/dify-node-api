/**
 * Base64 field decoding for sensitive fields (password, verification code).
 * Mirrors Python api/libs/encryption.py `FieldEncryption`.
 *
 * Note: This uses Base64 encoding for obfuscation, not cryptographic encryption.
 * Real security relies on HTTPS for transport layer encryption.
 */

/**
 * Decode a Base64-encoded field from the frontend.
 * Returns null if decoding fails.
 */
export function decryptField(encodedText: string): string | null {
  try {
    const decoded = Buffer.from(encodedText, 'base64').toString('utf-8')
    return decoded || null
  }
  catch {
    return null
  }
}

/**
 * Decode a Base64-encoded password field.
 * Throws AuthenticationFailedError if decoding fails.
 */
export function decryptPassword(encodedPassword: string, errorMessage = 'Invalid encrypted password'): string {
  const decoded = decryptField(encodedPassword)
  if (decoded === null) {
    throw new Error(errorMessage)
  }
  return decoded
}

/**
 * Decode a Base64-encoded verification code field.
 * Throws if decoding fails.
 */
export function decryptCode(encodedCode: string, errorMessage = 'Invalid encrypted code'): string {
  const decoded = decryptField(encodedCode)
  if (decoded === null) {
    throw new Error(errorMessage)
  }
  return decoded
}
