// ==========================
// DESIGN TOKENS do chatZ
// Fonte da verdade — usar em JS/TS
// ==========================

export const colors = {
  bg: '#FAFBFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  surfaceHover: '#F1F5F9',

  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',

  primary: '#3B82F6',
  primaryHover: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryBorder: '#BFDBFE',

  success: '#10B981',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',

  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',

  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',

  accent: '#8B5CF6',
  accentLight: '#F5F3FF',
  accentBorder: '#DDD6FE',

  pink: '#EC4899',
  pinkLight: '#FDF2F8',
  pinkBorder: '#FBCFE8',
} as const;

export const gradients = {
  primary: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%)',
  primarySoft:
    'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #FDF2F8 100%)',
  blueToPurple: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
  purpleToPink: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
  md: '0 4px 12px rgba(15, 23, 42, 0.06)',
  lg: '0 8px 24px rgba(15, 23, 42, 0.08)',
  xl: '0 12px 32px rgba(15, 23, 42, 0.10)',
  '2xl': '0 24px 48px rgba(15, 23, 42, 0.12)',
  primary: '0 4px 14px rgba(59, 130, 246, 0.35)',
  'primary-lg': '0 8px 24px rgba(59, 130, 246, 0.40)',
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

// Helper: gradiente como CSS inline (para style={})
export function gradient(style: keyof typeof gradients) {
  return { background: gradients[style] };
}