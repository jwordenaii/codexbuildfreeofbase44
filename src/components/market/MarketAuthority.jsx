import React from 'react';
import { ShieldCheck } from 'lucide-react';

/**
 * MarketAuthority — renders the per-city "Verified Proof" content produced
 * by the J. Worden | Authority engine. Designed for SEO: the entire text
 * lives in the prerendered HTML so Google indexes it directly, not after
 * JS execution.
 *
 * Renders nothing when no Authority entry exists for this city (degrades
 * gracefully on freshly-ported skeletal entries).
 */
export default function MarketAuthority({ entry, city }) {
  if (!entry || !entry.verified_content) return null;

  const equipmentList = Array.isArray(entry.equipment) ? entry.equipment.filter(Boolean) : [];

  return (
    <section className="border-t border-border py-16 md:py-20 bg-muted/10">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
          <p className="font-display text-primary text-xs tracking-[0.3em] uppercase">
            Project Verification — Equipment &amp; Execution
          </p>
        </div>
        <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight max-w-3xl mb-6">
          {city} Site Spec — Verified by J. Worden | Authority
        </h2>
        <p className="font-body text-foreground text-lg leading-relaxed">
          {entry.verified_content}
        </p>
        {equipmentList.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {equipmentList.map((eq) => (
              <span
                key={eq}
                className="px-3 py-1.5 border border-border text-muted-foreground font-display text-xs tracking-wider uppercase"
              >
                {eq}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
