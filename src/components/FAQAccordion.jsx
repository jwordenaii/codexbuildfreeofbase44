import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Premium animated FAQ accordion.
 *
 * Props:
 *   items — array of { question: string, answer: string }
 *
 * Usage:
 *   <FAQAccordion items={MY_FAQS} />
 */
export default function FAQAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(null)

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i)

  return (
    <div className="space-y-3">
      {items.map(({ question, answer }, i) => {
        const isOpen = openIndex === i
        return (
          <div
            key={question}
            className={`rounded-2xl border-2 transition-colors duration-200 overflow-hidden ${
              isOpen
                ? 'border-brand-amber bg-white shadow-md'
                : 'border-transparent bg-white shadow-sm hover:border-brand-amber/30'
            }`}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={isOpen}
              onClick={() => toggle(i)}
            >
              <span className="font-semibold text-brand-navy text-sm sm:text-base leading-snug">
                {question}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-brand-amber text-2xl font-light flex-shrink-0 leading-none select-none"
                aria-hidden="true"
              >
                +
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <p className="px-6 pb-5 text-brand-navy/70 text-sm leading-relaxed">{answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
