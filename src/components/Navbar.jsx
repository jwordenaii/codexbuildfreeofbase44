import { useState, useEffect, useCallback } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/',               label: 'Home' },
  { to: '/services',       label: 'Services' },
  { to: '/about',          label: 'About' },
  { to: '/reviews',        label: 'Reviews' },
  { to: '/advisory',       label: 'Advisory' },
  { to: '/command-center', label: 'Command Center' },
  { to: '/contact',        label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => { setOpen(false) }, [pathname])

  const handleScroll = useCallback(() => setScrolled(window.scrollY > 20), [])
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-brand-navy shadow-lg' : 'bg-brand-navy/90 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" aria-label="J. Worden & Sons — Home">
            <div className="w-8 h-8 bg-brand-amber rounded-md flex items-center justify-center font-display font-black text-brand-navy text-sm">
              JW
            </div>
            <span className="font-display font-black text-white text-lg leading-tight">
              J. Worden <span className="text-brand-amber">&amp; Sons</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-amber text-brand-navy'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <Link
              to="/quote"
              className="ml-4 btn-primary text-sm !py-2"
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              /* Hamburger icon */
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        <div
          id="mobile-menu"
          role="navigation"
          aria-label="Mobile navigation"
          className={`md:hidden overflow-hidden transition-all duration-300 ${
            open ? 'max-h-96 pb-4 border-t border-white/10' : 'max-h-0'
          }`}
        >
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `block px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-brand-amber text-brand-navy'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          <Link
            to="/quote"
            className="mt-3 mx-4 btn-primary text-sm justify-center"
            onClick={() => {
              if (typeof window.gtag === 'function')
                window.gtag('event', 'cta_click', { location: 'navbar_mobile' })
            }}
          >
            Get a Free Quote
          </Link>
        </div>
      </div>
    </header>
  )
}
