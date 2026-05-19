import SEO from '@/components/SEO.jsx'
import HeroSection from '@/components/sections/HeroSection.jsx'
import ServicesGrid from '@/components/sections/ServicesGrid.jsx'
import WhyChooseUs from '@/components/sections/WhyChooseUs.jsx'
import ProcessSection from '@/components/sections/ProcessSection.jsx'
import ServiceAreasSection from '@/components/sections/ServiceAreasSection.jsx'
import TestimonialsSection from '@/components/sections/TestimonialsSection.jsx'
import CTABanner from '@/components/sections/CTABanner.jsx'
import {
  getWebPageSchema,
  getWebSiteSchema,
  getFAQSchema,
} from '@/lib/schema.js'

const HOME_FAQS = [
  {
    q: 'What areas do you serve?',
    a: 'We serve all of the Outer Banks including Kill Devil Hills, Nags Head, Kitty Hawk, Duck, Southern Shores, Corolla, Manteo, Avon, Buxton, and Hatteras. We also cover Currituck County growing areas like Moyock, Barco, and Grandy, and northeastern NC mainland communities.',
  },
  {
    q: 'Why does coastal paving require special expertise?',
    a: 'Salt air, ocean humidity, and intense coastal UV degrade standard asphalt mixes much faster than inland applications. We use premium polymer-modified binders, salt-inhibiting sealcoating formulas, and installation methods calibrated for coastal North Carolina conditions.',
  },
  {
    q: 'Do you work with vacation rental property owners and HOAs?',
    a: 'Yes — vacation rental managers and HOA boards are among our most frequent clients. We schedule around rental calendars, work in phases to minimize disruption, and offer multi-property maintenance programs with discounts.',
  },
  {
    q: 'How do I get a quote?',
    a: 'Fill out our online quote form or call us directly. We schedule a site visit within 2–3 business days and deliver a written, line-item proposal within 24 hours of the visit.',
  },
]

export default function Home() {
  return (
    <>
      <SEO
        title="OBX Paving Co. | Asphalt Paving & Sealcoating — Outer Banks, NC"
        description="Premium asphalt paving and sealcoating for the Outer Banks of NC. Serving Kill Devil Hills, Nags Head, Kitty Hawk, Duck, Corolla, Manteo, and all of Dare & Currituck Counties. Licensed & insured. Free quotes."
        canonicalPath="/"
        schemas={[
          getWebPageSchema({
            name: 'OBX Paving Co. | Asphalt Paving & Sealcoating — Outer Banks, NC',
            description: 'Premium asphalt paving and sealcoating for the Outer Banks of North Carolina.',
            path: '/',
          }),
          getWebSiteSchema(),
          getFAQSchema(HOME_FAQS),
        ]}
      />
      <HeroSection />
      <ServicesGrid preview />
      <WhyChooseUs />
      <ProcessSection />
      <ServiceAreasSection />
      <TestimonialsSection />
      <CTABanner />
    </>
  )
}
