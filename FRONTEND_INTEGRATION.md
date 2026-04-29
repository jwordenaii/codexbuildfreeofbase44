# Frontend Integration Guide

How to authenticate the frontend with the JWordenAI backend and call protected endpoints.

---

## Overview

The backend supports two authentication methods:

| Method | Use case | Expiry |
|---|---|---|
| **Master key** (`JWORDEN_MASTER_KEY`) | Server-to-server, internal tools | Never |
| **JWT** (signed with `JWT_SECRET_KEY`) | Frontend apps, short-lived sessions | 24 hours |

**The master key must never be exposed in browser JavaScript.** It is a server-side secret. The frontend should exchange it for a JWT at startup using a server-side function (e.g. a Netlify Function, Next.js API route, or Vite SSR handler), then store only the JWT in memory.

---

## Environment Variables

### Backend (Railway)

These are already set in Railway and are never sent to the browser:

```
JWORDEN_MASTER_KEY=<long-lived secret>
JWT_SECRET_KEY=<signing secret>
```

### Frontend (Netlify / Vite)

Only these variables should have a `VITE_` prefix — they are safe to expose in browser JavaScript:

```
VITE_API_BASE_URL=https://<your-railway-domain>
VITE_SITE_URL=https://jwordenasphaltpaving.com
VITE_GA4_ID=G-XXXXXXXXXX
VITE_GOOGLE_MAPS_API_KEY=AIza...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Never set `VITE_MASTER_API_KEY` or `VITE_JWT_SECRET_KEY`.** Vite embeds `VITE_*` variables into the compiled JavaScript bundle, making them visible to anyone who inspects the page source.

---

## Authentication Flow

```
Frontend startup
      │
      ▼
Server-side function (Netlify Function / API route)
  reads JWORDEN_MASTER_KEY from env
  POST /api/v1/auth/token  ← not yet implemented; use JWT library directly
      │
      ▼
JWT returned to frontend (stored in memory only)
      │
      ▼
All protected API calls include:
  Authorization: Bearer <jwt>
      │
      ▼
Token expires after 24 hours → repeat from top
```

> **Note:** A dedicated `/auth/token` endpoint is not yet implemented. Until it is, generate the JWT in a server-side function using the `jose` library (Node.js) or equivalent, signing with `JWT_SECRET_KEY`. See the example below.

---

## Generating a JWT (Server-Side Only)

### Node.js / TypeScript (Netlify Function or Next.js API Route)

Install the dependency:

```bash
npm install jose
```

```typescript
// netlify/functions/get-token.ts  (or pages/api/token.ts for Next.js)
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET_KEY!);

export async function handler() {
  const token = await new SignJWT({
    sub: "frontend-app",
    tenant_id: "JWORDEN_HQ",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, expires_in: 86400 }),
  };
}
```

**This function runs on the server.** `JWT_SECRET_KEY` is never sent to the browser.

---

## Storing the JWT Securely

Store the JWT in a JavaScript module-level variable (in-memory). Do not store it in `localStorage` or `sessionStorage` — those are accessible to any script on the page and vulnerable to XSS.

```typescript
// src/lib/auth.ts

let _token: string | null = null;
let _expiresAt: number = 0;

export async function getToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if it has more than 5 minutes remaining
  if (_token && _expiresAt - now > 5 * 60 * 1000) {
    return _token;
  }

  // Fetch a fresh token from the server-side function
  const res = await fetch("/.netlify/functions/get-token");
  if (!res.ok) {
    throw new Error(`Failed to obtain auth token: ${res.status}`);
  }

  const { token, expires_in } = await res.json();
  _token = token;
  _expiresAt = now + expires_in * 1000;

  return _token;
}

export function clearToken(): void {
  _token = null;
  _expiresAt = 0;
}
```

---

## Sending the JWT in Request Headers

Wrap `fetch` so every protected API call automatically includes the token:

```typescript
// src/lib/api.ts
import { getToken } from "./auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
}
```

Usage:

```typescript
// Fetch CRM leads
const res = await apiFetch("/api/v1/crm/leads?pipeline_stage=new");
const data = await res.json();

