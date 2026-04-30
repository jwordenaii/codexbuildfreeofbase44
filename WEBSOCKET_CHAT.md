# Real-Time WebSocket Chat — JWordenAI

Live bidirectional chat between customers and J (or the AI) using native FastAPI WebSockets and Socket.IO.

---

## Architecture

```
Customer Browser ──WS──► /ws/chat/{session_id}   (FastAPI WebSocket)
Admin Dashboard  ──WS──► /ws/chat/{session_id}   (FastAPI WebSocket)
                    or
Customer Browser ──SIO──► /sio/socket.io          (Socket.IO)
Admin Dashboard  ──SIO──► /sio/socket.io          (Socket.IO)

Both paths persist messages to:
  PostgreSQL → chat_sessions.messages_json  (serialised history)
  PostgreSQL → chat_messages                (normalised rows)
```

Two transports are available:

| Transport | Path | Best for |
|-----------|------|----------|
| Native WebSocket | `/ws/chat/{session_id}` | Simple browser clients, testing |
| Socket.IO | `/sio/socket.io` | Production frontends (auto-reconnect, rooms) |

---

## Quick Start

### 1. Create a session

```bash
curl -X POST https://your-api.railway.app/api/v1/chat/session \
  -H "Content-Type: application/json" \
  -d '{"customer_name": "Alice", "customer_email": "alice@example.com"}'
```

Response:
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_name": "Alice",
  "customer_email": "alice@example.com",
  "created_at": "2024-01-01T12:00:00+00:00"
}
```

### 2. Connect via WebSocket (browser console)

```javascript
const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const ws = new WebSocket(
  `wss://your-api.railway.app/ws/chat/${sessionId}?role=customer&name=Alice`
);

ws.onopen = () => {
  console.log("Connected!");
  // Send a message
  ws.send(JSON.stringify({ type: "message", content: "Hello!" }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg);
};

ws.onclose = (event) => {
  console.log("Disconnected:", event.code, event.reason);
};
```

### 3. Connect as admin

```javascript
const ws = new WebSocket(
  `wss://your-api.railway.app/ws/chat/${sessionId}?role=admin&token=YOUR_MASTER_KEY&name=J`
);
```

### 4. Retrieve chat history

```bash
curl https://your-api.railway.app/api/v1/chat/history/{session_id}
```

---

## WebSocket Connection Flow

```
Client                          Server
  │                               │
  │── WS Upgrade ────────────────►│  GET /ws/chat/{session_id}?role=customer&name=Alice
  │                               │  • Validate session_id exists in DB
  │                               │  • Validate admin token (if role=admin)
  │◄── 101 Switching Protocols ───│
  │                               │
  │◄── system: "Alice joined" ────│  Broadcast to all in session
  │                               │
  │── {type:"message", ...} ─────►│  Receive message
  │                               │  • Rate limit check (10/min)
  │                               │  • Persist to DB
  │◄── {type:"message", ...} ─────│  Broadcast to all in session
  │                               │
  │── {type:"typing"} ───────────►│
  │◄── {type:"typing", ...} ──────│  Broadcast to all in session
  │                               │
  │── {type:"ping"} ─────────────►│
  │◄── {type:"pong"} ─────────────│
  │                               │
  │── Close ─────────────────────►│
  │◄── system: "Alice left" ──────│  Broadcast to remaining participants
```

---

## Message Format

### Client → Server (incoming)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | `"message"` \| `"typing"` \| `"ping"` |
| `content` | string | for `message` | The message text (max ~10 KB) |
| `sender_name` | string | no | Override display name for this message |

```json
{ "type": "message", "content": "What's the cost for a 2,000 sqft driveway?" }
{ "type": "typing" }
{ "type": "ping" }
```

### Server → Client (outgoing)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"message"` \| `"typing"` \| `"system"` \| `"pong"` \| `"error"` |
| `session_id` | string | The chat session identifier |
| `role` | string | `"customer"` or `"admin"` |
| `sender_name` | string | Display name of the sender |
| `content` | string | Message text or system notification |
| `timestamp` | string | ISO 8601 UTC timestamp |

```json
{
  "type": "message",
  "session_id": "550e8400-...",
  "role": "customer",
  "sender_name": "Alice",
  "content": "What's the cost for a 2,000 sqft driveway?",
  "timestamp": "2024-01-01T12:00:00+00:00"
}
```

---

## Socket.IO (Production Frontend)

Use Socket.IO for production — it handles reconnection, heartbeats, and room management automatically.

### Connection

```javascript
import { io } from "socket.io-client";

const socket = io("https://your-api.railway.app", {
  path: "/sio/socket.io",
  auth: {
    session_id: "550e8400-...",
    role: "customer",
    name: "Alice",
    // token: "..." // only for role=admin
  },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on("connect", () => console.log("Connected:", socket.id));
socket.on("disconnect", (reason) => console.log("Disconnected:", reason));
socket.on("message", (msg) => console.log("New message:", msg));
socket.on("typing", (data) => console.log(`${data.sender_name} is typing...`));
socket.on("system", (data) => console.log("System:", data.content));
socket.on("error", (err) => console.error("Error:", err.content));
```

### Sending events

```javascript
// Send a message
socket.emit("message", { content: "Hello from the customer!" });

// Send typing indicator
socket.emit("typing", {});

// Admin sends a message (with token validation)
socket.emit("admin_message", {
  content: "Hi! This is J — how can I help?",
  token: "YOUR_MASTER_KEY",
});
```

### Socket.IO Events Reference

| Event | Direction | Payload |
|-------|-----------|---------|
| `connect` | client→server | auth: `{session_id, role, token?, name?}` |
| `disconnect` | automatic | — |
| `message` | client→server | `{content, session_id?, sender_name?}` |
| `admin_message` | client→server | `{content, token, session_id?}` |
| `typing` | client→server | `{session_id?}` |
| `message` | server→client | `{type, session_id, role, sender_name, content, timestamp}` |
| `typing` | server→client | `{type, session_id, role, sender_name, timestamp}` |
| `system` | server→client | `{type, session_id, content, timestamp}` |
| `error` | server→client | `{content}` |

---

## HTTP Endpoints

### POST /api/v1/chat/session

Create a new chat session.

**Request body:**
```json
{
  "customer_name": "Alice Smith",
  "customer_email": "alice@example.com"
}
```

**Response:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_name": "Alice Smith",
  "customer_email": "alice@example.com",
  "created_at": "2024-01-01T12:00:00+00:00"
}
```

### GET /api/v1/chat/history/{session_id}

Retrieve full message history for a session.

**Response:**
```json
{
  "session_id": "550e8400-...",
  "messages": [
    {
      "role": "customer",
      "content": "Hello!",
      "sender_name": "Alice",
      "timestamp": "2024-01-01T12:00:00+00:00"
    },
    {
      "role": "admin",
      "content": "Hi Alice! How can I help?",
      "sender_name": "J",
      "timestamp": "2024-01-01T12:00:05+00:00"
    }
  ],
  "created_at": "2024-01-01T12:00:00+00:00",
  "updated_at": "2024-01-01T12:00:05+00:00"
}
```

---

## Rate Limiting

- **10 messages per minute per session** (sliding window, in-memory)
- Exceeding the limit returns an `error` event/message — the connection is NOT closed
- The window resets automatically; the client can resume after 60 seconds
- Typing indicators and pings are **not** rate-limited

---

## Authentication

| Role | Auth method |
|------|-------------|
| Customer | No auth — `session_id` acts as the access token |
| Admin | `token` query param or Socket.IO auth field — accepts `JWORDEN_MASTER_KEY` or a valid JWT |

Admin tokens are validated against the same credentials used by all other protected endpoints (`JWORDEN_MASTER_KEY` env var or `JWT_SECRET_KEY`-signed JWT).

---

## Database Storage

Messages are persisted in two places:

1. **`chat_sessions.messages_json`** — Full history as a JSON array, loaded on every history request. Fast for sequential reads.

2. **`chat_messages`** — Normalised table with one row per message. Queryable by `session_id`, `role`, and `created_at`. Useful for admin dashboards and analytics.

The `ChatSession` model already existed; `ChatMessage` is new and is auto-created on startup when `AUTO_CREATE_TABLES=true`.

---

## Admin Dashboard Integration

To integrate the chat into an admin dashboard:

1. **List active sessions** — query `GET /api/v1/chat/history/{session_id}` for each known session_id, or query the `chat_sessions` table directly.

2. **Connect as admin** — open a WebSocket or Socket.IO connection with `role=admin&token=<key>`.

3. **Receive all messages** — the server broadcasts every message to all participants in the session room, so the admin sees customer messages in real time.

4. **Send replies** — emit `message` (WebSocket) or `admin_message` (Socket.IO) events.

5. **Typing indicator** — emit `typing` to show "J is typing…" in the customer's UI.

---

## Testing

### Browser console (WebSocket)

```javascript
// 1. Create session
const res = await fetch("/api/v1/chat/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customer_name: "Test User" }),
});
const { session_id } = await res.json();

