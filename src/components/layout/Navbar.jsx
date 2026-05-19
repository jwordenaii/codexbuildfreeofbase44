import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X, Phone, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SITE } from '@/config/site.js'
import { trackPhoneClick } from '@/lib/analytics.js'
import { cn } from '@/lib/utils.js'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Service Areas', to: '/service-areas' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isHome = pathname === '/'
  const transparent = isHome && !scrolled && !menuOpen

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        transparent
          ? 'bg-transparent py-4'
          : 'bg-navy/97 backdrop-blur-md border-b border-white/10 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)] py-3'
      )}
    >
      <nav className="container-wide flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sand text-navy font-display text-lg font-bold">
            OBX
          </div>
          <div className="hidden sm:block">
            <p className="font-display text-white text-xl uppercase leading-none tracking-wide">
              OBX Paving Co.
            </p>
            <p className="text-white/50 text-[10px] uppercase tracking-[0.18em]">
              Outer Banks, NC
            </p>
          </div>
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(({ label, to }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'text-sand bg-white/10'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  )
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <a
            href={SITE.phoneHref}
            onClick={() => trackPhoneClick('navbar')}
            className="flex items-center gap-2 text-white/90 hover:text-white text-sm font-medium transition-colors"
          >
            <Phone className="w-4 h-4 text-sand" />
            {SITE.phone}
          </a>
          <Link
            to="/contact"
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Free Quote
          </Link>
        </div>

        {/* Mobile phone + hamburger */}
        <div className="flex items-center gap-3 lg:hidden">
          <a
            href={SITE.phoneHref}
            onClick={() => trackPhoneClick('navbar_mobile')}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-sand text-navy"
            aria-label="Call now"
          >
            <Phone className="w-4 h-4" />
          </a>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="lg:hidden bg-navy border-t border-white/10 overflow-hidden"
          >
            <div className="container-wide py-4 space-y-1">
              {NAV_LINKS.map(({ label, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      isActive ? 'bg-ocean/20 text-sand' : 'text-white/80 hover:text-white hover:bg-white/10'
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
              <div className="pt-4 border-t border-white/10">
                <Link to="/contact" className="btn-primary w-full justify-center py-3.5 text-sm">
                  Get Free Quote
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
