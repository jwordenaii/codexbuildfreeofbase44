import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'

/**
 * InspirationGallery — Houzz-style visual design inspiration panel.
 *
 * Displays curated project categories with style cards for:
 *   • Interior design styles
 *   • Outdoor living / cobblestone & brick paver patios
 *   • Stone masonry features
 *   • General construction project types
 *
 * Each card links to the relevant service section or quote page.
 */

const CATEGORIES = [
  {
    id: 'interior',
    label: 'Interior Design',
    icon: '🎨',
    gradient: 'from-rose-500 to-orange-400',
  },
  {
    id: 'outdoor',
    label: 'Outdoor Living',
    icon: '🪨',
    gradient: 'from-stone-600 to-amber-600',
  },
  {
    id: 'masonry',
    label: 'Stone Masonry',
    icon: '🧱',
    gradient: 'from-gray-700 to-slate-500',
  },
  {
    id: 'construction',
    label: 'Construction',
    icon: '🏗',
    gradient: 'from-brand-navy to-blue-700',
  },
]

const INSPIRATION_ITEMS = [
  // Interior Design
  {
    category: 'interior',
    title: 'Modern Farmhouse Kitchen',
    description: 'Shaker cabinetry, quartz waterfall island, warm brass hardware, and wide-plank white oak floors.',
    tags: ['Kitchen', 'Farmhouse', 'Quartz', 'White Oak'],
    href: '/services#interior-design',
    gradient: 'from-amber-50 to-stone-100',
    accent: '#d97706',
  },
  {
    category: 'interior',
    title: 'Transitional Primary Suite',
    description: 'Spa-inspired bath with freestanding soaker tub, floor-to-ceiling tile, and custom built-in closet system.',
    tags: ['Primary Suite', 'Bathroom', 'Tile', 'Custom Millwork'],
    href: '/services#interior-design',
    gradient: 'from-slate-50 to-blue-50',
    accent: '#1a1a2e',
  },
  {
    category: 'interior',
    title: 'Open-Concept Living Room',
    description: 'Coffered ceiling, built-in bookcase flanking stone fireplace, linen sectional, and layered lighting plan.',
    tags: ['Living Room', 'Fireplace', 'Built-ins', 'Lighting'],
    href: '/services#interior-design',
    gradient: 'from-warm-50 to-amber-50',
    accent: '#92400e',
  },
  {
    category: 'interior',
    title: 'Executive Home Office',
    description: 'Floor-to-ceiling walnut paneling, integrated smart lighting (Lutron), built-in shelving, and acoustic panels.',
    tags: ['Home Office', 'Walnut', 'Smart Home', 'Acoustic'],
    href: '/services#interior-design',
    gradient: 'from-stone-100 to-gray-100',
    accent: '#374151',
  },
  // Outdoor Living
  {
    category: 'outdoor',
    title: 'Herringbone Brick Paver Patio',
    description: 'Classic 45° herringbone tumbled brick pattern with soldier-course border, built on an 8" engineered base.',
    tags: ['Brick Pavers', 'Herringbone', 'Patio', 'Tumbled Brick'],
    href: '/services#cobblestone-pavers',
    gradient: 'from-orange-50 to-red-50',
    accent: '#b45309',
  },
  {
    category: 'outdoor',
    title: 'Reclaimed Cobblestone Courtyard',
    description: 'Hand-laid reclaimed cobblestone plaza with radial fan focal point and integrated landscape lighting.',
    tags: ['Cobblestone', 'Courtyard', 'Reclaimed', 'Fan Pattern'],
    href: '/services#cobblestone-pavers',
    gradient: 'from-stone-100 to-amber-50',
    accent: '#78350f',
  },
  {
    category: 'outdoor',
    title: 'Outdoor Kitchen & Paver Pool Deck',
    description: 'Permeable concrete pavers around pool deck with outdoor kitchen island and covered pergola structure.',
    tags: ['Pool Deck', 'Outdoor Kitchen', 'Pergola', 'Permeable'],
    href: '/services#cobblestone-pavers',
    gradient: 'from-sky-50 to-teal-50',
    accent: '#0f766e',
  },
  {
    category: 'outdoor',
    title: 'Estate Entry Cobblestone Drive',
    description: 'Grand driveway in tumbled cobblestone with contrasting soldier-course border and centered medallion.',
    tags: ['Driveway', 'Estate', 'Cobblestone', 'Medallion'],
    href: '/services#cobblestone-pavers',
    gradient: 'from-gray-50 to-stone-100',
    accent: '#44403c',
  },
  // Stone Masonry
  {
    category: 'masonry',
    title: 'Natural Fieldstone Retaining Wall',
    description: 'Dry-stack Virginia fieldstone retaining wall with integrated fieldstone steps and planting pockets.',
    tags: ['Retaining Wall', 'Fieldstone', 'Dry-Stack', 'Steps'],
    href: '/services#stone-masonry',
    gradient: 'from-stone-100 to-gray-100',
    accent: '#57534e',
  },
  {
    category: 'masonry',
    title: 'Outdoor Stone Fireplace',
    description: 'Mortared Pennsylvania bluestone fireplace surround with raised hearth, wood box, and built-in seating wall.',
    tags: ['Fireplace', 'Bluestone', 'Mortared', 'Seating Wall'],
    href: '/services#stone-masonry',
    gradient: 'from-blue-50 to-slate-100',
    accent: '#1e3a5f',
  },
  {
    category: 'masonry',
    title: 'Flagstone Terrace & Garden Path',
    description: 'Sand-set Pennsylvania bluestone terrace with irregular flagstone stepping-stone garden path and moss joints.',
    tags: ['Flagstone', 'Terrace', 'Garden Path', 'Bluestone'],
    href: '/services#stone-masonry',
    gradient: 'from-green-50 to-stone-50',
    accent: '#166534',
  },
  {
    category: 'masonry',
    title: 'Stone Veneer Foundation & Columns',
    description: 'Natural ledgestone veneer on home foundation and entry porch columns, tied with limestone capstone.',
    tags: ['Stone Veneer', 'Columns', 'Ledgestone', 'Curb Appeal'],
    href: '/services#stone-masonry',
    gradient: 'from-amber-50 to-stone-100',
    accent: '#92400e',
  },
  // Construction
  {
    category: 'construction',
    title: 'QSR / Drive-Thru New Build',
    description: 'Ground-up QSR restaurant construction — shell, MEP rough-in, drive-thru lane, ADA paving, and site work.',
    tags: ['QSR', 'Ground-Up', 'Drive-Thru', 'Commercial'],
    href: '/services#general-contracting',
    gradient: 'from-brand-navy/5 to-blue-50',
    accent: '#1a1a2e',
  },
  {
    category: 'construction',
    title: 'Commercial Office Build-Out',
    description: 'Open-plan office fit-out with glass-front conference rooms, custom millwork reception, and Lutron lighting.',
    tags: ['Office', 'Fit-Out', 'Commercial', 'Millwork'],
    href: '/services#general-contracting',
    gradient: 'from-sky-50 to-indigo-50',
    accent: '#1e40af',
  },
  {
    category: 'construction',
    title: 'Luxury Residential Addition',
    description: 'Two-story rear addition with great room, primary suite, and walk-out bluestone patio — fully permitted.',
    tags: ['Addition', 'Residential', 'Luxury', 'Two-Story'],
    href: '/services#general-contracting',
    gradient: 'from-amber-50 to-warm-50',
    accent: '#d97706',
  },
  {
    category: 'construction',
    title: 'Full-Home Renovation',
    description: 'Complete gut renovation of 1970s ranch home — new framing, MEP, insulation, finishes, and landscaping.',
    tags: ['Renovation', 'Full-Home', 'Residential', 'GC'],
    href: '/services#general-contracting',
    gradient: 'from-rose-50 to-orange-50',
    accent: '#e11d48',
  },
]

