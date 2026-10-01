/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest
        canvas: '#0f1419',
        surface: {
          DEFAULT: '#1a2332',
          raised: '#1e2938',
        },
        line: {
          DEFAULT: 'rgb(255 255 255 / 0.08)',
          strong: 'rgb(255 255 255 / 0.14)',
        },
        // Teal: tabs, toggles, links, focus rings, progress
        brand: {
          DEFAULT: '#2a7b9b',
          hover: '#3a8bab',
          deep: '#2F5F7F',
          // Same hue, lifted for text and icons: the base teal is under 4.5:1 on navy
          light: '#62b3d1',
        },
        // Gold: the logo, primary actions, "you are here" markers
        gold: {
          DEFAULT: '#E8B44D',
          hover: '#D4A03C',
        },
        // Cool grays tuned to sit on the navy canvas (800/900/950 match the surfaces)
        gray: {
          50: '#f5f7fa',
          100: '#e8ecf1',
          200: '#d3dae3',
          300: '#b4bfcc',
          400: '#96a2b2',
          500: '#7a8798',
          600: '#47556a',
          700: '#2e3a4c',
          800: '#1e2938',
          900: '#1a2332',
          950: '#0f1419',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 1px 2px 0 rgb(0 0 0 / 0.3)',
        pop: '0 0 0 1px rgb(255 255 255 / 0.06), 0 16px 40px -8px rgb(0 0 0 / 0.6)',
      },
      keyframes: {
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'sheet-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.18s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'sheet-up': 'sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        shake: 'shake 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
}
