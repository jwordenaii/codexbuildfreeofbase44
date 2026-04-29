# Frontend Integration Guide — J. Worden & Sons

This document explains how the React/Vite frontend authenticates with the FastAPI backend and provides links to the complete working examples.

---

## Quick Links

| File | Purpose |
|---|---|
| [`FRONTEND_AUTH_EXAMPLE.ts`](./FRONTEND_AUTH_EXAMPLE.ts) | Complete auth system: token fetch, in-memory storage, `apiFetch` wrapper, typed API helpers |
| [`FRONTEND_REACT_HOOKS.ts`](./FRONTEND_REACT_HOOKS.ts) | React hooks: `useAuth`, `useCrmLeads`, `useAuthGuard`, `useTokenRefresh` |
| [`FRONTEND_NETLIFY_FUNCTION.ts`](./FRONTEND_NETLIFY_FUNCTION.ts) | Server-side Netlify Function that generates JWTs without exposing secrets to the browser |

---

## How Authentication Works

```
Browser                  Netlify Function           FastAPI Backend
  │                           │                           │
  │  POST /.netlify/functions/get-token                   │
  │──────────────────────────►│                           │
  │                           │  (reads JWORDEN_MASTER_KEY│
  │                           │   from server env, signs  │
  │                           │   JWT with JWT_SECRET_KEY)│
  │  { token, expires_at }    │                           │
  │◄──────────────────────────│                           │
  │                           │                           │
  │  GET /api/v1/crm/leads                                │
  │  Authorization: Bearer <JWT>                          │
  │───────────────────────────────────────────────────────►
  │                           │                           │
  │  { leads: [...] }         │                           │
  │◄───────────────────────────────────────────────────────
```

1. The browser calls a **Netlify Function** (server-side) to get a JWT.
2. The Netlify Function reads `JWORDEN_MASTER_KEY` from its own environment — the browser never sees it.
3. The JWT is stored **in memory only** (a module-level variable). It is never written to `localStorage`, `sessionStorage`, or a cookie.
4. Every protected API call goes through `apiFetch`, which injects `Authorization: Bearer <token>` automatically.
5. On a `401`/`403` response, `apiFetch` refreshes the token and retries once.
6. A proactive refresh fires 5 minutes before expiry so users never hit an expired-token error mid-session.

---

## Environment Variables

### Safe to expose (VITE_ prefix — bundled into browser JS)

| Variable | Example value | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.jwordenasphaltpaving.com` | Backend base URL |
| `VITE_SITE_URL` | `https://jwordenasphaltpaving.com` | Public site URL |
| `VITE_GA4_ID` | `G-XXXXXXXXXX` | Google Analytics |
| `VITE_GOOGLE_MAPS_API_KEY` | `AIza...` | Restrict to your domain in GCP |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Publishable key only |

### Never expose (server-side only — no VITE_ prefix)

| Variable | Where it lives | Why |
|---|---|---|
| `JWORDEN_MASTER_KEY` | Netlify env + Railway/Render backend env | Long-lived master API key. Any `VITE_` var is bundled into browser JS and visible to anyone who opens DevTools. |
| `JWT_SECRET_KEY` | Railway/Render backend env only | HS256 signing secret. If leaked, anyone can forge tokens. |
| `ADMIN_PASSWORD` | Railway/Render backend env only | HTTP Basic auth for the `/admin` dashboard. |

> **Rule of thumb:** If a variable contains a secret, password, or private key, it must never have a `VITE_` prefix. Vite statically replaces `import.meta.env.VITE_*` at build time, embedding the value in the JavaScript bundle that ships to every visitor's browser.

---

## Setup Steps

### 1. Add the Netlify Function

Copy `FRONTEND_NETLIFY_FUNCTION.ts` to `netlify/functions/get-token.ts`.

Install the `jose` JWT library (used by the function):

```bash
npm install jose
npm install --save-dev @netlify/functions
```

Add the functions directory to `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"
```

### 2. Set Netlify Environment Variables

In the Netlify UI → **Site configuration → Environment variables**, add:

| Key | Value |
|---|---|
| `JWORDEN_MASTER_KEY` | The master API key from your backend `.env` |
| `JWT_SECRET_KEY` | The JWT signing secret from your backend `.env` |
| `VITE_API_BASE_URL` | Your deployed backend URL |

