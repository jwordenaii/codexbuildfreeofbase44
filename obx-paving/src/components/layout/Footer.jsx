import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, Facebook, Instagram, Star } from 'lucide-react'
import { SITE, SERVICES, AREAS } from '@/config/site.js'
import { trackPhoneClick } from '@/lib/analytics.js'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-navy text-white">
      {/* Top CTA strip */}
      <div className="bg-ocean/20 border-b border-white/10">
        <div className="container-wide py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="font-display text-xl uppercase tracking-wide text-white">
            Ready to start your project?
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={SITE.phoneHref}
              onClick={() => trackPhoneClick('footer')}
              className="btn-outline text-sm px-6 py-2.5"
            >
              <Phone className="w-4 h-4" />
              {SITE.phone}
            </a>
            <Link to="/contact" className="btn-primary text-sm px-6 py-2.5">
              Get Free Quote
            </Link>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="container-wide py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-1">
          <Link to="/" className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-sand text-navy font-display text-xl flex items-center justify-center">
              OBX
            </div>
            <div>
              <p className="font-display text-lg uppercase tracking-wide text-white leading-none">
                OBX Paving Co.
              </p>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">
                Outer Banks, NC
              </p>
            </div>
          </Link>
          <p className="text-white/60 text-sm leading-relaxed mb-5 max-w-xs">
            Premium asphalt paving and sealcoating built for the coastal environment of
            the Outer Banks and surrounding communities.
          </p>
          <div className="space-y-2 text-sm">
            <a
              href={SITE.phoneHref}
              onClick={() => trackPhoneClick('footer_detail')}
              className="flex items-center gap-2 text-white/70 hover:text-sand transition-colors"
            >
              <Phone className="w-4 h-4 shrink-0 text-sand" />
              {SITE.phone}
            </a>
            <a
              href={`mailto:${SITE.email}`}
              className="flex items-center gap-2 text-white/70 hover:text-sand transition-colors"
            >
              <Mail className="w-4 h-4 shrink-0 text-sand" />
              {SITE.email}
            </a>
            <div className="flex items-center gap-2 text-white/60">
              <MapPin className="w-4 h-4 shrink-0 text-sand" />
              {SITE.address}
            </div>
          </div>
          {/* Social */}
          <div className="flex gap-3 mt-5">
            <a
              href={SITE.social.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-ocean hover:text-white transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="w-4 h-4" />
            </a>
            <a
              href={SITE.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-ocean hover:text-white transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href={SITE.social.google}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-sand hover:text-navy transition-colors"
              aria-label="Google Reviews"
            >
              <Star className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Services */}
        <div>
          <p className="font-display text-sm uppercase tracking-[0.18em] text-sand mb-4">
            Services
          </p>
          <ul className="space-y-2">
            {SERVICES.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/services#${s.id}`}
                  className="text-white/60 text-sm hover:text-white transition-colors"
                >
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Service Areas */}
        <div>
          <p className="font-display text-sm uppercase tracking-[0.18em] text-sand mb-4">
            Service Areas
          </p>
          <ul className="space-y-2">
            {AREAS.primary.slice(0, 8).map((a) => (
              <li key={a.name}>
                <Link
                  to="/service-areas"
                  className="text-white/60 text-sm hover:text-white transition-colors"
                >
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation */}
        <div>
          <p className="font-display text-sm uppercase tracking-[0.18em] text-sand mb-4">
            Company
          </p>
          <ul className="space-y-2">
            {[
              { label: 'Home', to: '/' },
              { label: 'All Services', to: '/services' },
              { label: 'Service Areas', to: '/service-areas' },
              { label: 'About Us', to: '/about' },
              { label: 'Get a Quote', to: '/contact' },
              { label: 'Contact', to: '/contact' },
            ].map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-white/60 text-sm hover:text-white transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Trust badge */}
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-sand text-sand" />
              ))}
            </div>
            <p className="text-white/80 text-xs leading-relaxed">
              5-star rated on Google. Licensed NC Contractor. Fully insured.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-wide py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-white/40">
          <p>© {year} OBX Paving Co. All rights reserved.</p>
          <p>
            Serving the Outer Banks of North Carolina · NC Licensed General Contractor
          </p>
        </div>
      </div>
    </footer>
  )
}
