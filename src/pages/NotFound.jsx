import { Link } from 'react-router-dom'
import SchemaMarkup from '../components/SchemaMarkup'

export default function NotFound() {
  return (
    <>
      <SchemaMarkup
        title="Page Not Found"
        description="The page you are looking for does not exist. Return to J. Worden & Sons Asphalt Paving."
        canonical="/404"
      />
      <div className="min-h-screen bg-brand-navy flex items-center justify-center px-4 pt-16">
        <div className="max-w-lg w-full text-center">
          <div className="font-display font-black text-brand-amber text-[8rem] leading-none select-none">
            404
          </div>
          <h1 className="font-display font-black text-white text-3xl mt-4 mb-3">Page Not Found</h1>
          <p className="text-white/60 mb-10 text-lg">
            Looks like this road doesn&apos;t exist — yet. Let us pave the way back.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="btn-primary text-base px-8 py-3">
              Back to Home
            </Link>
            <Link to="/contact" className="btn-outline text-base px-8 py-3">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
