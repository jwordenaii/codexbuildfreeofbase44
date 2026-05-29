import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import { premiumBlogPostingSchema } from '@/components/SchemaMarkup'
import { Calendar, Clock, ArrowRight, ArrowLeft } from 'lucide-react'

export default function OutrankTraditionalWebDevelopmentCompaniesBlog() {
  const jsonLd = premiumBlogPostingSchema({
    slug: 'info/outrank-traditional-web-development-companies',
    headline: 'How to Compare Asphalt Paving Bids in Virginia',
    description:
      'A side-by-side framework to evaluate scope quality, not just price, when selecting an asphalt contractor in Virginia.',
    imageUrl: '/hero-paving.jpg',
    datePublished: '2026-05-29T08:00:00-04:00',
    dateModified: '2026-05-29T08:00:00-04:00',
  })

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO
        title={'How to Compare Asphalt Paving Bids in Virginia'}
        description={'A side-by-side framework to evaluate scope quality, not just price, when selecting an asphalt contractor in Virginia.'}
        canonicalPath={'/blog/info/outrank-traditional-web-development-companies'}
        jsonLd={jsonLd}
      />
      <Navbar />

      <article className="pt-32 pb-16 md:pb-20 max-w-4xl mx-auto px-6 lg:px-8">
        <header className="mb-12 border-b border-border pb-10">
          <Link to="/blog" className="inline-flex items-center text-sm font-display uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Articles
          </Link>
          <div className="flex items-center gap-4 text-xs font-display tracking-widest text-muted-foreground uppercase mb-6">
            <span className="text-primary font-bold">Insights</span>
            <span>•</span>
            <div className="flex items-center"><Calendar className="w-3 h-3 mr-1.5" /> Field Guide</div>
            <span>•</span>
            <div className="flex items-center"><Clock className="w-3 h-3 mr-1.5" /> 4 min read</div>
          </div>
          <h1 className="font-display font-black text-foreground text-4xl md:text-5xl uppercase tracking-tight leading-[0.95] mb-6">
            How to Compare Asphalt Paving Bids in Virginia
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
            A side-by-side framework to evaluate scope quality, not just price, when selecting an asphalt contractor in Virginia.
          </p>
        </header>

        <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed space-y-6">
          <p>
            The lowest bid can become the most expensive project when prep and drainage details are missing. Compare proposals line by line for milling depth,
            base repair allowances, compaction standards, and striping scope.
          </p>
          
          <h2 className="font-display text-2xl text-foreground uppercase tracking-wide mt-10 mb-4 font-black">
            Bid details that prevent expensive rework
          </h2>
          <p>
            Require each bidder to define traffic control, phasing, and cure-time guidance in writing. This avoids shutdown surprises for tenants, customers, and delivery operations.
          </p>

          <h3 className="font-display text-xl text-foreground uppercase mt-8 mb-3 font-bold">
            Key Diagnostic Approaches
          </h3>
          <p>
            Ask for references with similar lot sizes and traffic patterns. Proven experience in comparable conditions is one of the strongest predictors of long-term pavement performance.
          </p>

          <div className="bg-card border border-border p-8 my-10 rounded-sm">
            <h4 className="font-display text-lg text-primary uppercase font-bold mb-2">Ready to Upgrade Your Infrastructure?</h4>
            <p className="mb-6 text-sm">Join top-tier facility managers who have already maximized their property uptime and lowered maintenance intervals.</p>
            <Link to="/quote" className="premium-cta inline-flex items-center gap-2 px-6 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase text-primary-foreground">
              Request A Site Evaluation <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </article>

      <Footer />
    </div>
  )
}

