import { Link, useParams } from 'react-router-dom'
import SchemaMarkup, { faqSchema, serviceSchema } from '../components/SchemaMarkup'
import { getStatePavingPageModel, STATE_PAGE_ROUTES } from '../lib/states50'
import { getStatePageIndexingReadiness, GOOGLE_SEO_POLICY_TRACKER } from '../lib/googleSeoPolicy'
import { COMPETITOR_CONTENT_QUALITY_GATE } from '../lib/competitorSeoStrategy'
import NotFound from './NotFound'

function statePavingSchema(model) {
  return [
    serviceSchema(
      `${model.name} Asphalt Paving, Pavement Preservation, Parking Lots and Driveways`,
      model.metaDescription,
      model.path,
      model.pricingSignal
    ),
    faqSchema([
      {
        question: `Do you have ${model.name} asphalt paving page logic ready?`,
        answer: `Yes. This future-ready page model supports ${model.name} paving content for services, pricing, seasonality, compliance, and Google-quality checks before it is added to the sitemap.`,
      },
      {
        question: `Will every ${model.name} page be unique before publishing?`,
        answer:
          'Yes. The model requires original local proof, market details, service capacity, and helpful buyer guidance before large-scale indexing.',
      },
    ]),
  ]
}

export default function StatePavingPage() {
  const { stateSlug } = useParams()
  const model = getStatePavingPageModel(stateSlug)

  if (!model) return <NotFound />

  const readiness = getStatePageIndexingReadiness(model)
  const nearbyStates = STATE_PAGE_ROUTES.filter((state) => state.abbr !== model.abbr).slice(0, 8)

  return (
    <>
      <SchemaMarkup
        title={model.title}
        description={model.metaDescription}
        canonical={model.path}
        schema={statePavingSchema(model)}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'States', path: '/service-areas' },
          { name: model.name, path: model.path },
        ]}
      />

      <section className="bg-brand-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
            Future-ready state paving page · {model.region}
          </span>
          <h1 className="font-display font-black text-4xl md:text-6xl mt-3 mb-5">{model.h1}</h1>
          <p className="text-white/70 text-xl max-w-3xl">
            This page framework is ready for tomorrow&rsquo;s state expansion. It is intentionally
            built with helpful-content controls so every state page can become useful, original, and
            Google-policy aligned before sitemap publishing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Link to="/quote" className="btn-primary">
              Request a Free Estimate
            </Link>
            <Link to="/services" className="btn-outline">
              View Asphalt Services
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_0.85fr] gap-10">
          <div className="space-y-8">
            <div>
              <h2 className="section-heading mb-4">{model.name} Page Logic</h2>
              <p className="text-brand-navy/70 leading-relaxed mb-4">{model.pricingSignal}</p>
              <p className="text-brand-navy/70 leading-relaxed">{model.climateNote}</p>
              <p className="text-brand-navy/70 leading-relaxed mt-4">
                The model is also ready for preservation-first content: when to seal, crack fill,
                patch, resurface, recycle, reconstruct, or fully replace based on condition,
                traffic, drainage, and budget timing.
              </p>
            </div>

            <div>
              <h3 className="font-display font-black text-2xl text-brand-navy mb-4">
                Services Ready for State Expansion
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {model.targetServices.map((service) => (
                  <div
                    key={service}
                    className="rounded-xl border border-brand-navy/10 p-4 text-sm text-brand-navy/75"
                  >
                    ✓ {service}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display font-black text-2xl text-brand-navy mb-4">
                Google-Aligned Publishing Requirements
              </h3>
              <ul className="space-y-3">
                {model.contentRequirements.map((requirement) => (
                  <li key={requirement} className="flex gap-3 text-sm text-brand-navy/75">
                    <span className="w-5 h-5 rounded-full bg-brand-amber text-brand-navy font-bold text-xs flex items-center justify-center flex-shrink-0">
                      ✓
                    </span>
                    {requirement}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl bg-brand-navy text-white p-6">
              <h3 className="font-display font-bold text-xl mb-4">Indexing Readiness</h3>
              <div className="text-4xl font-display font-black text-brand-amber mb-2">
                {readiness.ready ? 'READY' : 'HOLD'}
              </div>
              <p className="text-white/60 text-sm">
                Policy reviewed {readiness.lastPolicyReviewed}. Sitemap publishing is controlled
                separately so future states can be prepared without thin-page risk.
              </p>
            </div>

            <div className="rounded-2xl border border-brand-navy/10 p-6">
              <h3 className="font-display font-bold text-brand-navy mb-3">Compliance Signals</h3>
              <ul className="space-y-2 text-sm text-brand-navy/70">
                <li>
                  Price index: {model.laborIndex} labor / {model.materialPremium} materials
                </li>
                <li>Paving season: {model.asphaltMonths} months</li>
                <li>QSR density: {model.qsrDensity}</li>
                {model.complianceSignals.map((signal) => (
                  <li key={signal}>✓ {signal}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-brand-navy/10 p-6">
              <h3 className="font-display font-bold text-brand-navy mb-3">Google Policy Tracker</h3>
              <p className="text-xs text-brand-navy/50 mb-3">{GOOGLE_SEO_POLICY_TRACKER.purpose}</p>
              <ul className="space-y-2 text-xs text-brand-navy/65">
                {GOOGLE_SEO_POLICY_TRACKER.policyWatchItems.map((item) => (
                  <li key={item.area}>• {item.area}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-brand-navy/10 p-6">
              <h3 className="font-display font-bold text-brand-navy mb-3">Competitor Logic Gate</h3>
              <ul className="space-y-2 text-xs text-brand-navy/65">
                {COMPETITOR_CONTENT_QUALITY_GATE.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-black text-2xl text-brand-navy mb-5">
            Other State Page Models Already Available
          </h2>
          <div className="flex flex-wrap gap-2">
            {nearbyStates.map((state) => (
              <Link
                key={state.abbr}
                to={state.path}
                className="bg-white border border-brand-navy/10 rounded-full px-4 py-2 text-sm text-brand-navy/70 hover:border-brand-amber"
              >
                {state.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
