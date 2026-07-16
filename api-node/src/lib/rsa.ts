/**
 * RSA hybrid credential decryption.
 * Ports Python api/libs/rsa.py + api/core/helper/encrypter.py.
 *
 * Provider credentials are stored per-field as base64 blobs produced by
 * PyCryptodome. Secret fields use the hybrid format:
 *   "HYBRID:" + RSA-OAEP(SHA-1)-wrapped AES-128 key + 16B nonce + 16B tag + AES-EAX ciphertext
 * A legacy pure RSA-OAEP form (no prefix) is also supported.
 *
 * Node's built-in crypto has no AES-EAX mode, so EAX (OMAC1/CMAC + AES-CTR) is
 * implemented here from Node primitives without any extra npm dependency.
 */

import { constants, createCipheriv, createDecipheriv, createHash, privateDecrypt, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { redis } from './redis.js'

const HYBRID_PREFIX = Buffer.from('HYBRID:')
const RSA_KEY_SIZE_BYTES = 256 // 2048-bit RSA modulus
const PRIVKEY_CACHE_TTL_SECONDS = 120

/** Raised when a tenant's private key cannot be located in storage. */
export class PrivkeyNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Private key not found, tenant_id: ${tenantId}`)
    this.name = 'PrivkeyNotFoundError'
  }
}

/**
 * Load the tenant RSA private key PEM, mirroring Python `rsa.get_decrypt_decoding`.
 * Cache key hashes the storage-relative filepath (not the absolute path), matching Python.
 */
export async function getPrivateKeyPem(tenantId: string): Promise<string> {
  const filepath = `privkeys/${tenantId}/private.pem`
  const cacheKey = `tenant_privkey:${createHash('sha3-256').update(filepath).digest('hex')}`

  const cached = await redis.get(cacheKey)
  if (cached) {
    return cached
  }

  let pem: string
  try {
    pem = await readFile(path.join(process.cwd(), 'storage', filepath), 'utf8')
  }
  catch {
    throw new PrivkeyNotFoundError(tenantId)
  }

  await redis.setex(cacheKey, PRIVKEY_CACHE_TTL_SECONDS, pem)
  return pem
}

// ── AES-EAX (OMAC1/CMAC + CTR) ─────────────────────────────────────

/** Encrypt a single 16-byte block with AES-128-ECB (no padding). */
function aesEcbEncryptBlock(key: Buffer, block: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', key, null)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(block), cipher.final()])
}

/** CBC-MAC over data (length must be a multiple of 16) with a zero IV. */
function cbcMac(key: Buffer, data: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16))
  cipher.setAutoPadding(false)
  const out = Buffer.concat([cipher.update(data), cipher.final()])
  return out.subarray(out.length - 16)
}

/** Left-shift a 16-byte buffer by one bit (big-endian), dropping the top carry. */
function leftShiftOneBit(buf: Buffer): Buffer {
  const out = Buffer.alloc(buf.length)
  let carry = 0
  for (let i = buf.length - 1; i >= 0; i--) {
    const byte = buf[i]!
    out[i] = ((byte << 1) | carry) & 0xFF
    carry = (byte >> 7) & 1
  }
  return out
}

/** Derive CMAC subkeys K1/K2 from the AES encryption of a zero block. */
function generateCmacSubkeys(key: Buffer): [Buffer, Buffer] {
  const rb = 0x87
  const l = aesEcbEncryptBlock(key, Buffer.alloc(16))

  const k1 = leftShiftOneBit(l)
  if (l[0]! & 0x80) {
    k1[15] = k1[15]! ^ rb
  }

  const k2 = leftShiftOneBit(k1)
  if (k1[0]! & 0x80) {
    k2[15] = k2[15]! ^ rb
  }

  return [k1, k2]
}

/** AES-CMAC (OMAC1) of an arbitrary-length message. */
function cmac(key: Buffer, message: Buffer): Buffer {
  const [k1, k2] = generateCmacSubkeys(key)

  const blockCount = Math.max(1, Math.ceil(message.length / 16))
  const headLen = (blockCount - 1) * 16
  const head = message.subarray(0, headLen)
  const lastPart = message.subarray(headLen)
  const complete = message.length > 0 && lastPart.length === 16

  const last = Buffer.alloc(16)
  lastPart.copy(last)
  const subkey = complete ? k1 : k2
  if (!complete) {
    last[lastPart.length] = 0x80
  }
  for (let i = 0; i < 16; i++) {
    last[i] = last[i]! ^ subkey[i]!
  }

  return cbcMac(key, Buffer.concat([head, last]))
}

/** OMAC^t: CMAC over the 16-byte big-endian representation of t prepended to the message. */
function omac(key: Buffer, t: number, message: Buffer): Buffer {
  const tBlock = Buffer.alloc(16)
  tBlock[15] = t
  return cmac(key, Buffer.concat([tBlock, message]))
}

/** Decrypt and authenticate an AES-EAX ciphertext (no associated data). */
function aesEaxDecrypt(key: Buffer, nonce: Buffer, ciphertext: Buffer, tag: Buffer): Buffer {
  const nonceMac = omac(key, 0, nonce)
  const headerMac = omac(key, 1, Buffer.alloc(0))
  const ciphertextMac = omac(key, 2, ciphertext)

  const computedTag = Buffer.alloc(16)
  for (let i = 0; i < 16; i++) {
    computedTag[i] = nonceMac[i]! ^ ciphertextMac[i]! ^ headerMac[i]!
  }

  const expected = computedTag.subarray(0, tag.length)
  if (expected.length !== tag.length || !timingSafeEqual(expected, tag)) {
    throw new Error('EAX tag verification failed')
  }

  const decipher = createDecipheriv('aes-128-ctr', key, nonceMac)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// ── Token decryption ───────────────────────────────────────────────

/** RSA-OAEP (SHA-1) decrypt, mirroring PyCryptodome PKCS1_OAEP defaults. */
function rsaOaepDecrypt(pem: string, data: Buffer): Buffer {
  return privateDecrypt(
    { key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
    data,
  )
}

/**
 * Decrypt a base64-encoded credential token using an already-loaded PEM.
 * Mirrors Python `rsa.decrypt_token_with_decoding`.
 */
export function decryptTokenWithKey(pem: string, base64Token: string): string {
  const encrypted = Buffer.from(base64Token, 'base64')

  if (encrypted.subarray(0, HYBRID_PREFIX.length).equals(HYBRID_PREFIX)) {
    const body = encrypted.subarray(HYBRID_PREFIX.length)
    const encAesKey = body.subarray(0, RSA_KEY_SIZE_BYTES)
    const nonce = body.subarray(RSA_KEY_SIZE_BYTES, RSA_KEY_SIZE_BYTES + 16)
    const tag = body.subarray(RSA_KEY_SIZE_BYTES + 16, RSA_KEY_SIZE_BYTES + 32)
    const ciphertext = body.subarray(RSA_KEY_SIZE_BYTES + 32)

    const aesKey = rsaOaepDecrypt(pem, encAesKey)
    return aesEaxDecrypt(aesKey, nonce, ciphertext, tag).toString('utf8')
  }

  return rsaOaepDecrypt(pem, encrypted).toString('utf8')
}

/** Load the tenant key and decrypt a single base64-encoded credential token. */
export async function decryptToken(tenantId: string, base64Token: string): Promise<string> {
  const pem = await getPrivateKeyPem(tenantId)
  return decryptTokenWithKey(pem, base64Token)
}

/**
 * Decrypt the secret fields of a credentials object in place-safe fashion.
 * Loads the private key once, mirroring Python's cached decoding key reuse, and
 * suppresses per-field decryption errors like Python's `contextlib.suppress`.
 */
export async function decryptSecretFields(
  tenantId: string,
  credentials: Record<string, unknown>,
  secretVariableNames: string[],
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...credentials }
  if (secretVariableNames.length === 0) {
    return result
  }

  const pem = await getPrivateKeyPem(tenantId)
  for (const key of secretVariableNames) {
    const value = result[key]
    if (typeof value === 'string' && value) {
      try {
        result[key] = decryptTokenWithKey(pem, value)
      }
      catch {
        // Mirror Python contextlib.suppress(ValueError): keep the raw value.
      }
    }
  }
  return result
}
