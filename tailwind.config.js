/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf2f2',
          100: '#fce4e4',
          200: '#fbcfcf',
          300: '#f79a9a',
          400: '#f26d6d',
          500: '#e94444',
          600: '#d62c2c',
          700: '#b31e1e',
          800: '#8B0000',
          900: '#7a0000',
          950: '#420000',
        },
        cream: {
          50:  '#fefef8',
          100: '#fdfde8',
          200: '#fafac5',
          300: '#f5f59a',
          400: '#eded6a',
          500: '#e2e23a',
          600: '#c9c921',
          700: '#9e9e18',
          800: '#7a7a18',
          900: '#616119',
        },
        liturgy: {
          green:  '#2d6a2d',
          red:    '#cc0000',
          white:  '#f8f0dc',
          purple: '#6b21a8',
          pink:   '#db2777',
          black:  '#1a1a1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        // Skeleton shimmer (replaces CSS version — Tailwind-managed)
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        // Floating dot sequence for loading
        dotPulse: {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%':            { transform: 'scale(1)',   opacity: '1'   },
        },
        // Slide-in from bottom (list items)
        slideInUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)'    },
        },
        // Scale pop for badges / notifications
        popIn: {
          '0%':   { transform: 'scale(0.7)',   opacity: '0' },
          '65%':  { transform: 'scale(1.06)',  opacity: '1' },
          '100%': { transform: 'scale(1)',     opacity: '1' },
        },
        // Gentle pulse ring for active indicators
        pingOnce: {
          '0%':   { transform: 'scale(1)',   opacity: '0.7' },
          '100%': { transform: 'scale(1.8)', opacity: '0'   },
        },
        // Gradient shift for loading screen logo
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%'   },
          '50%':       { backgroundPosition: '100% 50%' },
        },
        // Float subtle up/down
        float: {
          '0%, 100%': { transform: 'translateY(0)'   },
          '50%':      { transform: 'translateY(-4px)' },
        },
        // Horizontal draw for progress bars
        drawBar: {
          from: { transform: 'scaleX(0)' },
          to:   { transform: 'scaleX(1)' },
        },
      },
      animation: {
        shimmer:       'shimmer 2s linear infinite',
        dotPulse:      'dotPulse 1.4s ease-in-out infinite',
        slideInUp:     'slideInUp 0.3s ease-out both',
        popIn:         'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        pingOnce:      'pingOnce 0.6s ease-out forwards',
        gradientShift: 'gradientShift 3s ease infinite',
        float:         'float 3s ease-in-out infinite',
        drawBar:       'drawBar 0.7s ease-out both',
      },
    },
  },
  plugins: [],
};
