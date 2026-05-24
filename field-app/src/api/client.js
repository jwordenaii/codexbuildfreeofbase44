import { getToken } from '../lib/auth'
import { enqueue } from '../lib/offline'

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function request(method, path, { body, form, signal } = {}) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  let fetchBody
  if (form) {
    fetchBody = form          // FormData — no Content-Type header, browser sets boundary
  } else if (body) {
    headers['Content-Type'] = 'application/json'
    fetchBody = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: fetchBody, signal })

  if (res.status === 401) {
    // Token expired — force re-login
    window.dispatchEvent(new CustomEvent('wf:auth-expired'))
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `HTTP ${res.status}`)
  }

  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const api = {
  get:    (path, opts)  => request('GET',    path, opts),
  post:   (path, opts)  => request('POST',   path, opts),
  patch:  (path, opts)  => request('PATCH',  path, opts),
  delete: (path, opts)  => request('DELETE', path, opts),
}

// For mutations that must survive offline — enqueues and retries on reconnect
export async function offlinePost(path, body, tag) {
  try {
    return await api.post(path, { body })
  } catch (err) {
    if (!navigator.onLine) {
      await enqueue({ method: 'POST', path, body, tag })
      return { queued: true }
    }
    throw err
  }
}
