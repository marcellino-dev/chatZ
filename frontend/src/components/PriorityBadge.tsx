import type { TicketPriority } from '../types';

const STYLES: Record<TicketPriority, { label: string; cls: string; dot: string }> = {
  LOW: {
    label: 'Baixa',
    cls: 'text-chatz-muted',
    dot: 'bg-chatz-muted',
  },
  MEDIUM: {
    label: 'Média',
    cls: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  HIGH: {
    label: 'Alta',
    cls: 'text-chatz-warning',
    dot: 'bg-chatz-warning',
  },
  URGENT: {
    label: 'Urgente',
    cls: 'text-chatz-danger',
    dot: 'bg-chatz-danger',
  },
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const { label, cls, dot } = STYLES[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}