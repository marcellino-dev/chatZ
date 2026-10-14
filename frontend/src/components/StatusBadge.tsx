import type { TicketStatus } from '../types';

const STYLES: Record<TicketStatus, { label: string; cls: string }> = {
  WAITING: {
    label: 'Aguardando',
    cls: 'bg-chatz-warning/10 text-chatz-warning border-chatz-warning/30',
  },
  IN_PROGRESS: {
    label: 'Em atendimento',
    cls: 'bg-chatz-primary/10 text-chatz-primary border-chatz-primary/30',
  },
  TRANSFERRED: {
    label: 'Transferido',
    cls: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
  RESOLVED: {
    label: 'Resolvido',
    cls: 'bg-chatz-success/10 text-chatz-success border-chatz-success/30',
  },
  CLOSED: {
    label: 'Fechado',
    cls: 'bg-chatz-muted/10 text-chatz-muted border-chatz-muted/30',
  },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, cls } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {label}
    </span>
  );
}