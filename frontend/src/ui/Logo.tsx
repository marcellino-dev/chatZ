interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
};

const TEXT_SIZES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
};

// Logo com imagem (usa /logo.jpg do public)
export function Logo({ size = 'md', showText = false, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/logo.jpg"
        alt="chatZ"
        className={`${SIZES[size]} w-auto rounded-md object-contain`}
      />
      {showText && <LogoText size={size} />}
    </div>
  );
}

// Só o texto estilizado com gradiente
export function LogoText({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={`font-display font-extrabold tracking-tight ${TEXT_SIZES[size]}`}
    >
      <span className="text-chatz-text">chat</span>
      <span className="text-chatz-gradient">Z</span>
    </span>
  );
}

// Logo completo (imagem + texto)
export function LogoFull({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo.jpg"
        alt="chatZ"
        className={`${SIZES[size]} w-auto rounded-md object-contain`}
      />
      <LogoText size={size} />
    </div>
  );
}