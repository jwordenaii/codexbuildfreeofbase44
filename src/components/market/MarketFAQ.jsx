import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

export default function MarketFAQ({ faqs, city }) {
  const [openIdx, setOpenIdx] = useState(0);

  if (!Array.isArray(faqs) || faqs.length === 0) return null;

  return (
    <section className="border-t border-border py-16 md:py-20">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-3">
          {city} Paving FAQs
        </p>
        <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight mb-10">
          Common Questions
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const open = openIdx === i;
            return (
              <div key={faq.q} className="border border-border bg-card">
                <button
                  onClick={() => setOpenIdx(open ? -1 : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-muted/30 transition-colors min-h-[48px]"
                >
                  <span className="font-display font-bold text-foreground text-base md:text-lg tracking-wide">
                    {faq.q}
                  </span>
                  {open ? (
                    <Minus className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <Plus className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 font-body text-muted-foreground text-base leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
