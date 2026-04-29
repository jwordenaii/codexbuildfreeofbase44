import { Link } from 'react-router-dom'
import SocialLinks from './SocialLinks'

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/jwordenai', label: 'JWORDENAI™' },
  { to: '/services', label: 'Services' },
  { to: '/projects', label: 'Projects' },
  { to: '/service-areas', label: 'Service Areas' },
  { to: '/blog', label: 'Blog & Resources' },
  { to: '/about', label: 'About' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/advisory', label: 'Advisory Board' },
  { to: '/quote', label: 'Free Quote' },
  { to: '/contact', label: 'Contact' },
]

const SERVICES = ['Asphalt Paving', 'Sealcoating', 'Crack Filling', 'Parking Lots', 'Driveways']

const SOCIAL_LINKS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/jwordenpaving/',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/showcase/j.-worden-%26-sons-paving-l.l.c./',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: 'Nextdoor',
    href: 'https://nextdoor.com/pages/nashville-asphalt-paving-pros-chester-va/photos/',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1 17v-6H8l4-6 4 6h-3v6h-2z" />
      </svg>
    ),
  },
  {
    label: 'Alignable',
    href: 'https://www.alignable.com/chester-va/j-worden-sons-paving',
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
  },
  {
    label: 'Houzz',
    href: 'https://www.houzz.com/professionals/stone-pavers-and-concrete/j-worden-and-sons-paving-l-l-c-pfvwus-pf~663227484',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11.24 0v9.38L2 13.25V24h9.24v-6.76H12.8V24H22V13.25L11.24 0zm1.52 15.62H11.2v-3.5h1.56v3.5z" />
      </svg>
    ),
  },
]

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-brand-navy text-white/80">
      {/* ── Social bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="font-display font-black text-white text-lg mb-1">Follow Our Work</p>
              <p className="text-white/50 text-sm">
                Before &amp; afters, crew in the field, and local paving tips.
              </p>
            </div>
            <SocialLinks
              size="lg"
              variant="badge"
              className="flex-wrap justify-center md:justify-end"
            />
          </div>
        </div>
      </div>

      {/* ── Main footer ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-brand-amber rounded-md flex items-center justify-center font-display font-black text-brand-navy text-sm">
                JW
              </div>
              <span className="font-display font-black text-white text-lg">
                J. Worden <span className="text-brand-amber">&amp; Sons</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/60">
              Fourth-generation asphalt paving since 1984. Trusted by KFC, Arby&apos;s, Taco Bell,
              and hundreds of homeowners across the region.
            </p>
            <div className="mt-4 flex gap-2 text-xs text-white/40">
              <span>⭐ 4.9/5</span>
              <span>·</span>
              <span>87 Google Reviews</span>
            </div>
            {/* Social links */}
            <div className="mt-5 flex flex-wrap gap-3">
              {SOCIAL_LINKS.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-brand-amber transition-colors"
                >
                  {icon}
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-widest">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-sm text-white/60 hover:text-brand-amber transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services + Contact */}
          <div>
            <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-widest">
              Services
            </h3>
            <ul className="space-y-2 mb-6">
              {SERVICES.map((s) => (
                <li key={s} className="text-sm text-white/60">
                  {s}
                </li>
              ))}
            </ul>
            <h3 className="font-bold text-white mb-2 text-sm uppercase tracking-widest">Contact</h3>
            <a
              href="tel:+18044461296"
              className="text-brand-amber font-bold text-sm hover:underline"
              onClick={() => {
                if (typeof window.gtag === 'function')
                  window.gtag('event', 'phone_click', { location: 'footer' })
              }}
            >
              (804) 446-1296
            </a>
            <p className="text-xs text-white/40 mt-1">Mon–Fri 7am–5pm</p>
            <p className="text-xs text-white/50 mt-2">
              Email:{' '}
              <a
                href="mailto:j.wordenandsonspaving@gmail.com"
                className="text-brand-amber hover:underline"
                onClick={() => {
                  if (typeof window.gtag === 'function')
                    window.gtag('event', 'email_click', { location: 'footer' })
                }}
              >
                j.wordenandsonspaving@gmail.com
              </a>
            </p>
            <p className="text-xs text-white/40 mt-2 leading-relaxed">
              1601 Ware Bottom Springs Rd
              <br />
              Suite 214, Chester VA 23836
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-white/30">
          <p>© {year} J. Worden &amp; Sons Asphalt Paving. All rights reserved.</p>
          <p>Licensed &amp; Insured · Est. 1984 · 4th Generation</p>
        </div>
      </div>
    </footer>
  )
}