// Update a lead stage
const res = await apiFetch("/api/v1/crm/leads/42/stage", {
  method: "PATCH",
  body: JSON.stringify({ pipeline_stage: "contacted" }),
});
```

---

## Calling Public Endpoints

Public endpoints (quote, contact, chat, estimate) do not require a token. Call them directly:

```typescript
// src/lib/api.ts
export async function publicFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}
```

```typescript
// Submit a quote
const res = await publicFetch("/api/v1/leads/quote", {
  method: "POST",
  body: JSON.stringify({
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "804-555-0100",
    service_type: "sealcoating",
    property_type: "residential",
    urgency: "within_1_month",
    project_size_sqft: 2000,
  }),
});

// AI chat
const res = await publicFetch("/api/v1/ai/chat", {
  method: "POST",
  body: JSON.stringify({
    question: userMessage,
    session_id: sessionId,
    state_code: "VA",
  }),
});
```

---

## Handling Token Expiry (24-Hour Refresh)

The `getToken()` function above automatically refreshes the token when it has less than 5 minutes remaining. No additional logic is needed in most cases.

For long-running single-page sessions (e.g. a dashboard left open overnight), add a proactive refresh on a timer:

```typescript
// src/lib/auth.ts — add to module initialization
const REFRESH_INTERVAL_MS = 23 * 60 * 60 * 1000; // 23 hours

export function startTokenRefresh(): () => void {
  const id = setInterval(async () => {
    try {
      await getToken(); // forces a refresh if near expiry
    } catch (err) {
      console.error("Token refresh failed:", err);
    }
  }, REFRESH_INTERVAL_MS);

  return () => clearInterval(id); // call this on component unmount
}
```

---

## Error Handling for 401 / 403 Responses

```typescript
// src/lib/api.ts
import { clearToken, getToken } from "./auth";

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<Response> {
  const token = await getToken();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if ((res.status === 401 || res.status === 403) && !retried) {
    // Token may have been invalidated server-side — clear cache and retry once
    clearToken();
    return apiFetch(path, options, true);
  }

  if (res.status === 403) {
    // Second failure — surface the error to the user
    throw new Error("Access denied. Please contact your administrator.");
  }

  if (res.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  return res;
}
```

---

## React Hook Example

```typescript
// src/hooks/useCrmLeads.ts
import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface Lead {
  id: number;
  name: string;
  email: string;
  pipeline_stage: string;
  score_label: string;
}

export function useCrmLeads(stage?: string) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = stage ? `?pipeline_stage=${stage}` : "";

    apiFetch(`/api/v1/crm/leads${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setLeads(data.leads))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [stage]);

  return { leads, loading, error };
}
```

---

## CORS Configuration

The backend allows requests from these origins by default:

- `https://jworden.netlify.app`
- `https://jwordenasphaltpaving.com`
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000`

To add a new origin (e.g. a staging domain), set `EXTRA_CORS_ORIGINS` in the Railway API service variables:

```
EXTRA_CORS_ORIGINS=https://staging.jwordenasphaltpaving.com,https://preview--jworden.netlify.app
```

Redeploy the API service after saving.

---

## Summary Checklist

- [ ] `JWT_SECRET_KEY` is set in Railway (never in Netlify with a `VITE_` prefix)
- [ ] `JWORDEN_MASTER_KEY` is set in Railway (never exposed to the browser)
- [ ] Server-side function generates JWTs and returns them to the frontend
- [ ] Frontend stores the JWT in memory only (not `localStorage`)
- [ ] `apiFetch` wrapper adds `Authorization: Bearer <token>` to all protected calls
- [ ] 401/403 responses trigger a token refresh and single retry
- [ ] Frontend origin is listed in `EXTRA_CORS_ORIGINS` if not already in the default list
