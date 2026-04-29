/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          /* ── Primary dark — true construction charcoal (replaces purple navy) */
          navy:          '#161616',
          'navy-light':  '#222222',
          /* ── Construction yellow ─────────────────────────────────────────── */
          amber:         '#F5A623',
          'amber-dark':  '#D4880A',
          'amber-light': '#FEF3C7',
          'amber-vivid': '#F59E0B',
          /* ── Charcoal grays ──────────────────────────────────────────────── */
          charcoal:      '#2C2C2C',
          'charcoal-light': '#3D3D3D',
          'charcoal-subtle': '#4D4D4D',
          /* ── Warm surface ────────────────────────────────────────────────── */
          surface:       '#FAFAF9',
          'surface-warm':'#F7F5F1',
          /* ── Steel / meta text ───────────────────────────────────────────── */
          steel:         '#6B7280',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        /* 4 K-crisp display sizes */
        '5xl':  ['3rem',     { lineHeight: '1.1',  letterSpacing: '-0.02em' }],
        '6xl':  ['3.75rem',  { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        '7xl':  ['4.5rem',   { lineHeight: '1',    letterSpacing: '-0.03em' }],
        '8xl':  ['6rem',     { lineHeight: '1',    letterSpacing: '-0.04em' }],
      },
      backgroundImage: {
        'hero-pattern':    'linear-gradient(135deg, #161616 0%, #2C2C2C 100%)',
        'amber-gradient':  'linear-gradient(135deg, #F5A623 0%, #D4880A 100%)',
        'charcoal-radial': 'radial-gradient(ellipse at top, #2C2C2C 0%, #161616 100%)',
        'surface-gradient':'linear-gradient(180deg, #FAFAF9 0%, #F7F5F1 100%)',
      },
      boxShadow: {
        'xs':    '0 1px 2px rgba(0,0,0,0.05)',
        'sm':    '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        'md':    '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'lg':    '0 8px 30px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)',
        'xl':    '0 16px 48px rgba(0,0,0,0.12), 0 6px 18px rgba(0,0,0,0.07)',
        '2xl':   '0 24px 64px rgba(0,0,0,0.15), 0 10px 24px rgba(0,0,0,0.08)',
        'amber': '0 6px 20px rgba(245,166,35,0.35), 0 2px 6px rgba(245,166,35,0.20)',
        'amber-lg': '0 12px 40px rgba(245,166,35,0.40)',
        'inner-amber': 'inset 0 0 0 1px rgba(245,166,35,0.25)',
        'card':  '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 12px 36px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'xl':   '0.875rem',
        '2xl':  '1.125rem',
        '3xl':  '1.5rem',
        '4xl':  '2rem',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
        '400': '400ms',
      },
      letterSpacing: {
        'tighter': '-0.03em',
        'tight':   '-0.015em',
        'widest':  '0.15em',
        'ultra':   '0.2em',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'pulse-amber': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245,166,35,0.4)' },
          '50%':       { boxShadow: '0 0 0 8px rgba(245,166,35,0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-up':     'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in':     'fade-in 0.3s ease both',
        'shimmer':     'shimmer 2.5s linear infinite',
        'pulse-amber': 'pulse-amber 2s ease-in-out infinite',
        'float':       'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
  ],
}

