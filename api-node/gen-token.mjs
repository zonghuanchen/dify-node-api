import crypto from 'node:crypto'
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
const payload = Buffer.from(JSON.stringify({
  user_id: 'e7a094cd-7453-4178-948b-1be3331c5e72',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iss: 'SELF_HOSTED',
  sub: 'Console API Passport',
})).toString('base64url')
const sig = crypto.createHmac('sha256', 'change-me-in-production').update(`${header}.${payload}`).digest('base64url')
console.log(`${header}.${payload}.${sig}`)
