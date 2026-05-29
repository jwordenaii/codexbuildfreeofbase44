import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Loader2, Calendar, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '@/api/client';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { PRIMARY_DOMAIN } from '@/lib/locations';
import { FALLBACK_BLOG_POSTS, getFallbackBlogPostBySlug } from '@/lib/fallbackBlogPosts';
import { premiumBlogPostingSchema } from '../components/SchemaMarkup';

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.entities.BlogPost.filter({ slug })
      .then((results) => {
        const safeResults = Array.isArray(results) ? results : [];
        const found = safeResults[0] || getFallbackBlogPostBySlug(slug);
        setPost(found || null);
        if (found) {
          api.entities.BlogPost.list('-published_date', 4)
            .then((all) => {
              const safeAll = Array.isArray(all) ? all : [];
              const merged = safeAll.length > 0 ? safeAll : FALLBACK_BLOG_POSTS;
              setRelated(merged.filter((p) => p.slug !== found.slug).slice(0, 3));
            })
            .catch(() => {
              setRelated(FALLBACK_BLOG_POSTS.filter((p) => p.slug !== found.slug).slice(0, 3));
            });
        }
        setLoading(false);
      })
      .catch(() => {
        const fallback = getFallbackBlogPostBySlug(slug);
        setPost(fallback);
        setRelated(FALLBACK_BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, 3));
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background font-body">
        <Navbar />
        <div className="pt-32 pb-20 max-w-3xl mx-auto px-6 text-center">
          <h1 className="font-display font-black text-foreground text-4xl uppercase">Article Not Found</h1>
          <Link to="/blog" className="inline-flex items-center gap-2 mt-6 text-primary font-display tracking-wider uppercase text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const postUrl = `${PRIMARY_DOMAIN}/blog/${post.slug}`;
  const postBodyText = (post.content || '').replace(/[#>*_`\-\[\]\(\)]/g, ' ').replace(/\s+/g, ' ').trim();

  const premiumBlogSchema = premiumBlogPostingSchema({
    slug: post.slug,
    headline: post.title,
    description: post.excerpt,
    imageUrl: post.cover_image || '/og-default.jpg',
    datePublished: post.published_date,
    dateModified: post.updated_date || post.published_date,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        ...(premiumBlogSchema || {}),
        '@id': `${postUrl}#article`,
        articleSection: post.category?.replace('-', ' ') || 'Asphalt Paving',
        articleBody: postBodyText,
        inLanguage: 'en-US',
        keywords: post.tags?.join(', '),
        isPartOf: { '@id': `${PRIMARY_DOMAIN}/blog#blog` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: PRIMARY_DOMAIN },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${PRIMARY_DOMAIN}/blog` },
          { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO
        title={`${post.title} | J. Worden & Sons Paving LLC`}
        description={post.excerpt}
        canonicalPath={`/blog/${post.slug}`}
        ogImage={post.cover_image}
        ogType="article"
        jsonLd={jsonLd}
        publishedTime={post.published_date}
        modifiedTime={post.updated_date || post.published_date}
      />
      <Navbar />

      {/* Hero */}
      <article>
        <header className="pt-32 pb-10 border-b border-border">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            <Link to="/blog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary font-display tracking-wider uppercase text-xs mb-6 transition-colors">
              <ArrowLeft className="w-3 h-3" /> All Articles
            </Link>
            {post.category && (
              <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-4">
                // {post.category.replace('-', ' ')}
              </p>
            )}
            <h1 className="font-display font-black text-foreground text-4xl md:text-6xl uppercase tracking-tight leading-[0.95]">
              {post.title}
            </h1>
            <p className="font-body text-muted-foreground text-lg md:text-xl mt-6 leading-relaxed">
              {post.excerpt}
            </p>
            <div className="flex flex-wrap gap-5 mt-8 pt-6 border-t border-border">
              {post.published_date && (
                <span className="flex items-center gap-2 text-muted-foreground font-display text-xs tracking-wider uppercase">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {new Date(post.published_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {post.read_time_minutes && (
                <span className="flex items-center gap-2 text-muted-foreground font-display text-xs tracking-wider uppercase">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {post.read_time_minutes} min read
                </span>
              )}
              <span className="font-display text-xs tracking-wider uppercase text-muted-foreground">
                By {post.author || 'J. Worden & Sons'}
              </span>
            </div>
          </div>
        </header>

        {post.cover_image && (
          <div className="max-w-5xl mx-auto px-6 lg:px-8 -mt-px">
            <div className="aspect-[21/9] overflow-hidden bg-muted border-b border-border">
              <img
                src={post.cover_image}
                alt={`${post.title} — expert guide by J. Worden & Sons Paving LLC`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            <div className="prose prose-invert prose-lg max-w-none
              prose-headings:font-display prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-headings:text-foreground
              prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-t prose-h2:border-border prose-h2:pt-10
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:font-body prose-p:text-foreground/85 prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-bold
              prose-ul:font-body prose-li:text-foreground/85
              prose-blockquote:border-l-primary prose-blockquote:text-foreground prose-blockquote:not-italic prose-blockquote:font-display prose-blockquote:font-bold
              prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>

            {post.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-border">
                {post.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 border border-border text-muted-foreground font-display text-[10px] tracking-[0.15em] uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>

      {/* CTA */}
      <section className="border-t border-border bg-primary py-12">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h3 className="font-display font-black text-primary-foreground text-2xl md:text-3xl uppercase tracking-tight">
            Need a paving estimate?
          </h3>
          <p className="font-body text-primary-foreground/80 mt-2 mb-6">
            40+ years across Central Virginia and the Southeast. Free site visits.
          </p>
          <Link
            to="/#quote"
            className="inline-flex items-center gap-2 bg-background text-foreground px-6 py-3 font-display font-bold text-xs tracking-[0.2em] uppercase hover:bg-foreground hover:text-background transition-colors"
          >
            Request Estimate <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="border-t border-border py-10 bg-muted/20">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <p className="font-display text-primary text-[10px] tracking-[0.3em] uppercase mb-4">
            // Related Service Paths
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/commercial/richmond-va" className="px-3 py-2 border border-border text-muted-foreground font-display text-[11px] tracking-wider hover:border-primary/40 hover:text-foreground transition-colors">
              Commercial Paving
            </Link>
            <Link to="/locations" className="px-3 py-2 border border-border text-muted-foreground font-display text-[11px] tracking-wider hover:border-primary/40 hover:text-foreground transition-colors">
              Service Areas
            </Link>
            <Link to="/#quote" className="px-3 py-2 border border-border text-muted-foreground font-display text-[11px] tracking-wider hover:border-primary/40 hover:text-foreground transition-colors">
              Request Free Estimate
            </Link>
            <Link to="/blog" className="px-3 py-2 border border-border text-muted-foreground font-display text-[11px] tracking-wider hover:border-primary/40 hover:text-foreground transition-colors">
              More Paving Guides
            </Link>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="py-16 border-t border-border">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h3 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight mb-8">
              More Articles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${p.slug}`}
                  className="group border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors p-6"
                >
                  <h4 className="font-display font-black text-foreground text-base uppercase tracking-tight leading-tight mb-2 group-hover:text-primary transition-colors">
                    {p.title}
                  </h4>
                  <p className="font-body text-muted-foreground text-sm leading-relaxed line-clamp-2">
                    {p.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
