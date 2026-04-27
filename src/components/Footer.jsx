import { Link } from 'react-router-dom'
import SocialLinks from './SocialLinks'

const LINKS = [
  { to: '/',               label: 'Home' },
  { to: '/services',       label: 'Services' },
  { to: '/projects',       label: 'Projects' },
  { to: '/service-areas',  label: 'Service Areas' },
  { to: '/blog',           label: 'Blog & Resources' },
  { to: '/about',          label: 'About' },
  { to: '/reviews',        label: 'Reviews' },
  { to: '/advisory',       label: 'Advisory Board' },
  { to: '/quote',          label: 'Free Quote' },
  { to: '/contact',        label: 'Contact' },
]

const SERVICES = [
  'Asphalt Paving',
  'Sealcoating',
  'Crack Filling',
  'Parking Lots',
  'Driveways',
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
              <p className="font-display font-black text-white text-lg mb-1">
                Follow Our Work
              </p>
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
              Fourth-generation asphalt paving since 1984. Trusted by KFC, Arby&apos;s,
              Taco Bell, and hundreds of homeowners across the region.
            </p>
            <div className="mt-4 flex gap-2 text-xs text-white/40">
              <span>⭐ 4.9/5</span>
              <span>·</span>
              <span>87 Google Reviews</span>
            </div>
            <div className="mt-5">
              <SocialLinks size="md" variant="icon" />
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
            <h3 className="font-bold text-white mb-2 text-sm uppercase tracking-widest">
              Contact
            </h3>
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
            <p className="text-xs text-white/40 mt-2 leading-relaxed">
              1601 Ware Bottom Springs Rd<br />Suite 214, Chester VA 23836
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