export default function InspirationGallery({ maxItems = null }) {
  const [activeCategory, setActiveCategory] = useState('all')

  const filtered =
    activeCategory === 'all'
      ? INSPIRATION_ITEMS
      : INSPIRATION_ITEMS.filter((item) => item.category === activeCategory)

  const displayed = maxItems ? filtered.slice(0, maxItems) : filtered

  return (
    <div>
      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
            activeCategory === 'all'
              ? 'bg-brand-navy text-white shadow-md'
              : 'bg-white text-brand-navy/70 border border-brand-navy/20 hover:border-brand-navy/40'
          }`}
        >
          All Projects
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
              activeCategory === cat.id
                ? 'bg-brand-navy text-white shadow-md'
                : 'bg-white text-brand-navy/70 border border-brand-navy/20 hover:border-brand-navy/40'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Masonry-style inspiration grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 space-y-0">
        <AnimatePresence mode="popLayout">
          {displayed.map((item, i) => (
            <motion.div
              key={`${item.category}-${item.title}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="break-inside-avoid mb-5"
            >
              <Link
                to={item.href}
                className="group block rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-brand-navy/10"
              >
                {/* Visual panel */}
                <div
                  className={`relative bg-gradient-to-br ${item.gradient} p-8 flex items-center justify-center min-h-[140px]`}
                >
                  {/* Category icon badge */}
                  <div className="absolute top-3 left-3">
                    <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/70 text-brand-navy/70">
                      {CATEGORIES.find((c) => c.id === item.category)?.label}
                    </span>
                  </div>

                  {/* Decorative pattern overlay */}
                  <div
                    className="absolute inset-0 opacity-5"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 12px)',
                      backgroundSize: '12px 12px',
                      color: item.accent,
                    }}
                  />

                  {/* Central icon */}
                  <span className="text-5xl drop-shadow-sm">
                    {CATEGORIES.find((c) => c.id === item.category)?.icon}
                  </span>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-brand-navy/0 group-hover:bg-brand-navy/10 transition-colors" />
                </div>

                {/* Text content */}
                <div className="bg-white p-4">
                  <h3
                    className="font-display font-bold text-base text-brand-navy mb-1 group-hover:text-brand-amber transition-colors leading-snug"
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs text-brand-navy/60 leading-relaxed mb-3">
                    {item.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-brand-navy/5 text-brand-navy/60 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* View all link when showing preview */}
      {maxItems && filtered.length > maxItems && (
        <div className="text-center mt-10">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-brand-amber font-semibold hover:underline"
          >
            View all {filtered.length} project inspirations →
          </Link>
        </div>
      )}
    </div>
  )
}
