import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SchemaMarkup from '../components/SchemaMarkup'
import SocialShare from '../components/SocialShare'
import BLOG_POSTS, { BLOG_CATEGORIES } from '../data/blogPosts'
import { SITE_URL } from '../lib/schemas'
import { trackEvent } from '../api/client'
import NotFound from './NotFound'

function articleSchema(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    url: `${SITE_URL}/blog/${post.slug}`,
    author: {
      '@type': 'Organization',
      name: 'J. Worden & Sons Asphalt Paving',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'J. Worden & Sons Asphalt Paving',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
  }
}

/**
 * Very lightweight Markdown-to-JSX renderer.
 * Handles: h2, h3, bold, code, horizontal rule, table, paragraph.
 * No external deps needed — keeps the bundle lean.
 */
function MarkdownContent({ markdown }) {
  const lines = markdown.trim().split('\n')
  const elements = []
  let tableBuffer = null
  let i = 0

  const flushTable = () => {
    if (!tableBuffer) return
    const [header, , ...rows] = tableBuffer
    const headers = header.split('|').map((h) => h.trim()).filter(Boolean)
    elements.push(
      <div key={`table-${i}`} className="overflow-x-auto my-6 rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-navy text-white">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => r.trim()).map((row, ri) => {
              const cells = row.split('|').map((c) => c.trim()).filter(Boolean)
              return (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {cells.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 border-t border-gray-100">{cell}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
    tableBuffer = null
  }

  while (i < lines.length) {
    const line = lines[i]

    // Table detection
    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      tableBuffer = [line]
      i++
      while (i < lines.length && lines[i].includes('|')) {
        tableBuffer.push(lines[i])
        i++
      }
      flushTable()
      continue
    }

    flushTable()

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="font-display font-black text-brand-navy text-2xl mt-10 mb-4 pb-2 border-b-2 border-brand-amber/30">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="font-display font-bold text-brand-navy text-lg mt-7 mb-3">
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="my-8 border-gray-200" />)
    } else if (line.startsWith('- ')) {
      const listItems = []
      let j = i
      while (j < lines.length && lines[j].startsWith('- ')) {
        listItems.push(lines[j].slice(2))
        j++
      }
      elements.push(
        <ul key={i} className="my-4 space-y-2">
          {listItems.map((item, k) => (
            <li key={k} className="flex items-start gap-3 text-brand-navy/75">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-amber flex-shrink-0" />
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      )
      i = j
      continue
    } else if (line.startsWith('- ☑')) {
      const checklist = []
      let j = i
      while (j < lines.length && lines[j].startsWith('- ☑')) {
        checklist.push(lines[j].slice(4))
        j++
      }
      elements.push(
        <ul key={i} className="my-4 space-y-2">
          {checklist.map((item, k) => (
            <li key={k} className="flex items-center gap-3 text-brand-navy/75">
              <span className="text-green-500 font-bold">☑</span>
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      )
      i = j
      continue
    } else if (line.trim() === '') {
      // skip blank
    } else {
      elements.push(
        <p key={i} className="text-brand-navy/75 leading-relaxed mb-4">
          <InlineText text={line} />
        </p>
      )
    }
    i++
  }

  flushTable()
  return <div className="prose-jworden">{elements}</div>
}

/**
 * InlineText — safely renders inline Markdown (bold, code, links) as React nodes.
 * No dangerouslySetInnerHTML — all content is constructed as React elements.
 */
function InlineText({ text }) {
  const parts = []
  let remaining = text
  let key = 0

  const TOKENS = [
    { re: /\*\*(.+?)\*\*/,      render: (m, k) => <strong key={k} className="font-bold text-brand-navy">{m[1]}</strong> },
    { re: /`(.+?)`/,             render: (m, k) => <code key={k} className="bg-gray-100 text-brand-navy px-1.5 py-0.5 rounded text-sm font-mono">{m[1]}</code> },
    { re: /\[(.+?)\]\((.+?)\)/, render: (m, k) => <a key={k} href={m[2]} className="text-brand-amber font-semibold hover:underline">{m[1]}</a> },
  ]

  while (remaining.length > 0) {
    let earliest = null
    let earliestToken = null
    let earliestMatch = null

    for (const token of TOKENS) {
      const match = remaining.match(token.re)
      if (match !== null && (earliest === null || match.index < earliest)) {
        earliest = match.index
        earliestToken = token
        earliestMatch = match
      }
    }

    if (earliest === null) {
      parts.push(remaining)
      break
    }
    if (earliest > 0) parts.push(remaining.slice(0, earliest))
    parts.push(earliestToken.render(earliestMatch, key++))
    remaining = remaining.slice(earliest + earliestMatch[0].length)
  }

  return <>{parts.map((p, i) => typeof p === 'string' ? <span key={i}>{p}</span> : p)}</>
}

const CATEGORY_ICONS = {
  tips: '💡',
  'how-to': '🔧',
  industry: '📰',
  local: '📍',
  commercial: '🏢',
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find((p) => p.slug === slug)

  if (!post) return <NotFound />

  const relatedPosts = BLOG_POSTS
    .filter((p) => p.slug !== slug && (p.category === post.category || p.featured))
    .slice(0, 3)

  return (
    <>
      <SchemaMarkup
        title={post.title}
        description={post.excerpt}
        canonical={`/blog/${post.slug}`}
        schema={[articleSchema(post)]}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
      />

      {/* ── Hero ── */}
      <section className="bg-brand-navy text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <nav className="text-white/40 text-sm mb-8 flex items-center gap-2">
            <Link to="/" className="hover:text-brand-amber transition-colors">Home</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-brand-amber transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-white/60 truncate max-w-[200px]">{post.title}</span>
          </nav>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-brand-amber/20 text-brand-amber text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                {CATEGORY_ICONS[post.category]} {BLOG_CATEGORIES.find((c) => c.value === post.category)?.label}
              </span>
              <span className="text-white/40 text-sm">
                {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-white/40 text-sm">·</span>
              <span className="text-white/40 text-sm">⏱ {post.readTime} read</span>
            </div>

            <h1 className="font-display font-black text-3xl md:text-5xl leading-tight mb-6">
              {post.title}
            </h1>
            <p className="text-white/70 text-xl max-w-2xl leading-relaxed">{post.excerpt}</p>
          </motion.div>
        </div>
      </section>

      {/* ── Author bar ── */}
      <div className="border-b border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-amber flex items-center justify-center font-display font-black text-brand-navy text-sm">
              JW
            </div>
            <div>
              <div className="font-semibold text-brand-navy text-sm">J. Worden &amp; Sons</div>
              <div className="text-brand-navy/40 text-xs">4th-Generation Asphalt Contractor · Est. 1984</div>
            </div>
          </div>
          <SocialShare
            url={`${SITE_URL}/blog/${post.slug}`}
            title={post.title}
            className="text-sm"
          />
        </div>
      </div>

      {/* ── Article body ── */}
      <article className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <MarkdownContent markdown={post.body} />

          {/* End-of-article CTA */}
          <div className="mt-12 rounded-2xl bg-brand-amber/10 border border-brand-amber/30 p-8">
            <h3 className="font-display font-black text-brand-navy text-2xl mb-3">
              Ready for a Free Estimate?
            </h3>
            <p className="text-brand-navy/60 mb-6">
              J. Worden &amp; Sons has been solving paving problems like this for
              four generations. Free on-site estimates, fast response.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/quote"
                className="btn-primary"
                onClick={() => trackEvent('blog_cta_click', { slug: post.slug, cta: 'quote' })}
              >
                Get a Free Quote
              </Link>
              <a
                href="tel:+18044461296"
                className="btn-outline"
                onClick={() => trackEvent('blog_cta_click', { slug: post.slug, cta: 'phone' })}
              >
                📞 (804) 446-1296
              </a>
            </div>
          </div>
        </div>
      </article>

      {/* ── Related posts ── */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="section-heading mb-10">More Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((related, i) => (
                <motion.div
                  key={related.slug}
                  className="card p-6 group"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.07 }}
                >
                  <span className="text-brand-amber text-xs font-bold uppercase tracking-widest block mb-2">
                    {CATEGORY_ICONS[related.category]} {BLOG_CATEGORIES.find((c) => c.value === related.category)?.label}
                  </span>
                  <h3 className="font-display font-bold text-brand-navy text-lg mb-3 group-hover:text-brand-amber transition-colors leading-snug">
                    <Link to={`/blog/${related.slug}`}>{related.title}</Link>
                  </h3>
                  <p className="text-brand-navy/60 text-sm mb-4 line-clamp-2">{related.excerpt}</p>
                  <Link
                    to={`/blog/${related.slug}`}
                    className="text-brand-amber font-semibold text-sm hover:underline"
                  >
                    Read article →
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
