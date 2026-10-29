// ==========================
// DESIGN TOKENS do chatZ
// Fonte da verdade — usar em JS/TS
// ==========================

export const colors = {
  bg: '#FAF8F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F6F5',
  surfaceHover: '#F3EFEE',

  border: '#E9E1E0',
  borderStrong: '#D6CBC9',

  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',

  primary: '#E719B5',
  primaryHover: '#C91597',
  primaryLight: '#FFF0F8',
  primaryBorder: '#FBCFE8',

  purple: '#A855F7',
  purpleHover: '#9333EA',
  purpleLight: '#FAF5FF',
  purpleBorder: '#E9D5FF',

  pink: '#EC4899',
  pinkHover: '#DB2777',
  pinkLight: '#FDF2F8',
  pinkBorder: '#FBCFE8',

  orange: '#F97316',
  orangeHover: '#EA580C',
  orangeLight: '#FFF7ED',
  orangeBorder: '#FED7AA',

  success: '#10B981',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',

  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',

  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
} as const;

export const gradients = {
  // Gradiente principal (mais quente)
  primary: 'linear-gradient(135deg, #E719B5 0%, #EC4899 52%, #FF711D 100%)',

  // Gradiente do botão (horizontal)
  button: 'linear-gradient(90deg, #E719B5 0%, #FB3B86 54%, #FF711D 100%)',

  // Gradiente do texto
  text: 'linear-gradient(90deg, #3B82F6 0%, #A855F7 35%, #EC4899 65%, #F97316 100%)',

  // Gradiente suave (fundos)
  primarySoft:
    'linear-gradient(135deg, #FFF0F8 0%, #FDF2F8 55%, #FFF7ED 100%)',

  // Variações curtas
  blueToPurple: 'linear-gradient(135deg, #E719B5 0%, #A855F7 100%)',
  purpleToPink: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
  pinkToOrange: 'linear-gradient(135deg, #EC4899 0%, #F97316 100%)',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
  md: '0 4px 12px rgba(15, 23, 42, 0.06)',
  lg: '0 8px 24px rgba(15, 23, 42, 0.08)',
  xl: '0 12px 32px rgba(15, 23, 42, 0.10)',
  '2xl': '0 24px 48px rgba(15, 23, 42, 0.12)',
  primary: '0 4px 14px rgba(231, 25, 181, 0.25)',
  'primary-lg': '0 8px 24px rgba(231, 25, 181, 0.30)',
  pink: '0 4px 14px rgba(236, 72, 153, 0.35)',
  'pink-lg': '0 8px 24px rgba(236, 72, 153, 0.45)',
} as const;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
} as const;

export const typography = {
  fontSans: "'Inter', system-ui, -apple-system, sans-serif",
  fontDisplay: "'Plus Jakarta Sans', 'Inter', sans-serif",
} as const;

export function gradient(style: keyof typeof gradients) {
  return { background: gradients[style] };
}