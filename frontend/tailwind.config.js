/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chatz: {
          bg: '#0a0e1a',
          card: '#141824',
          'card-hover': '#1a1f2e',
          border: '#232838',
          primary: '#6366f1',
          'primary-hover': '#4f46e5',
          text: '#e4e6eb',
          muted: '#8a8f98',
          success: '#10b981',
          danger: '#ef4444',
          warning: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
}