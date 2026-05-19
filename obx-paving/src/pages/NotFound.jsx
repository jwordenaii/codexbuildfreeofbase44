import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SEO from '@/components/SEO.jsx'

export default function NotFound() {
  return (
    <>
      <SEO title="Page Not Found | OBX Paving Co." description="" noindex />
      <section className="min-h-screen flex items-center justify-center bg-off-white pt-20">
        <div className="text-center max-w-md mx-auto px-6">
          <p className="font-display text-9xl text-ocean/20 mb-4">404</p>
          <h1 className="font-display text-3xl uppercase text-navy tracking-tight mb-4">
            Page Not Found
          </h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            The page you're looking for doesn't exist or was moved.
          </p>
          <Link to="/" className="btn-primary px-8 py-3.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </section>
    </>
  )
}
