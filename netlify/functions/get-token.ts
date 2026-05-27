import type { Handler } from '@netlify/functions'
import { SignJWT } from 'jose'

const TOKEN_TTL_SECONDS = 24 * 60 * 60

function cors(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  }
}

async function fetchBackendToken() {
  const apiBase = process.env.VITE_API_BASE_URL
  const masterKey = process.env.JWORDEN_MASTER_KEY
  const adminUser = process.env.ADMIN_USERNAME
  const adminPass = process.env.ADMIN_PASSWORD

  if (!apiBase) throw new Error('VITE_API_BASE_URL is not set.')
  if (!masterKey && !(adminUser && adminPass)) {
    throw new Error('No backend auth credentials configured for token exchange.')
  }

  let res: Response | null = null
  let lastError = ''

  if (masterKey) {
    res = await fetch(`${apiBase}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${masterKey}`,
      },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res?.statusText }))
      lastError = String(body.detail || `Backend bearer token exchange failed (${res.status})`)
    }
  }

  if ((!res || !res.ok) && adminUser && adminPass) {
    const basic = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
    res = await fetch(`${apiBase}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
      },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res?.statusText }))
      const basicError = String(body.detail || `Backend basic token exchange failed (${res.status})`)
      lastError = lastError ? `${lastError}; ${basicError}` : basicError
    }
  }

  if (!res || !res.ok) {
    throw new Error(lastError || 'Backend token endpoint request failed.')
  }

  const data = await res.json()
  const nowSeconds = Math.floor(Date.now() / 1000)
  return {
    token: data.access_token,
    expires_at: nowSeconds + (data.expires_in ?? TOKEN_TTL_SECONDS),
  }
}

async function signLocally() {
  const secret = process.env.JWT_SECRET_KEY
  if (!secret) throw new Error('JWT_SECRET_KEY is not set.')

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = nowSeconds + TOKEN_TTL_SECONDS
  const secretBytes = new TextEncoder().encode(secret)

  const token = await new SignJWT({
    sub: 'frontend-client',
    tenant_id: 'JWORDEN_HQ',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiresAt)
    .sign(secretBytes)

  return { token, expires_at: expiresAt }
}

export const handler: Handler = async (event) => {
  const headers = cors(event.headers.origin)

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const useBackend = String(process.env.USE_BACKEND_TOKEN_ENDPOINT || 'true').toLowerCase() === 'true'
    const payload = useBackend ? await fetchBackendToken() : await signLocally()
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  } catch (error) {
    return {
      statusCode: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to issue token' }),
    }
  }
}
