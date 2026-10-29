import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, getErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useTicketsStore } from '../../stores/tickets';
import { useAuthStore } from '../../stores/auth';
import { ProfileAvatar } from '../ProfileAvatar';
import { TransferModal } from './TransferModal';
import { AddParticipantModal } from './AddParticipantModal';
import type { Contact, Ticket } from '../../types';

interface Props {
  onClose: () => void;
}

export function ChatInfo({ onClose }: Props) {
  const { id } = useParams<{ id: string }>();
  const updateStatus = useTicketsStore((s) => s.updateStatus);
  const user = useAuthStore((s) => s.user);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [savedContact, setSavedContact] = useState<Contact | null>(null);

  async function loadTicket() {
    if (!id) return;
    console.log('🔄 [ChatInfo] Recarregando ticket:', id);
    setLoading(true);
    try {
      const { data } = await api.get<Ticket>(`/tickets/${id}`);
      console.log('✅ [ChatInfo] Ticket carregado');
      console.log('   Status:', data.status);
      console.log('   Participantes:', data.participants?.map((p) => p.user.name));
      setTicket(data);
      const { data: contact } = await api.get<Contact | null>(
        `/contacts/from-ticket/${id}`
      );
      setSavedContact(contact);
    } catch (err) {
      console.error('❌ [ChatInfo] Erro:', err);
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTicket();
  }, [id]);

  // Recarrega quando muda o participante (via socket)
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    if (!socket) return;

    function handleParticipantChange() {
      console.log('👥 [ChatInfo] Participante mudou, recarregando...');
      loadTicket();
    }

    socket.on('ticket:participant-added', handleParticipantChange);
    socket.on('ticket:participant-removed', handleParticipantChange);

    return () => {
      socket.off('ticket:participant-added', handleParticipantChange);
      socket.off('ticket:participant-removed', handleParticipantChange);
    };
  }, [id]);

  async function handleResolve() {
    if (!id) return;
    if (!confirm('Marcar este ticket como resolvido?')) return;
    setActionLoading(true);
    try {
      await updateStatus(id, 'RESOLVED');
      onClose();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleParticipantAdded() {
    console.log('✅ [ChatInfo] Participante adicionado, recarregando ticket...');
    await loadTicket();
  }

  function handleContactSaved(contact: Contact) {
    setSavedContact(contact);
    setTicket((current) =>
      current
        ? {
            ...current,
            client: {
              ...current.client,
              name: contact.name,
              company: contact.company,
            },
          }
        : current
    );
    setContactModalOpen(false);
  }

  if (!id || loading) return null;
  if (!ticket) return null;

  const isActive =
    ticket.status === 'WAITING' || ticket.status === 'IN_PROGRESS';
  const canModify =
    isActive &&
    (user?.role === 'ADMIN' || ticket.agentId === user?.id);

  return (
    <aside className="w-[340px] bg-chatz-surface border-l border-chatz-border flex flex-col shrink-0 animate-slide-in">
      <div className="h-16 px-4 border-b border-chatz-border flex items-center justify-between shrink-0">
        <p className="text-sm font-semibold text-chatz-text">Detalhes</p>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-chatz flex items-center justify-center
                     text-chatz-text-muted hover:bg-chatz-surface-hover transition-all"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 text-center border-b border-chatz-border">
          <div className="flex justify-center mb-3">
            <ProfileAvatar
              name={ticket.client.name}
              pictureUrl={ticket.client.profilePictureUrl}
              sizeClass="w-20 h-20"
              textClass="text-2xl"
            />
          </div>
          <h3 className="text-base font-semibold text-chatz-text mb-1">
            {ticket.client.name}
          </h3>
          {ticket.client.company && (
            <p className="mb-1 text-xs font-medium text-chatz-text-muted">
              {ticket.client.company}
            </p>
          )}
          <p className="text-xs text-chatz-text-muted">{ticket.client.phone}</p>
          <button
            onClick={() => setContactModalOpen(true)}
            className="mt-4 px-3 py-2 text-xs font-medium rounded-chatz
                       border border-chatz-primary-border text-chatz-primary
                       hover:bg-chatz-primary-light"
          >
            {savedContact ? 'Editar contato salvo' : 'Salvar nos contatos'}
          </button>
        </div>

        <Section title="Ticket">
          <Row label="Protocolo" value={`#${ticket.id.slice(0, 8)}`} />
          <Row label="Setor" value={ticket.sector.name} />
          <Row label="Atendente" value={ticket.agent?.name ?? 'Aguardando'} />
          <Row label="Status" value={statusLabel(ticket.status)} />
          <Row label="Prioridade" value={priorityLabel(ticket.priority)} />
        </Section>

        {ticket.participants && ticket.participants.length > 0 && (
          <Section title={`Participantes (${ticket.participants.length})`}>
            {ticket.participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 text-xs text-chatz-text-muted"
              >
                <span>🎧</span>
                <span className="text-chatz-text">{p.user.name}</span>
                {p.addedBy && (
                  <span className="text-chatz-text-subtle">
                    (por {p.addedBy.name})
                  </span>
                )}
              </div>
            ))}
          </Section>
        )}

        {ticket.transfers && ticket.transfers.length > 0 && (
          <Section title="Transferências">
            <div className="space-y-2">
              {ticket.transfers.map((t) => (
                <div key={t.id} className="text-xs text-chatz-text-muted">
                  <p className="text-chatz-text">
                    {t.fromUser.name} →{' '}
                    <span className="text-chatz-purple">
                      {t.toUser?.name ?? t.toSector?.name}
                    </span>
                  </p>
                  {t.reason && (
                    <p className="italic text-chatz-text-subtle">"{t.reason}"</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className="p-4 border-t border-chatz-border space-y-2 shrink-0">
        {!isActive && (
          <div className="bg-chatz-surface-alt border border-chatz-border rounded-chatz
                          px-4 py-3 text-center">
            <p className="text-xs text-chatz-text-muted">
              {ticket.status === 'RESOLVED' && '✅ Ticket resolvido'}
              {ticket.status === 'CLOSED' && '🔒 Ticket fechado'}
              {ticket.status === 'TRANSFERRED' && '🔄 Ticket transferido'}
            </p>
            <p className="text-[10px] text-chatz-text-subtle mt-1">
              Não é possível modificar
            </p>
          </div>
        )}

        {canModify && (
          <>
            <button
              onClick={() => setAddOpen(true)}
              className="w-full py-2.5 px-4 rounded-chatz
                         bg-chatz-primary-light border border-chatz-primary-border text-chatz-primary
                         text-sm font-semibold hover:bg-chatz-primary/10 transition-all"
            >
              ➕ Adicionar à conversa
            </button>

            <button
              onClick={() => setTransferOpen(true)}
              className="w-full py-2.5 px-4 rounded-chatz
                         bg-chatz-warning-light border border-chatz-warning-border text-chatz-warning
                         text-sm font-semibold hover:bg-chatz-warning/10 transition-all"
            >
              🔄 Transferir
            </button>

            <button
              onClick={handleResolve}
              disabled={actionLoading}
              className="w-full py-2.5 px-4 rounded-chatz bg-chatz-success text-white
                         text-sm font-semibold hover:bg-green-600 transition-all
                         disabled:opacity-50 shadow-[0_4px_14px_rgba(16,185,129,0.30)]"
            >
              {actionLoading ? 'Processando...' : '✓ Marcar como resolvido'}
            </button>
          </>
        )}
      </div>

      <TransferModal
        isOpen={transferOpen}
        ticketId={ticket.id}
        currentSectorId={ticket.sectorId}
        currentAgentId={ticket.agentId}
        onClose={() => setTransferOpen(false)}
        onSuccess={() => loadTicket()}
      />

      <AddParticipantModal
        isOpen={addOpen}
        ticketId={ticket.id}
        currentSectorId={ticket.sectorId}
        currentAgentId={ticket.agentId}
        participants={ticket.participants ?? []}
        onClose={() => setAddOpen(false)}
        onSuccess={handleParticipantAdded}
      />
      {contactModalOpen && (
        <TicketContactModal
          ticket={ticket}
          contact={savedContact}
          onClose={() => setContactModalOpen(false)}
          onSaved={handleContactSaved}
        />
      )}
    </aside>
  );
}

function TicketContactModal({
  ticket,
  contact,
  onClose,
  onSaved,
}: {
  ticket: Ticket;
  contact: Contact | null;
  onClose: () => void;
  onSaved: (contact: Contact) => void;
}) {
  const [name, setName] = useState(contact?.name ?? ticket.client.name);
  const [company, setCompany] = useState(
    contact?.company ?? ticket.client.company ?? ''
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { data } = await api.post<{ contact: Contact }>(
        `/contacts/from-ticket/${ticket.id}`,
        { name, company }
      );
      onSaved(data.contact);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={saving ? undefined : onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-contact-title"
        className="w-full max-w-md rounded-2xl border border-chatz-border bg-chatz-surface p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="ticket-contact-title"
          className="text-xl font-bold text-chatz-text"
        >
          {contact ? 'Editar contato' : 'Salvar contato'}
        </h2>
        <p className="mt-1 text-sm text-chatz-text-muted">
          {ticket.client.phone}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-chatz-text">
            Nome do contato
            <input
              autoFocus
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-chatz-border bg-chatz-surface px-3 py-2.5 text-sm text-chatz-text outline-none focus:border-chatz-pink focus:ring-2 focus:ring-chatz-pink/20"
            />
          </label>
          <label className="block text-sm font-medium text-chatz-text">
            Empresa <span className="font-normal text-chatz-text-subtle">(opcional)</span>
            <input
              maxLength={120}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Nome da empresa"
              className="mt-1.5 w-full rounded-xl border border-chatz-border bg-chatz-surface px-3 py-2.5 text-sm text-chatz-text outline-none focus:border-chatz-pink focus:ring-2 focus:ring-chatz-pink/20"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-chatz-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-chatz-border px-4 py-2.5 text-sm font-medium text-chatz-text hover:bg-chatz-surface-hover disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-pink-600 via-pink-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar contato'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-chatz-border">
      <p className="text-[10px] font-semibold text-chatz-text-subtle uppercase tracking-wider mb-3">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-chatz-text-muted shrink-0">{label}</span>
      <span className="text-chatz-text font-medium text-right">{value}</span>
    </div>
  );
}

function statusLabel(s: string) {
  return (
    {
      WAITING: 'Aguardando',
      IN_PROGRESS: 'Em atendimento',
      TRANSFERRED: 'Transferido',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
    }[s] ?? s
  );
}

function priorityLabel(p: string) {
  return (
    {
      LOW: 'Baixa',
      MEDIUM: 'Média',
      HIGH: 'Alta',
      URGENT: 'Urgente',
    }[p] ?? p
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}