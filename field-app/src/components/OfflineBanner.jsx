import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2
                    bg-amber-500 text-surface-950 text-sm font-bold py-2 px-4 animate-slide-down"
         style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}>
      <span className="w-2 h-2 rounded-full bg-surface-950 animate-pulse-slow" />
      OFFLINE — changes will sync when reconnected
    </div>
  )
}
