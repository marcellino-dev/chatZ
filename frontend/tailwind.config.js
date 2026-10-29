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
          // Fundos
          bg: '#FAF8F7',
          surface: '#FFFFFF',
          'surface-alt': '#F8F6F5',
          'surface-hover': '#F3EFEE',

          // Bordas
          border: '#E9E1E0',
          'border-strong': '#D6CBC9',

          // Textos
          text: '#0F172A',
          'text-muted': '#64748B',
          'text-subtle': '#94A3B8',

          // Rosa da marca
          primary: '#E719B5',
          'primary-hover': '#C91597',
          'primary-light': '#FFF0F8',
          'primary-border': '#FBCFE8',

          // Roxo (meio do gradiente)
          purple: '#A855F7',
          'purple-hover': '#9333EA',
          'purple-light': '#FAF5FF',
          'purple-border': '#E9D5FF',

          // Rosa (destaque)
          pink: '#EC4899',
          'pink-hover': '#DB2777',
          'pink-light': '#FDF2F8',
          'pink-border': '#FBCFE8',

          // Laranja (destaque quente)
          orange: '#F97316',
          'orange-hover': '#EA580C',
          'orange-light': '#FFF7ED',
          'orange-border': '#FED7AA',

          // Alias pra compatibilidade
          accent: '#A855F7',
          'accent-light': '#FAF5FF',
          'accent-border': '#E9D5FF',

          // Status
          success: '#10B981',
          'success-light': '#ECFDF5',
          'success-border': '#A7F3D0',

          warning: '#F59E0B',
          'warning-light': '#FFFBEB',
          'warning-border': '#FDE68A',

          danger: '#EF4444',
          'danger-light': '#FEF2F2',
          'danger-border': '#FECACA',

          // Setores
          'sector-certificados': '#A855F7',
          'sector-comercial': '#F97316',
          'sector-financeiro': '#10B981',
          'sector-suporte': '#E719B5',
        },
      },

      boxShadow: {
        'chatz-sm': '0 1px 2px rgba(15, 23, 42, 0.04)',
        'chatz': '0 4px 12px rgba(15, 23, 42, 0.06)',
        'chatz-md': '0 8px 24px rgba(15, 23, 42, 0.08)',
        'chatz-lg': '0 12px 32px rgba(15, 23, 42, 0.10)',
        'chatz-xl': '0 24px 48px rgba(15, 23, 42, 0.12)',
        'chatz-inner': 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
        'primary': '0 4px 14px rgba(231, 25, 181, 0.25)',
        'primary-lg': '0 8px 24px rgba(231, 25, 181, 0.30)',
        'pink': '0 4px 14px rgba(236, 72, 153, 0.35)',
        'pink-lg': '0 8px 24px rgba(236, 72, 153, 0.45)',
      },

      borderRadius: {
        'chatz-sm': '8px',
        'chatz': '12px',
        'chatz-md': '16px',
        'chatz-lg': '20px',
        'chatz-xl': '24px',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },

      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        'blob': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'shake': 'shake 0.4s ease-in-out',
        'blob': 'blob 20s infinite ease-in-out',
        'float': 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}