/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff5f7',
          100: '#ffe9ef',
          200: '#ffd3e0',
          300: '#ffb3c6',
          400: '#ff8fb8',
          500: '#ff6eb4',
          600: '#ec4899',
          700: '#be2d78',
        },
        ink: { DEFAULT: '#0f172a', soft: '#475569', mute: '#64748b' },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(90deg, #ffb3c6 0%, #ff6eb4 100%)',
        'brand-hero': 'linear-gradient(135deg, #ffa8c0 0%, #ff7ab8 100%)',
      },
      boxShadow: { card: '0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.04)' },
    },
  },
  plugins: [],
};
