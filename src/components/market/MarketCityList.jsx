import React from 'react';
import { MapPin } from 'lucide-react';

export default function MarketCityList({ city, state, neighborhoods, landmarks }) {
  const hasNeighborhoods = Array.isArray(neighborhoods) && neighborhoods.length > 0;
  const hasLandmarks = Array.isArray(landmarks) && landmarks.length > 0;
  if (!hasNeighborhoods && !hasLandmarks) return null;
  return (
    <section className="border-t border-border py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-primary font-display font-black text-lg">//</span>
          <p className="font-display text-primary text-xs tracking-[0.3em] uppercase">Service Area</p>
        </div>
        <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight max-w-3xl mb-10">
          Neighborhoods We Pave In {city}
        </h2>

        {hasNeighborhoods && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-12">
          {neighborhoods.map((n) => (
            <div
              key={n}
              className="border border-border bg-card p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
            >
              <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="font-display font-bold text-foreground text-sm tracking-wide">{n}</span>
            </div>
          ))}
        </div>
        )}

        {hasLandmarks && (
          <div className="border-t border-border pt-8">
            <p className="font-display text-muted-foreground text-xs tracking-[0.2em] uppercase mb-4">
              Local Landmarks We've Worked Around
            </p>
            <div className="flex flex-wrap gap-2">
              {landmarks.map((l) => (
                <span
                  key={l}
                  className="px-3 py-1.5 border border-border text-muted-foreground font-display text-xs tracking-wider uppercase"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
