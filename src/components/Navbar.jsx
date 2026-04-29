import { useState, useEffect, useCallback } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/jwordenai', label: 'JWORDENAI™', highlight: true },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/advisory', label: 'Advisory' },
  { to: '/command-center', label: 'Command Center' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const handleScroll = useCallback(() => setScrolled(window.scrollY > 20), [])
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-350 ${
        scrolled
          ? 'bg-brand-navy shadow-xl border-b border-white/5'
          : 'bg-brand-navy/92 backdrop-blur-xl border-b border-white/8'
      }`}
      style={{ backdropFilter: scrolled ? 'none' : 'blur(20px) saturate(180%)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[62px]">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group"
            aria-label="J. Worden & Sons — Home"
          >
            <div className="w-9 h-9 bg-brand-amber rounded-lg flex items-center justify-center font-display font-black text-brand-navy text-sm shadow-amber group-hover:scale-105 transition-transform duration-250">
              JW
            </div>
            <span className="font-display font-black text-white text-[17px] leading-tight tracking-tight">
              J. Worden <span className="text-brand-amber">&amp; Sons</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Primary navigation">
            {NAV_LINKS.map(({ to, label, highlight }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  highlight
                    ? `px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 border ${
                        isActive
                          ? 'bg-brand-amber text-brand-navy border-brand-amber shadow-amber'
                          : 'text-brand-amber border-brand-amber/50 hover:bg-brand-amber/12 hover:border-brand-amber/80'
                      }`
                    : `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-brand-amber text-brand-navy font-bold'
                          : 'text-white/75 hover:text-white hover:bg-white/8'
                      }`
                }
              >
                {label}
              </NavLink>
            ))}
            <Link
              to="/quote"
              className="ml-3 btn-primary text-sm !py-2 !px-5 !rounded-lg"
              onClick={() => {
                if (typeof window.gtag === 'function')
                  window.gtag('event', 'cta_click', { location: 'navbar' })
              }}
            >
              Free Quote
            </Link>
          </nav>

          {/* Hamburger */}
          <button
            id="mobile-menu-button"
            className="md:hidden text-white p-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-amber"
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              /* X icon */
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              /* Hamburger icon */
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        <div
          id="mobile-menu"
          role="navigation"
          aria-label="Mobile navigation"
          className={`md:hidden overflow-hidden transition-all duration-350 ${
            open ? 'max-h-[520px] pb-4 border-t border-white/8' : 'max-h-0'
          }`}
        >
          <div className="pt-2 space-y-0.5">
            {NAV_LINKS.map(({ to, label, highlight }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  highlight
                    ? `flex items-center px-4 py-3 text-sm font-bold rounded-xl mx-1 transition-all border ${
                        isActive
                          ? 'bg-brand-amber text-brand-navy border-brand-amber'
                          : 'text-brand-amber border-brand-amber/30 hover:bg-brand-amber/10'
                      }`
                    : `flex items-center px-4 py-3 text-sm font-medium rounded-xl mx-1 transition-all ${
                        isActive
                          ? 'bg-brand-amber text-brand-navy font-bold'
                          : 'text-white/75 hover:text-white hover:bg-white/8'
                      }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          <div className="mx-3 mt-3">
            <Link
              to="/quote"
              className="btn-primary w-full text-sm justify-center py-3"
              onClick={() => {
                if (typeof window.gtag === 'function')
                  window.gtag('event', 'cta_click', { location: 'navbar_mobile' })
              }}
            >
              Get a Free Quote
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
