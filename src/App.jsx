import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import FloatingCTA from './components/FloatingCTA'
import ChatWidget from './components/ChatWidget'
import ScrollToTop from './components/ScrollToTop'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy-loaded pages for code splitting
const Home = lazy(() => import('./pages/Home'))
const Services = lazy(() => import('./pages/Services'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const Quote = lazy(() => import('./pages/Quote'))
const Reviews = lazy(() => import('./pages/Reviews'))
const NotFound = lazy(() => import('./pages/NotFound'))
const CommandCenter = lazy(() => import('./pages/CommandCenter'))
const Projects = lazy(() => import('./pages/Projects'))
const Visualizer = lazy(() => import('./pages/Visualizer'))

// Service area pages
const ServiceAreas = lazy(() => import('./pages/ServiceAreas'))
const CityPage = lazy(() => import('./pages/CityPage'))
const StatePavingPage = lazy(() => import('./pages/StatePavingPage'))

// Blog / knowledge center
const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))

// Advisory pages — lazy-loaded so the 512KB legal dataset never hits the main bundle
const AdvisoryHub = lazy(() => import('./pages/advisory/AdvisoryHub'))
const StateDetail = lazy(() => import('./pages/advisory/StateDetail'))
const UtilitiesHub = lazy(() => import('./pages/advisory/UtilitiesHub'))
const StateCompare = lazy(() => import('./pages/advisory/StateCompare'))
const CategoryHub = lazy(() => import('./pages/advisory/CategoryHub'))
const LegalStrategyAdvisor = lazy(() => import('./pages/advisory/LegalStrategyAdvisor'))
const ContractorRanker = lazy(() => import('./pages/advisory/ContractorRanker'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-navy">
      <div className="w-10 h-10 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ErrorBoundary>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<Services />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/quote" element={<Quote />} />
                <Route path="/reviews" element={<Reviews />} />
                {/* Service areas */}
                <Route path="/service-areas" element={<ServiceAreas />} />
                <Route path="/service-areas/:citySlug" element={<CityPage />} />
                <Route path="/states/:stateSlug" element={<StatePavingPage />} />
                {/* Blog / Knowledge Center */}
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                {/* Command Center — operations dashboard */}
                <Route path="/command-center" element={<CommandCenter />} />
                {/* Projects / Portfolio */}
                <Route path="/projects" element={<Projects />} />
                {/* 3-D Property Visualizer */}
                <Route path="/visualizer" element={<Visualizer />} />
                {/* Advisory Board routes */}
                <Route path="/advisory" element={<AdvisoryHub />} />
                <Route path="/advisory/state/:stateCode" element={<StateDetail />} />
                <Route path="/advisory/utilities" element={<UtilitiesHub />} />
                <Route path="/advisory/compare" element={<StateCompare />} />
                <Route path="/advisory/legal-strategy" element={<LegalStrategyAdvisor />} />
                <Route path="/advisory/contractor-ranker" element={<ContractorRanker />} />
                {/* Generic category hub — handles licensing, construction-law, safety, etc. */}
                <Route path="/advisory/:category" element={<CategoryHub />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <FloatingCTA />
          <ChatWidget />
        </div>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
