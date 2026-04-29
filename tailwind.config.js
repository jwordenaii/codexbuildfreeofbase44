/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#f5a623',
          'yellow-dark': '#d4880a',
          charcoal: '#2d2d2d',
          'charcoal-light': '#4a4a4a',
          'gray-light': '#f8f8f8',
          // Legacy aliases kept for backward compatibility
          navy: '#2d2d2d',
          'navy-light': '#4a4a4a',
          amber: '#f5a623',
          'amber-dark': '#d4880a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-pattern': 'linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 100%)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
  ],
}
