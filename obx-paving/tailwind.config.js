import animate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy:       '#0B1D35',
        'navy-mid': '#112B4F',
        ocean:      '#1666A8',
        'ocean-light': '#2A85CC',
        teal:       '#0E8F7E',
        sand:       '#C8973A',
        'sand-light': '#E8C87A',
        'sand-pale': '#FDF6E8',
        'off-white': '#F8F7F5',
        charcoal:   '#1E2833',
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, #0B1D35 0%, #112B4F 40%, #1666A8 100%)',
        'cta-gradient':
          'linear-gradient(135deg, #C8973A 0%, #E8C87A 100%)',
        'section-gradient':
          'linear-gradient(180deg, #F8F7F5 0%, #FDF6E8 100%)',
        'wave-pattern':
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s ease-out forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.6s ease-out forwards',
        shimmer: 'shimmer 2.5s infinite',
      },
    },
  },
  plugins: [animate, typography],
}
