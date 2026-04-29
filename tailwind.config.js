/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Premium gold — construction yellow repositioned as luxury accent
          yellow: '#f5a623',
          'yellow-dark': '#d4880a',
          gold: '#f5a623',
          'gold-dark': '#d4880a',
          'gold-light': '#f9c46b',
          // Sophisticated charcoal palette
          charcoal: '#1a1a1a',
          'charcoal-light': '#3a3a3a',
          // Cream / off-white — warm, premium backgrounds
          cream: '#fafaf8',
          'cream-dark': '#f0f0ec',
          // Silver — refined borders and dividers
          silver: '#e8e8e8',
          'silver-dark': '#d0d0d0',
          // Legacy aliases — preserved for backward compatibility
          navy: '#1a1a1a',
          'navy-light': '#3a3a3a',
          amber: '#f5a623',
          'amber-dark': '#d4880a',
          'gray-light': '#fafaf8',
        },
      },
      fontFamily: {
        // Playfair Display — elegant serif for headings and luxury moments
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        // Inter — clean, modern for body copy and UI
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Premium display sizes — generous, commanding
        'display-2xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.005em' }],
      },
      spacing: {
        // Premium spacing — more breathing room, more luxury
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem',
        34: '8.5rem',
        38: '9.5rem',
        42: '10.5rem',
        46: '11.5rem',
        section: '7rem',
        'section-lg': '10rem',
      },
      borderRadius: {
        // Refined curves — premium, not bubbly
        '4xl': '2rem',
        '5xl': '2.5rem',
        luxury: '0.375rem',
      },
      boxShadow: {
        // Luxury shadows — subtle, layered, sophisticated
        premium:
          '0 1px 2px rgba(26,26,26,0.04), 0 4px 12px rgba(26,26,26,0.06), 0 12px 32px rgba(26,26,26,0.08)',
        'premium-lg':
          '0 2px 4px rgba(26,26,26,0.04), 0 8px 24px rgba(26,26,26,0.08), 0 24px 64px rgba(26,26,26,0.12)',
        'premium-xl':
          '0 4px 8px rgba(26,26,26,0.05), 0 16px 40px rgba(26,26,26,0.10), 0 40px 80px rgba(26,26,26,0.14)',
        gold: '0 4px 20px rgba(245,166,35,0.25), 0 1px 4px rgba(245,166,35,0.15)',
        'gold-lg': '0 8px 32px rgba(245,166,35,0.35), 0 2px 8px rgba(245,166,35,0.20)',
        inset: 'inset 0 1px 3px rgba(26,26,26,0.08)',
      },
      backgroundImage: {
        'hero-pattern': 'linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f5a623 0%, #d4880a 100%)',
        'cream-gradient': 'linear-gradient(180deg, #fafaf8 0%, #f0f0ec 100%)',
        'charcoal-gradient': 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
      },
      letterSpacing: {
        luxury: '0.12em',
        'luxury-wide': '0.18em',
        'luxury-xl': '0.25em',
      },
      transitionTimingFunction: {
        luxury: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'luxury-in': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
        'luxury-out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
  ],
}
