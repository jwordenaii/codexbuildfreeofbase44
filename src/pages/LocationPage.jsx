import React from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { getLocationBySlug, PRIMARY_DOMAIN } from '@/lib/locations';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import MarketHero from '@/components/market/MarketHero';
import MarketCityList from '@/components/market/MarketCityList';
import MarketClimate from '@/components/market/MarketClimate';
import MarketFAQ from '@/components/market/MarketFAQ';
import MarketCTA from '@/components/market/MarketCTA';
import MarketAuthority from '@/components/market/MarketAuthority';
import { getAuthorityFor } from '@/lib/authorityContent';
import PageNotFound from '@/lib/PageNotFound';

export default function LocationPage() {
  const { slug } = useParams();
  const loc = getLocationBySlug(slug);

  if (!loc) return <PageNotFound />;

  const authorityEntry = getAuthorityFor(loc.slug);

  const canonicalPath = `/locations/${loc.slug}`;
  const title = `Asphalt Paving in ${loc.city}, ${loc.stateAbbr} | J. Worden & Sons`;
  const description = `Professional asphalt paving in ${loc.city}, ${loc.state}. ${loc.region} specialists with 40+ years of family-owned experience. Driveways, parking lots, sealcoating. Call ${loc.localPhone || '(804) 446-1296'}.`;

  // LocalBusiness + FAQPage JSON-LD combined
  const businessSchema = {
    '@type': 'GeneralContractor',
    '@id': `${PRIMARY_DOMAIN}${canonicalPath}#business`,
    name: loc.localGbpName || `J. Worden & Sons Paving LLC — ${loc.city}`,
      image: loc.gallery && loc.gallery.length > 0 
        ? loc.gallery.map(img => `${PRIMARY_DOMAIN}${img}`) 
        : `${PRIMARY_DOMAIN}/hero-paving.jpg`,
    url: `${PRIMARY_DOMAIN}${canonicalPath}`,
    telephone: loc.localPhone ? `+1-${loc.localPhone.replace(/\D/g, '')}` : '+1-804-446-1296',
    email: 'j.wordenandsonspaving@gmail.com',
    priceRange: '$$',
    areaServed: {
      '@type': 'City',
      name: loc.city,
      address: {
        '@type': 'PostalAddress',
        addressRegion: loc.stateAbbr,
      },
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: loc.geo.lat,
      longitude: loc.geo.lng,
    },
    description: loc.intro,
  };

  if (typeof loc.rating === 'number' && typeof loc.reviews === 'number') {
    businessSchema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: loc.rating,
      reviewCount: loc.reviews,
    };
  }

  // Only bind the Virginia Headquarters address if this location is in VA and does not have a distinct GBP address. 
  // Otherwise, Google will suspend the out-of-state GBPs for pointing to a VA address.
      if (loc.isHeadquarters || loc.stateAbbr === 'VA') {
      businessSchema.address = {
        '@type': 'PostalAddress',
        streetAddress: '1601 Ware Bottom Spring Rd, Suite 214',
        addressLocality: 'Chester',
        addressRegion: 'VA',
        postalCode: '23836',
        addressCountry: 'US',
      };
    } else if (loc.localAddress) {
      businessSchema.address = {
        '@type': 'PostalAddress',
        ...loc.localAddress,
      };
    }

    if (loc.video) {
        businessSchema.subjectOf = {
            '@type': 'VideoObject',
            name: `${loc.city} Commercial Asphalt Paving by J. Worden & Sons`,
            description: loc.video.description || `Watch our high-performance paving teams execute precision commercial asphalt overlays and sealcoating in ${loc.city}.`,
            thumbnailUrl: loc.video.thumbnailUrl || `${PRIMARY_DOMAIN}/hero-paving.jpg`,
            uploadDate: loc.video.uploadDate || '2026-05-01',
            contentUrl: `${PRIMARY_DOMAIN}${loc.video.url}`
        };
    }
  const graph = [businessSchema];

  if (Array.isArray(loc.faqs) && loc.faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: loc.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.a,
        },
      })),
    });
  }

  if (authorityEntry && authorityEntry.verified_content) {
    graph.push({
      '@type': 'Service',
      '@id': `${PRIMARY_DOMAIN}${canonicalPath}#authority-proof`,
      name: `${loc.city} Asphalt Paving — Project Verification`,
      description: authorityEntry.verified_content,
      provider: { '@id': `${PRIMARY_DOMAIN}${canonicalPath}#business` },
      areaServed: { '@type': 'City', name: loc.city, address: { '@type': 'PostalAddress', addressRegion: loc.stateAbbr } },
    });
  }

  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: PRIMARY_DOMAIN },
      { '@type': 'ListItem', position: 2, name: 'Service Areas', item: `${PRIMARY_DOMAIN}/locations` },
      { '@type': 'ListItem', position: 3, name: `${loc.city}, ${loc.stateAbbr}`, item: `${PRIMARY_DOMAIN}${canonicalPath}` },
    ],
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': graph,
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO
        title={title}
        description={description}
        canonicalPath={canonicalPath}
        jsonLd={jsonLd}
      />
      <Navbar />
      <MarketHero
        city={loc.city}
        state={loc.state}
        region={loc.region}
        headline={loc.headline}
        intro={loc.intro}
      />
              <div id="market-content">
          {loc.gallery && loc.gallery.length > 0 && (
            <section className="bg-muted/30 border-b border-border py-12 md:py-16">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="text-left w-full border-b border-border pb-4 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <p className="font-display font-bold text-primary text-xs uppercase tracking-[0.2em] mb-1">
                      Our Work
                    </p>
                    <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight">
                      {loc.city} Projects
                    </h2>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                  {loc.gallery.map((img, idx) => (
                    <div key={idx} className="aspect-square relative overflow-hidden rounded-md border border-border group bg-muted">
                      <img 
                        src={img} 
                        alt={`${loc.city} Paving Project ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading={idx > 3 ? "lazy" : "eager"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
                  {loc.video && (
            <section className="bg-background border-b border-border py-12 md:py-16">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="text-left w-full border-b border-border pb-4 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <p className="font-display font-bold text-primary text-xs uppercase tracking-[0.2em] mb-1">
                      On-Site Video
                    </p>
                    <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight">
                      {loc.city} Project Footage
                    </h2>
                  </div>
                </div>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-black mt-6">
                  <video 
                    controls 
                    preload="metadata" 
                    className="w-full h-full object-cover"
                    poster={loc.video.thumbnailUrl || '/hero-paving.jpg'}
                  >
                    <source src={loc.video.url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </section>
          )}

          <MarketCityList
          city={loc.city}
          state={loc.state}
          neighborhoods={loc.neighborhoods}
          landmarks={loc.landmarks}
        />

        {loc.slug === 'richmond-va' && (
          <section className="border-t border-border py-12 md:py-14">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="premium-panel rounded-2xl p-6 md:p-8">
                <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-3">
                  Richmond Commercial Resources
                </p>
                <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight">
                  Explore Detailed Commercial Scope And Proof
                </h2>
                <p className="text-muted-foreground text-sm md:text-base mt-3 leading-relaxed max-w-3xl">
                  Review our Richmond commercial planning page and project evidence before requesting your estimate.
                </p>
                <div className="flex flex-wrap gap-3 mt-6">
                  <Link
                    to="/commercial/richmond-va"
                    className="premium-cta px-5 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase text-primary-foreground"
                  >
                    Richmond Commercial Page
                  </Link>
                  <Link
                    to="/#projects"
                    className="border border-primary/40 text-primary px-5 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase hover:bg-primary/10 transition-colors"
                  >
                    Richmond Project Proof
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        <MarketAuthority entry={authorityEntry} city={loc.city} />
        <MarketClimate climate={loc.climate} city={loc.city} />
        <MarketFAQ faqs={loc.faqs} city={loc.city} />
        <MarketCTA city={loc.city} state={loc.stateAbbr} />
      </div>
      <Footer />
    </div>
  );
}
