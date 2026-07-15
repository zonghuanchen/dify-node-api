import { pbkdf2Sync, randomBytes } from 'node:crypto'

const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/

/**
 * Validates password meets minimum requirements.
 * Mirrors Python api/libs/password.py `valid_password()`.
 * @throws {Error} if password does not meet requirements
 */
export function validatePassword(password: string): string {
  if (!PASSWORD_PATTERN.test(password)) {
    throw new Error('Password must contain letters and numbers, and the length must be at least 8 characters.')
  }
  return password
}

/**
 * Hashes password using PBKDF2-SHA256 (10000 iterations) — matches Python `hash_password()`.
 * Returns hex-encoded hash as a Buffer (mirrors Python binascii.hexlify(dk)).
 */
export function hashPassword(passwordStr: string, saltByte: Buffer): Buffer {
  const dk = pbkdf2Sync(passwordStr, saltByte, 10000, 32, 'sha256')
  // Python returns binascii.hexlify(dk) which is the hex string as bytes
  return Buffer.from(dk.toString('hex'), 'utf-8')
}

/**
 * Compares plaintext password against stored base64-encoded hash and salt.
 * Mirrors Python `compare_password()`: hash_password(pwd, salt) == b64decode(stored).
 */
export function comparePassword(
  passwordStr: string,
  passwordHashedBase64: string,
  saltBase64: string,
): boolean {
  const salt = Buffer.from(saltBase64, 'base64')
  const hashed = hashPassword(passwordStr, salt)
  // Python: hash_password() == base64.b64decode(password_hashed_base64)
  // Both sides are hex-encoded byte strings
  return hashed.toString('binary') === Buffer.from(passwordHashedBase64, 'base64').toString('binary')
}

/**
 * Generates a random 16-byte salt and returns the base64-encoded salt plus the hashed password.
 * Returns { base64Salt, base64Hash } ready for DB storage.
 * The base64Hash matches Python's storage format: base64(hexlify(raw_hash)).
 */
export function generatePasswordHash(password: string): { base64Salt: string; base64Hash: string } {
  const salt = randomBytes(16)
  const base64Salt = salt.toString('base64')
  const hashed = hashPassword(password, salt)
  // Store as base64 of hex string — matches Python's base64(hexlify(dk))
  const base64Hash = hashed.toString('base64')
  return { base64Salt, base64Hash }
}
