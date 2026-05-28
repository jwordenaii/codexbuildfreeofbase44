import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Zap, Construction, Trash2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import SmartImage from '@/components/SmartImage'
import { trackPhoneClick } from '@/lib/analytics'
import { legacyPortfolioImages } from '@/data/legacyPortfolio'

const SHINGLE_SERVICES = [
  {
    title: 'Planetary Shingle Logistics',
    description: 'Direct procurement of Owens Corning and GAF shingles. We represent zero middleman markup on material costs.',
    icon: <ShieldCheck className="w-5 h-5 text-brand-amber" />
  },
  {
    title: 'Commercial Tear-Offs',
    description: 'Rapid, high-volume removal and disposal services for shopping centers and multi-family residential complexes.',
    icon: <Zap className="w-5 h-5 text-brand-amber" />
  },
  {
    title: 'Industrial Roofing Guard',
    description: 'Advanced underlayment systems and ice/water shields installed to Virginia building code exceeding standards.',
    icon: <Construction className="w-5 h-5 text-brand-amber" />
  },
  {
    title: 'Recycling & Fines',
    description: 'Post-project shingle recycling. We convert waste shingles into asphalt millings for eco-friendly driveway base layers.',
    icon: <Trash2 className="w-5 h-5 text-brand-amber" />
  }
]

export default function VirginiaShingles() {
  const roofImages = legacyPortfolioImages.filter(img => img.category === 'Residential').slice(0, 3);

  return (
    <div className="min-h-screen bg-brand-navy">
      <SEO 
        title="Roofing & Shingle Services in Virginia | Commercial Re-roofing"
        description="J. Worden & Sons Roofing Division. Professional shingle installation, tear-offs, and universal supply chain logistics in Virginia."
        canonical="/virginia-shingles"
      />
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 items-center">
          <div className="lg:w-1/2 space-y-6">
            <span className="inline-block bg-brand-amber/10 text-brand-amber text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Paving & Roofing Integrated Logic
            </span>
            <h1 className="font-display font-black text-5xl md:text-7xl text-white leading-tight">
              Roofing <span className="text-brand-amber">Integrated</span>.
            </h1>
            <p className="text-white/70 text-lg md:text-xl max-w-xl">
              We leverage our planetary supply chain to provide roofing contractors and property managers with unbeatable material rates and professional-grade installation crews across the Commonwealth.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/quote" className="btn-primary py-4 px-8">Get Roofing Quote</Link>
              <button onClick={() => trackPhoneClick('shingle-page')} className="btn-outline py-4 px-8 text-white">Contact Deck Specialist</button>
            </div>
          </div>
          <div className="lg:w-1/2">
             <SmartImage 
               src={roofImages[0]?.url || 'https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&q=80'} 
               className="rounded-3xl w-full h-[500px] object-cover border border-white/10 shadow-2xl" 
               alt="Roofing Project" 
               loading="eager"
             />
          </div>
        </div>
      </section>

      {/* Logic Grid */}
      <section className="py-24 bg-white/5 border-y border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-white font-black text-3xl md:text-5xl tracking-tight mb-4">Total Property Enclosure.</h2>
            <p className="text-white/40 max-w-2xl mx-auto">From the shingles on your roof to the asphalt on your driveway, our team can help organize the right maintenance plan.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {SHINGLE_SERVICES.map((service, idx) => (
              <div key={idx} className="bg-brand-navy p-8 rounded-3xl border border-white/10 hover:border-brand-amber/40 transition-all">
                <div className="bg-brand-amber/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  {service.icon}
                </div>
                <h3 className="text-white font-black text-xl mb-3 tracking-tight">{service.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