// 2. Connect
const ws = new WebSocket(`ws://localhost:8000/ws/chat/${session_id}?name=TestUser`);
ws.onmessage = e => console.log(JSON.parse(e.data));

// 3. Send message
ws.send(JSON.stringify({ type: "message", content: "Hello!" }));

// 4. Verify in DB
const hist = await fetch(`/api/v1/chat/history/${session_id}`).then(r => r.json());
console.log(hist.messages);

// 5. Test rate limiting (send 11 messages quickly)
for (let i = 0; i < 11; i++) {
  ws.send(JSON.stringify({ type: "message", content: `Message ${i}` }));
}
// 11th message should return an error event

// 6. Test typing indicator
ws.send(JSON.stringify({ type: "typing" }));

// 7. Test ping/pong
ws.send(JSON.stringify({ type: "ping" }));
```

### Admin message test

```javascript
const adminWs = new WebSocket(
  `ws://localhost:8000/ws/chat/${session_id}?role=admin&token=YOUR_KEY&name=J`
);
adminWs.onopen = () => {
  adminWs.send(JSON.stringify({ type: "message", content: "Hi from J!" }));
};
```

---

## Deployment Notes

- **No database migrations needed** — `ChatSession` already exists; `ChatMessage` is auto-created by `AUTO_CREATE_TABLES=true` (default).
- **No new env vars** — uses existing `JWORDEN_MASTER_KEY` and `JWT_SECRET_KEY`.
- **Railway WebSocket support** — Railway's HTTP proxy supports WebSocket upgrades natively; no special configuration required.
- **Scaling** — The in-memory `WebSocketManager` and rate-limit buckets are per-process. For multi-process deployments, use Redis pub/sub for cross-process broadcast (future enhancement).
