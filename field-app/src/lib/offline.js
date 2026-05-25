import { openDB } from 'idb'

const DB_NAME    = 'wf-offline'
const DB_VERSION = 1
const STORE      = 'queue'

let _db = null

async function db() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('status', 'status')
      }
    },
  })
  return _db
}

export async function enqueue(entry) {
  const d = await db()
  return d.add(STORE, { ...entry, status: 'pending', createdAt: Date.now() })
}

export async function getPending() {
  const d = await db()
  return d.getAllFromIndex(STORE, 'status', 'pending')
}

export async function markDone(id) {
  const d = await db()
  const item = await d.get(STORE, id)
  if (item) await d.put(STORE, { ...item, status: 'done', syncedAt: Date.now() })
}

export async function markFailed(id, error) {
  const d = await db()
  const item = await d.get(STORE, id)
  if (item) await d.put(STORE, { ...item, status: 'failed', error, retries: (item.retries ?? 0) + 1 })
}

export async function countPending() {
  const pending = await getPending()
  return pending.length
}
