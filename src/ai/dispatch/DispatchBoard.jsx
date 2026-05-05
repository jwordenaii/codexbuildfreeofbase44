import { Helmet } from 'react-helmet-async';

/**
 * Smart Dispatch Board (skeleton)
 * ────────────────────────────────
 * Status: scaffold only — gated behind VITE_FEATURE_DISPATCH.
 *
 * This page is intentionally empty until the feature is built.
 * Real implementation will live in src/ai/dispatch/ subcomponents:
 *   - CrewSwimlane.jsx
 *   - JobCard.jsx
 *   - DispatchToolbar.jsx
 *   - useDispatchOptimizer.js
 *
 * Safety guarantees:
 *   1. Route only mounts when VITE_FEATURE_DISPATCH=true
 *   2. Wrapped in <RequireAuth> in App.jsx
 *   3. noindex header in netlify.toml
 *   4. Lazy-loaded so no impact on initial bundle
 */
export default function DispatchBoard() {
  return (
    <>
      <Helmet>
        <title>Dispatch Board — JWordenAI</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <strong>Beta</strong> — Smart Dispatch Board (feature flag: <code>VITE_FEATURE_DISPATCH</code>)
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Smart Dispatch Board</h1>
        <p className="mt-2 text-muted-foreground">
          AI-driven crew scheduling, drag-and-drop rescheduling, asphalt-cooling-aware
          route optimization, and Jarvis-powered nightly auto-planning.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-medium">Today</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Crew swim lanes will render here. (Coming next.)
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-medium">Live Map</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Truck GPS pins + jobsite locations. (Coming next.)
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-medium">Route Optimizer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Asphalt-cooling-aware sequencing per crew. (Coming next.)
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-medium">Jarvis Plan Tomorrow</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Overnight auto-plan with weather + plant-hours awareness. (Coming next.)
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
