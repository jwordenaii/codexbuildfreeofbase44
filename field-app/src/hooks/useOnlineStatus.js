import { useState, useEffect } from 'react'
import { getPending, markDone, markFailed } from '../lib/offline'
import { api } from '../api/client'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on  = () => { setOnline(true);  flushQueue() }
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return online
}

async function flushQueue() {
  const pending = await getPending()
  for (const item of pending) {
    try {
      await api[item.method.toLowerCase()](item.path, { body: item.body })
      await markDone(item.id)
    } catch {
      await markFailed(item.id, 'sync-failed')
    }
  }
}
