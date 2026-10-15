import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'gradient';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  // Botão principal — azul sólido
  primary:
    'bg-chatz-primary text-white hover:bg-chatz-primary-hover ' +
    'shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.40)]',

  // Botão com gradiente — o "Entrar na plataforma" do mockup
  gradient:
    'text-white bg-chatz-gradient ' +
    'shadow-[0_4px_14px_rgba(139,92,246,0.35)] hover:shadow-[0_8px_24px_rgba(139,92,246,0.45)] ' +
    'hover:brightness-105',

  // Secundário — fundo cinza claro
  secondary:
    'bg-chatz-surface-alt text-chatz-text border border-chatz-border ' +
    'hover:bg-chatz-surface-hover hover:border-chatz-border-strong',

  // Outline — só borda
  outline:
    'bg-transparent text-chatz-text border border-chatz-border ' +
    'hover:bg-chatz-surface-alt hover:border-chatz-border-strong',

  // Ghost — sem fundo
  ghost:
    'bg-transparent text-chatz-text-muted hover:text-chatz-text ' +
    'hover:bg-chatz-surface-alt',

  // Perigo — vermelho
  danger:
    'bg-chatz-danger text-white hover:bg-red-600 ' +
    'shadow-[0_4px_14px_rgba(239,68,68,0.30)]',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-chatz-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-chatz gap-2',
  lg: 'px-6 py-3.5 text-base rounded-chatz-md gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...rest
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-semibold ' +
      'transition-all duration-200 ' +
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ' +
      'focus:outline-none focus:ring-2 focus:ring-chatz-primary/40 focus:ring-offset-2 ' +
      'active:scale-[0.98]';

    const classes = [
      baseClasses,
      VARIANTS[variant],
      SIZES[size],
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} disabled={disabled || loading} className={classes} {...rest}>
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon
        )}
        <span>{children}</span>
        {!loading && iconRight}
      </button>
    );
  }
);

Button.displayName = 'Button';