### 3. Copy the Auth Files into Your Project

```
src/
  auth/
    authClient.ts        ← copy from FRONTEND_AUTH_EXAMPLE.ts
  hooks/
    useAuth.ts           ← copy from FRONTEND_REACT_HOOKS.ts (AuthProvider + useAuth)
    useCrmLeads.ts       ← copy from FRONTEND_REACT_HOOKS.ts (useCrmLeads)
    useAuthGuard.ts      ← copy from FRONTEND_REACT_HOOKS.ts (useAuthGuard)
netlify/
  functions/
    get-token.ts         ← copy from FRONTEND_NETLIFY_FUNCTION.ts
```

### 4. Wrap Your App Root

```tsx
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import App from './App'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
)
```

### 5. Use in a Component

```tsx
// src/components/commandCenter/CRMPanel.tsx
import { useCrmLeads } from '../../hooks/useCrmLeads'
import { useAuthGuard } from '../../hooks/useAuthGuard'

export default function CRMPanel() {
  const guard = useAuthGuard()
  if (guard) return guard  // renders spinner or error UI while auth initialises

  const { leads, funnel, isLoading, error, updateStage, isUpdating, refetch } =
    useCrmLeads()

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={refetch} />

  return (
    <table>
      {leads.map(lead => (
        <LeadRow
          key={lead.id}
          lead={lead}
          onStageChange={(stage) => updateStage({ leadId: lead.id, stage })}
          isUpdating={isUpdating}
        />
      ))}
    </table>
  )
}
```

---

## Backend Auth Contract

The FastAPI backend (`app/core/security.py`) accepts two auth methods on every protected endpoint:

| Method | Header | When to use |
|---|---|---|
| Master key | `Authorization: Bearer <JWORDEN_MASTER_KEY>` | Internal tools, server-to-server only |
| JWT | `Authorization: Bearer <signed-JWT>` | Frontend clients — token issued by Netlify Function |

The JWT must be:
- Algorithm: `HS256`
- Signed with: `JWT_SECRET_KEY`
- Claims: `sub` (any string), `tenant_id` (e.g. `"JWORDEN_HQ"`), `exp` (Unix timestamp)

Protected endpoints return:
- `403` — no token provided, or token is invalid/expired
- `500` — `JWT_SECRET_KEY` is not configured on the backend

---

## Token Refresh Behaviour

| Scenario | What happens |
|---|---|
| App loads | `AuthProvider` calls `initAuth()`, which fetches a fresh token |
| Token is 5+ minutes from expiry | Proactive refresh fires automatically in the background |
| API call returns `401` or `403` | `apiFetch` refreshes the token and retries the request once |
| Multiple concurrent `401`s | Only one refresh request is made (deduplicated via promise cache) |
| Refresh fails | `AuthProvider` sets `error` state; `useAuthGuard` renders an error UI with a Retry button |
| Page reload | Token is cleared from memory; `AuthProvider` fetches a new one on mount |

---

## Local Development

Run the Netlify dev server to test the function locally:

```bash
npm install -g netlify-cli
netlify dev
```

This starts both the Vite dev server and the Netlify Functions runtime. The function is available at:

```
POST http://localhost:8888/.netlify/functions/get-token
```

Test it with curl:

```bash
curl -X POST http://localhost:8888/.netlify/functions/get-token
# → { "token": "eyJ...", "expires_at": 1234567890 }
```

Verify the token works against the backend:

```bash
TOKEN=$(curl -s -X POST http://localhost:8888/.netlify/functions/get-token | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/crm/leads
```

---

## Security Checklist

- [ ] `JWORDEN_MASTER_KEY` is set in Netlify env vars (not in any `VITE_` variable)
- [ ] `JWT_SECRET_KEY` is set in Netlify env vars (not in any `VITE_` variable)
- [ ] `ALLOWED_ORIGINS` in `get-token.ts` matches your production and preview domains
- [ ] The Netlify Function is not publicly documented or linked (security through obscurity is not sufficient, but no need to advertise it)
- [ ] JWT is stored in memory only — no `localStorage.setItem('token', ...)` anywhere
- [ ] `apiFetch` is used for all protected API calls — no raw `fetch` with manual auth headers
- [ ] Backend `JWT_SECRET_KEY` is a long random string (at least 32 characters): `openssl rand -hex 32`
