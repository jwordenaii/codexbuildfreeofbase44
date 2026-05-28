import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Construction, HardHat, Award } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import LiveReviewBadges from '@/components/LiveReviewBadges'
import { trackPhoneClick } from '@/lib/analytics'

const PAVING_SERVICES = [
  {
    title: 'Precision Asphalt Paving',
    description: 'High-density asphalt mix designed for Virginia climate, specifically tailored for Richmond, Chesterfield, and Fredericksburg. Every job includes site grading, 6-inch stone base compaction, and dual-roller finishing.',
    icon: <Construction className="w-6 h-6 text-primary" />
  },
  {
    title: 'Reinforced Concrete Solutions',
    description: 'From 4000 PSI driveways to industrial loading docks. We handle stamped decorative concrete and heavy-duty structural pads.',
    icon: <ShieldCheck className="w-6 h-6 text-primary" />
  },
  {
    title: 'Hardscape Artistry',
    description: 'Premium cobblestone, brick pavers, and Belgian block. Elevate your curb appeal with hand-laid patterns that last a lifetime.',
    icon: <Award className="w-6 h-6 text-primary" />
  },
  {
    title: 'Millings & Recycled Pavement',
    description: 'Dust-free, cost-effective solutions for private lanes and ranch roads. We offer specialized "coated millings" for maximum binding.',
    icon: <HardHat className="w-6 h-6 text-primary" />
  }
]

export default function AsphaltPaving() {
  const canonicalPath = '/paving'
  const title = 'Virginia Paving Contractor | Asphalt, Concrete & Hardscapes | J. Worden & Sons'
  const description = 'The highest-rated paving contractor in Virginia. Specializing in asphalt paving, concrete driveways, cobblestone, and premium sealcoating. 40+ years of family-built excellence.'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PavingService',
    'name': 'J. Worden & Sons Paving LLC',
    'provider': {
      '@type': 'LocalBusiness',
      'name': 'J. Worden & Sons Paving LLC',
      'telephone': '+18044461296',
      'priceRange': '$$'
    },
    'areaServed': {
      '@type': 'State',
      'name': 'Virginia'
    }
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO title={title} description={description} canonicalPath={canonicalPath} jsonLd={jsonLd} />
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />
            <picture>
              <source type="image/webp" srcSet="/hero-paving.webp" />
              <img 
                src="/hero-paving.jpg" 
                className="w-full h-full object-cover opacity-60 scale-105"
                alt="Paving Excellence"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
        </div>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-20">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="font-display text-primary text-xs tracking-[0.4em] uppercase mb-6 drop-shadow-md">Virginia Statewide Division</p>
            <h1 className="font-display font-black text-white text-5xl md:text-8xl uppercase tracking-tighter leading-[0.85] max-w-5xl mb-8">
              Paving <span className="text-primary italic">Redefined.</span><br />
              All Roads Lead To Us.
            </h1>
            <p className="text-gray-300 text-lg md:text-2xl max-w-2xl leading-relaxed mb-10">
              From residential driveways to massive commercial developments. Asphalt, Concrete, and Hand-Laid Hardscapes built with 40 years of Virginia grit.
            </p>

            <div className="flex flex-wrap gap-4">
              <a 
                href="tel:+18044461296" 
                onClick={() => trackPhoneClick('paving_hero')}
                className="premium-cta px-10 py-5 font-display font-bold text-sm tracking-widest uppercase text-primary-foreground"
              >
                Start My Project
              </a>
              <Link to="/contact" className="border-2 border-primary/40 text-white px-10 py-5 font-display font-bold text-sm tracking-widest uppercase hover:bg-primary/20 transition-all">
                The Portfolio
              </Link>
              <Link to="/quote" className="border-2 border-white/35 bg-white/10 text-white px-10 py-5 font-display font-bold text-sm tracking-widest uppercase hover:bg-white/20 transition-all">
                Request Estimate
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust signals — verified review platforms */}
      <section className="border-b border-border bg-white py-10">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
            Verified Reviews On
          </p>
          <LiveReviewBadges />
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24 bg-card">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="font-display font-black text-4xl md:text-6xl uppercase tracking-tight mb-4">Mastering Every Surface</h2>
            <div className="w-24 h-1 bg-primary mx-auto mb-6" />
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              We specialize in the high-stakes work. The surfaces where durability and aesthetics meet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {PAVING_SERVICES.map((s, idx) => (
              <div key={idx} className="premium-panel p-8 rounded-2xl hover:border-primary transition-all group">
                <div className="mb-6 p-4 rounded-xl bg-primary/10 inline-block group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  {s.icon}
                </div>
                <h3 className="font-display font-black text-xl mb-4 uppercase tracking-wide">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Bar */}
      <section className="bg-primary py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <h2 className="font-display font-black text-2xl md:text-4xl text-primary-foreground uppercase tracking-tight">Ready for a Lifetime Result?</h2>
          <a 
            href="tel:+18044461296" 
            onClick={() => trackPhoneClick('paving_bottom')}
            className="bg-black text-white px-12 py-5 font-display font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all shadow-2xl"
          >
            804.446.1296
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
