import { useNavigate } from 'react-router-dom';

export function PageBackButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/chat')}
      aria-label="Voltar para conversas"
      title="Voltar para conversas"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                 text-chatz-text-muted transition-colors hover:bg-chatz-surface-hover
                 hover:text-chatz-primary"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
        <path d="M20 12H9" />
      </svg>
    </button>
  );
}
