import React, { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { trackPhoneClick } from '@/lib/analytics';
import { PRIMARY_LOGO_URL } from '@/lib/branding';

const NAV_LINKS = [
  { label: 'Paving', href: '/paving' },
  { label: 'Sealcoating', href: '/sealcoating' },
  { label: 'Commercial', href: '/parking-lots' },
  { label: 'Hardscapes', href: '/hardscapes' },
  { label: 'GC', href: '/general-contracting' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'Contact', href: '/contact' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showMiniLogo, setShowMiniLogo] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);
      setShowMiniLogo(y > 520);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href) => {
    setIsOpen(false);
    if (href.startsWith('/')) {
      window.location.href = href;
      return;
    }
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white border-b border-border shadow-[0_12px_28px_rgba(24,24,24,0.12)]'
          : 'bg-white border-b border-border shadow-[0_8px_24px_rgba(24,24,24,0.08)]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex h-[72px] items-center justify-between md:h-20">
          {/* Logo — top left corner */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center min-w-0 shrink-0" aria-label="J. Worden & Sons Paving LLC — Home">
            <img
              src={PRIMARY_LOGO_URL}
              alt="J. Worden & Sons Paving LLC — Quality Work. Built To Last."
              width={560}
              height={120}
              sizes="(max-width: 640px) 190px, (max-width: 768px) 240px, 300px"
              className="h-12 sm:h-14 md:h-16 w-[190px] sm:w-[240px] md:w-[300px] object-contain quality-premium"
            />
          </button>

          {/* Mobile phone CTA */}
          <a
            href="tel:+18044461296"
            onClick={() => trackPhoneClick('navbar_mobile')}
            className="lg:hidden flex items-center gap-1.5 text-primary font-display font-bold text-xs tracking-wider ml-2 flex-shrink-0"
            aria-label="Call (804) 446-1296"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden xs:inline">804-446-1296</span>
          </a>

          {/* Desktop phone CTA (click-to-call) */}
          <a
            href="tel:+18044461296"
            onClick={() => trackPhoneClick('navbar_desktop')}
            className="hidden lg:flex items-center gap-2 text-primary font-display font-bold text-sm tracking-[0.14em] uppercase hover:text-primary/80 transition-colors ml-auto mr-6"
            aria-label="Call (804) 446-1296"
          >
            <Phone className="w-4 h-4" />
            (804) 446-1296
          </a>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-4 xl:gap-5">
            {NAV_LINKS.map((link) =>
            <button
              key={link.label}
              onClick={() => scrollTo(link.href)}
              className="font-display text-xs tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors duration-300 xl:text-sm">
              
                {link.label}
              </button>
            )}
            <button
              onClick={() => scrollTo('#quote')}
              className="premium-cta flex items-center gap-2 text-primary-foreground px-5 py-3 font-display font-bold text-sm tracking-[0.16em] uppercase transition-all min-h-[48px]">
              
              <Phone className="w-4 h-4" />
              Free Estimate
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden text-foreground p-2 min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Toggle menu">
            
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen &&
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="lg:hidden bg-white/98 backdrop-blur-xl border-b border-border overflow-hidden">
          
            <div className="px-6 py-6 space-y-1">
              {NAV_LINKS.map((link) =>
            <button
              key={link.label}
              onClick={() => scrollTo(link.href)}
              className="block w-full text-left font-display text-lg tracking-widest uppercase text-muted-foreground hover:text-primary py-3 border-b border-border/70 transition-colors min-h-[48px]">
              
                  {link.label}
                </button>
            )}
              <button
              onClick={() => scrollTo('#quote')}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-4 font-display font-bold text-sm tracking-wider uppercase min-h-[48px]">
              
                <Phone className="w-4 h-4" />
                Free Estimate
              </button>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showMiniLogo && !isOpen &&
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.92 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 z-[70] hidden rounded-xl border border-border bg-white/94 px-3 py-2 shadow-[0_14px_36px_rgba(24,24,24,0.18)] backdrop-blur-lg md:bottom-6 md:right-6 md:block"
          aria-label="Back to top">

            <img
              src={PRIMARY_LOGO_URL}
              alt="J. Worden & Sons Paving LLC mini logo"
              width={560}
              height={120}
              sizes="160px"
              className="w-36 h-8 md:w-40 md:h-9 object-contain"
            />
          </motion.button>
        }
      </AnimatePresence>
    </nav>);

}
