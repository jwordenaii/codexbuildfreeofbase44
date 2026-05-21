import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from '@/components/layout/Navbar.jsx'
import Footer from '@/components/layout/Footer.jsx'

// Top-level pages
const Home         = lazy(() => import('@/pages/Home.jsx'))
const Services     = lazy(() => import('@/pages/Services.jsx'))
const ServiceAreas = lazy(() => import('@/pages/ServiceAreas.jsx'))
const About        = lazy(() => import('@/pages/About.jsx'))
const Contact      = lazy(() => import('@/pages/Contact.jsx'))
const NotFound     = lazy(() => import('@/pages/NotFound.jsx'))

// Individual service pages
const Sealcoating    = lazy(() => import('@/pages/services/Sealcoating.jsx'))
const CrackFilling   = lazy(() => import('@/pages/services/CrackFilling.jsx'))
const AsphaltRepairs = lazy(() => import('@/pages/services/AsphaltRepairs.jsx'))
const LineStriping   = lazy(() => import('@/pages/services/LineStriping.jsx'))
const AsphaltPaving  = lazy(() => import('@/pages/services/AsphaltPaving.jsx'))
const ParkingLots    = lazy(() => import('@/pages/services/ParkingLots.jsx'))
const Resurfacing    = lazy(() => import('@/pages/services/Resurfacing.jsx'))
const Maintenance    = lazy(() => import('@/pages/services/Maintenance.jsx'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white">
      <div className="w-8 h-8 border-2 border-ocean border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <main>
          <Routes>
            {/* Core pages */}
            <Route path="/"              element={<Home />} />
            <Route path="/services"      element={<Services />} />
            <Route path="/service-areas" element={<ServiceAreas />} />
            <Route path="/about"         element={<About />} />
            <Route path="/contact"       element={<Contact />} />

            {/* Individual service pages */}
            <Route path="/services/asphalt-paving"  element={<AsphaltPaving />} />
            <Route path="/services/sealcoating"     element={<Sealcoating />} />
            <Route path="/services/crack-filling"   element={<CrackFilling />} />
            <Route path="/services/asphalt-repairs"  element={<AsphaltRepairs />} />
            <Route path="/services/line-striping"   element={<LineStriping />} />
            <Route path="/services/parking-lots"    element={<ParkingLots />} />
            <Route path="/services/resurfacing"     element={<Resurfacing />} />
            <Route path="/services/maintenance"     element={<Maintenance />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </Suspense>
      <Footer />
    </>
  )
}
