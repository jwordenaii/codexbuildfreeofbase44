import BottomNav from './BottomNav'
import OfflineBanner from './OfflineBanner'

export default function AppShell({ children }) {
  return (
    <div className="flex flex-col h-full bg-surface-900">
      <OfflineBanner />
      <main className="flex-1 overflow-y-auto pb-safe">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
