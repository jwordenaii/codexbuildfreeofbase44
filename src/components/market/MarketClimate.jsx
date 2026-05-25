import React from 'react';
import { Thermometer } from 'lucide-react';

export default function MarketClimate({ climate, city }) {
  if (!climate || (!climate.title && !climate.body)) return null;
  return (
    <section className="border-t border-border py-16 md:py-20 bg-muted/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4">
            <div className="w-14 h-14 bg-primary/10 border border-primary/30 flex items-center justify-center mb-5">
              <Thermometer className="w-6 h-6 text-primary" />
            </div>
            <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-3">
              Local Climate Engineering
            </p>
            <h2 className="font-display font-black text-foreground text-3xl md:text-4xl uppercase tracking-tight leading-[1.05]">
              Why {city} asphalt fails — and how we build to outlast it.
            </h2>
          </div>

          <div className="lg:col-span-8 lg:pl-8 lg:border-l border-border">
            <h3 className="font-display font-bold text-primary text-lg tracking-wider uppercase mb-4">
              {climate.title}
            </h3>
            <p className="font-body text-foreground text-lg leading-relaxed">
              {climate.body}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
