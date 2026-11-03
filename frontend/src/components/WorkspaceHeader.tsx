import type { ReactNode } from 'react';
import { PageBackButton } from './PageBackButton';

interface WorkspaceHeaderProps {
  title: string;
  description: string;
  section: string;
  action?: ReactNode;
}

export function WorkspaceHeader({
  title,
  description,
  section,
  action,
}: WorkspaceHeaderProps) {
  return (
    <header className="relative mb-7 flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-3xl border border-chatz-border bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-20 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.12),rgba(59,130,246,0.06)_48%,transparent_72%)]"
      />
      <div className="relative flex min-w-0 items-center gap-3">
        <PageBackButton />
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-chatz-primary">
            {section}
          </p>
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight text-chatz-text sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-chatz-text-muted">
            {description}
          </p>
        </div>
      </div>
      {action && <div className="relative flex w-full shrink-0 items-center sm:w-auto">{action}</div>}
    </header>
  );
}
