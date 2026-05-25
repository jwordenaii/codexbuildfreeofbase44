import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isOwner } from '../lib/auth'

const TABS = [
  {
    to: '/',
    exact: true,
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    label: 'Jobs',
  },
  {
    to: '/scan',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4m10-16h-4a2 2 0 00-2 2v4m6 6h-4a2 2 0 01-2-2v-4" />
        {active && <circle cx="12" cy="12" r="3" fill="currentColor" />}
      </svg>
    ),
    label: 'Scan',
  },
  {
    to: '/trucks',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-4 4h4M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
      </svg>
    ),
    label: 'Fleet',
    ownerOnly: false,
  },
  {
    to: '/profile',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    label: 'Me',
  },
]

export default function BottomNav() {
  const { user } = useAuth()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface-900/95 backdrop-blur-sm
                    border-t border-surface-700/60"
         style={{ paddingBottom: 'var(--safe-bottom)' }}>
      <div className="flex items-stretch">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.exact}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[60px]
               transition-colors duration-150 select-none
               ${isActive ? 'text-brand-500' : 'text-slate-500 active:text-slate-300'}`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                  {tab.icon(isActive)}
                </div>
                <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
                {tab.to === '/' && (
                  <span className={`absolute -top-0.5 w-8 h-0.5 rounded-full bg-brand-500
                                   transition-opacity duration-150`}
                        style={{ opacity: 0 }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
