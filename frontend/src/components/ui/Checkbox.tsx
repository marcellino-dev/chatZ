import type { InputHTMLAttributes } from 'react';

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Checkbox({
  label,
  id,
  className = '',
  ...rest
}: CheckboxProps) {
  const checkboxId = id || rest.name || label.toLowerCase().replace(/\s/g, '-');

  return (
    <label
      htmlFor={checkboxId}
      className={`inline-flex items-center gap-2 cursor-pointer select-none ${className}`}
    >
      <input
        type="checkbox"
        id={checkboxId}
        className="peer sr-only"
        {...rest}
      />
      <span
        className="w-4 h-4 rounded border-2 border-chatz-border
                   flex items-center justify-center shrink-0
                   transition-all duration-200
                   peer-checked:bg-chatz-primary peer-checked:border-chatz-primary
                   peer-focus:ring-2 peer-focus:ring-chatz-primary/20
                   peer-disabled:opacity-50"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-0 peer-checked:opacity-100 transition-opacity"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-sm text-chatz-text-muted">{label}</span>
    </label>
  );
}