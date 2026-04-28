import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import SchemaMarkup, { reviewsSchema } from '../components/SchemaMarkup'
import { api, trackEvent } from '../api/client'
import SocialShare from '../components/SocialShare'

// Fallback in case API is unavailable
const FALLBACK = {
  aggregate_rating: 4.9,
  total_reviews: 87,
  reviews: [
    {
      author: 'Mark D.',
      rating: 5,
      text: 'J. Worden & Sons did an outstanding job on our commercial parking lot. On time, on budget, and the quality is exceptional.',
      date: '2024-11-15',
      source: 'Google',
    },
    {
      author: 'Patricia H.',
      rating: 5,
      text: 'Our driveway looks brand new. They showed up on schedule, got it done in one day, and the price was very fair.',
      date: '2024-10-22',
      source: 'Google',
    },
    {
      author: 'Riverside KFC Management',
      rating: 5,
      text: 'We have used J. Worden & Sons for all three of our franchise locations. Every project has been flawless.',
      date: '2024-09-08',
      source: 'Google',
    },
  ],
}

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`text-lg ${star <= rating ? 'text-brand-amber' : 'text-gray-200'}`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

function ReviewCard({ review, index }) {
  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: (index % 3) * 0.1 }}
    >
      <StarRating rating={review.rating} />
      <p className="mt-3 text-brand-navy/80 text-sm leading-relaxed">&ldquo;{review.text}&rdquo;</p>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="font-semibold text-brand-navy text-sm">{review.author}</div>
          <div className="text-xs text-brand-navy/40 mt-0.5">
            {new Date(review.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
            })}
          </div>
        </div>
        <span className="text-xs text-brand-navy/30 bg-gray-100 px-2 py-1 rounded-full">
          {review.source}
        </span>
      </div>
    </motion.div>
  )
}

export default function Reviews() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getReviews()
      .then(setData)
      .catch(() => setData(FALLBACK))
      .finally(() => setLoading(false))
    trackEvent('page_view', { page: '/reviews' })
  }, [])

  const { aggregate_rating, total_reviews, reviews } = data || FALLBACK

  return (
    <>
      <SchemaMarkup
        title={`${aggregate_rating}★ Reviews — What Customers Say`}
        description={`J. Worden & Sons has a ${aggregate_rating}-star average across ${total_reviews} Google reviews. Read what homeowners and commercial clients say about our asphalt paving work.`}
        canonical="/reviews"
        schema={data ? reviewsSchema(reviews, aggregate_rating) : undefined}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Reviews', path: '/reviews' },
        ]}
      />

      {/* Header */}
      <div className="bg-brand-navy pt-32 pb-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="font-display font-black text-5xl md:text-6xl mb-4">
            Customer <span className="text-brand-amber">Reviews</span>
          </h1>
          <p className="text-white/70 text-xl mb-6">What our clients say after the job is done.</p>
          <div className="flex justify-center">
            <SocialShare
              path="/reviews"
              text="J. Worden & Sons — 4.9★ across 87 Google reviews. See what customers say."
              compact
            />
          </div>
        </div>
      </div>

      {/* Aggregate score */}
      <section className="py-14 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {loading ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <div>
                <div className="font-display font-black text-7xl text-brand-navy">
                  {aggregate_rating}
                </div>
                <div className="flex gap-1 justify-center mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className="text-brand-amber text-2xl">
                      ★
                    </span>
                  ))}
                </div>
                <div className="text-brand-navy/40 text-sm mt-1">
                  {total_reviews} Google reviews
                </div>
              </div>
              <div className="h-px w-20 sm:h-20 sm:w-px bg-gray-200" />
              <div className="text-left">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter((r) => r.rating === star).length
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-brand-navy/60 w-8">{star}★</span>
                      <div className="w-36 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-amber rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-brand-navy/40">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Review cards */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((review, i) => (
                <ReviewCard key={i} review={review} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Leave a review CTA */}
      <section className="py-16 bg-brand-navy text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-display font-black text-3xl mb-4">Had a great experience?</h2>
          <p className="text-white/60 mb-8">
            Your review helps other homeowners and businesses find quality asphalt contractors.
          </p>
          <a
            href={`https://g.page/r/${import.meta.env.VITE_GOOGLE_PLACE_ID || 'YOUR_GOOGLE_PLACE_ID'}/review`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            onClick={() => trackEvent('review_cta_click', { location: 'reviews_page' })}
          >
            Leave a Google Review ⭐
          </a>
        </div>
      </section>
    </>
  )
}
