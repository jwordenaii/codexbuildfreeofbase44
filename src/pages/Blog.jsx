import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SchemaMarkup, { LOCAL_BUSINESS_SCHEMA } from '../components/SchemaMarkup'
import BLOG_POSTS, { BLOG_CATEGORIES } from '../data/blogPosts'
import { SITE_URL } from '../lib/schemas'
import { trackEvent } from '../api/client'

function blogListSchema(posts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'J. Worden & Sons Asphalt Paving — Paving Tips & Resources',
    description:
      'Expert asphalt paving tips, maintenance guides, and commercial paving insights from a 40-year veteran contractor.',
    url: `${SITE_URL}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'J. Worden & Sons Asphalt Paving',
      url: SITE_URL,
    },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.excerpt,
      datePublished: p.date,
      url: `${SITE_URL}/blog/${p.slug}`,
      author: {
        '@type': 'Organization',
        name: 'J. Worden & Sons Asphalt Paving',
      },
    })),
  }
}

const CATEGORY_ICONS = {
  all: '📋',
  tips: '💡',
  'how-to': '🔧',
  industry: '📰',
  local: '📍',
  commercial: '🏢',
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.05 } }),
}

function BlogCard({ post, index, featured = false }) {
  return (
    <motion.article
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      custom={index}
      variants={fadeUp}
      className={`card group overflow-hidden ${featured ? 'lg:col-span-2' : ''}`}
    >
      {/* Category + date bar */}
      <div className="bg-brand-navy/5 px-6 pt-5 pb-3 flex items-center justify-between gap-4">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-amber">
          {CATEGORY_ICONS[post.category]} {BLOG_CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}
        </span>
        <span className="text-brand-navy/40 text-xs">
          {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      <div className={`p-6 ${featured ? 'lg:flex lg:gap-8 lg:items-start' : ''}`}>
        <div className={featured ? 'lg:flex-1' : ''}>
          {featured && (
            <span className="inline-block bg-brand-amber text-brand-navy text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Featured
            </span>
          )}
          <h2
            className={`font-display font-black text-brand-navy group-hover:text-brand-amber transition-colors leading-tight mb-3 ${
              featured ? 'text-2xl lg:text-3xl' : 'text-xl'
            }`}
          >
            <Link
              to={`/blog/${post.slug}`}
              onClick={() => trackEvent('blog_post_click', { slug: post.slug })}
            >
              {post.title}
            </Link>
          </h2>
          <p className="text-brand-navy/60 text-sm leading-relaxed mb-4">{post.excerpt}</p>
          <div className="flex items-center justify-between">
            <span className="text-brand-navy/40 text-xs">⏱ {post.readTime} read</span>
            <Link
              to={`/blog/${post.slug}`}
              className="text-brand-amber font-semibold text-sm hover:underline flex items-center gap-1"
              onClick={() => trackEvent('blog_read_more', { slug: post.slug })}
            >
              Read article →
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

export default function Blog() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPosts = useMemo(() => {
    let posts = BLOG_POSTS
    if (activeCategory !== 'all') {
      posts = posts.filter((p) => p.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
    }
    return posts
  }, [activeCategory, searchQuery])

  const featuredPost = BLOG_POSTS.find((p) => p.featured)
  const remainingPosts = filteredPosts.filter((p) => !p.featured || activeCategory !== 'all' || searchQuery)

  return (
    <>
      <SchemaMarkup
        title="Paving Tips, Guides & Resources"
        description="Expert asphalt paving tips, maintenance guides, commercial paving insights, and local Virginia resources from J. Worden & Sons — a 40-year paving contractor."
        canonical="/blog"
        schema={[LOCAL_BUSINESS_SCHEMA, blogListSchema(BLOG_POSTS)]}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
        ]}
      />

      {/* ── Hero ── */}
      <section className="bg-brand-navy text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
            Knowledge Center
          </span>
          <h1 className="font-display font-black text-4xl md:text-6xl mt-3 mb-4">
            Paving Tips &amp; Resources
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto">
            40 years of asphalt expertise — maintenance guides, how-to articles,
            commercial paving standards, and local Virginia insights.
          </p>
        </div>
      </section>

      {/* ── Filters + Search ── */}
      <section className="bg-white border-b border-gray-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            {BLOG_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.value)
                  trackEvent('blog_category_filter', { category: cat.value })
                }}
                className={`text-xs font-bold px-4 py-2 rounded-full transition-all ${
                  activeCategory === cat.value
                    ? 'bg-brand-amber text-brand-navy'
                    : 'bg-gray-100 text-brand-navy/60 hover:bg-brand-amber/20'
                }`}
              >
                {CATEGORY_ICONS[cat.value]} {cat.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles…"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-navy/30"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Posts grid ── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Featured post (only on unfiltered view) */}
          {featuredPost && activeCategory === 'all' && !searchQuery && (
            <div className="mb-12">
              <BlogCard post={featuredPost} index={0} featured />
            </div>
          )}

          {/* Post grid */}
          {filteredPosts.length === 0 ? (
            <div className="text-center py-20 text-brand-navy/40">
              <div className="text-5xl mb-4">📭</div>
              <div className="font-display font-bold text-xl mb-2">No articles found</div>
              <button
                type="button"
                onClick={() => { setActiveCategory('all'); setSearchQuery('') }}
                className="text-brand-amber font-semibold hover:underline text-sm"
              >
                Clear filters →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {remainingPosts.map((post, i) => (
                <BlogCard key={post.slug} post={post} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Newsletter / Contact CTA ── */}
      <section className="py-16 bg-brand-navy text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">Get Expert Help</span>
          <h2 className="font-display font-black text-3xl mt-2 mb-3">
            Have a Specific Project Question?
          </h2>
          <p className="text-white/60 mb-8">
            Our team has 40 years of answers. Ask us directly — free estimates and
            free advice, no sales pressure.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/quote" className="btn-primary">
              Get a Free Quote
            </Link>
            <Link to="/contact" className="btn-outline">
              Ask a Question
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
