import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, getErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { formatPhone, phoneHref } from '../../lib/format';
import { useTicketsStore } from '../../stores/tickets';
import { useAuthStore } from '../../stores/auth';
import { ProfileAvatar } from '../ProfileAvatar';
import { TransferModal } from './TransferModal';
import { AddParticipantModal } from './AddParticipantModal';
import { FollowUpForm } from './FollowUpForm';
import type { Contact, Tag, Ticket } from '../../types';

interface Props {
  onClose: () => void;
}

const TAG_STYLES = [
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
];

function tagStyle(tag: Tag): string {
  let hash = 0;
  for (let i = 0; i < tag.id.length; i++) hash = (hash + tag.id.charCodeAt(i)) % 997;
  return TAG_STYLES[hash % TAG_STYLES.length];
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
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagError, setTagError] = useState('');
  const [tagAction, setTagAction] = useState<string | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

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

  useEffect(() => {
    if (!user || user.role === 'CLIENT') return;
    let active = true;
    api
      .get<Tag[]>('/tags')
      .then(({ data }) => {
        if (active) setAvailableTags(data);
      })
      .catch((error: unknown) => {
        if (active) setTagError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setTagsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  // Recarrega quando muda o participante (via socket)
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    if (!socket) return;

    function handleParticipantChange() {
      console.log('👥 [ChatInfo] Participante mudou, recarregando...');
      loadTicket();
    }

    function handleTagsUpdated(tags: Tag[]) {
      setTicket((current) => (current ? { ...current, tags } : current));
    }

    socket.on('ticket:participant-added', handleParticipantChange);
    socket.on('ticket:participant-removed', handleParticipantChange);
    socket.on('ticket:tags-updated', handleTagsUpdated);

    return () => {
      socket.off('ticket:participant-added', handleParticipantChange);
      socket.off('ticket:participant-removed', handleParticipantChange);
      socket.off('ticket:tags-updated', handleTagsUpdated);
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

  async function toggleTicketTag(tag: Tag) {
    if (!ticket || !id) return;
    const exists = ticket.tags?.some((item) => item.id === tag.id) ?? false;
    setTagAction(`ticket:${tag.id}`);
    setTagError('');
    try {
      const { data } = exists
        ? await api.delete<Tag[]>(`/tickets/${id}/tags/${tag.id}`)
        : await api.post<Tag[]>(`/tickets/${id}/tags`, { tagId: tag.id });
      setTicket((current) => (current ? { ...current, tags: data } : current));
    } catch (error) {
      setTagError(getErrorMessage(error));
    } finally {
      setTagAction(null);
    }
  }

  async function toggleContactTag(tag: Tag) {
    if (!savedContact) return;
    const exists = savedContact.tags?.some((item) => item.id === tag.id) ?? false;
    setTagAction(`contact:${tag.id}`);
    setTagError('');
    try {
      const { data } = exists
        ? await api.delete<Contact>(`/contacts/${savedContact.id}/tags/${tag.id}`)
        : await api.post<Contact>(`/contacts/${savedContact.id}/tags/${tag.id}`);
      setSavedContact(data);
    } catch (error) {
      setTagError(getErrorMessage(error));
    } finally {
      setTagAction(null);
    }
  }

  if (!id || loading) return null;
  if (!ticket) return null;

  const isActive =
    ticket.status === 'WAITING' || ticket.status === 'IN_PROGRESS';
  const canModify =
    isActive &&
    (user?.role === 'ADMIN' || ticket.agentId === user?.id);
  const callHref = phoneHref(ticket.client.phone);
  const ticketTags = ticket.tags ?? [];

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-[min(320px,calc(100vw-68px))] shrink-0 animate-slide-in flex-col border-l border-slate-200/70 bg-[#f4f5fa] shadow-2xl md:relative md:z-0 md:w-[290px] md:shadow-none xl:w-[310px]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <p className="text-sm font-bold text-slate-800">Perfil do contato</p>
        <button
          onClick={onClose}
          aria-label="Fechar detalhes"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 md:pt-5">
        {/* Cartão do contato */}
        <Card>
          <div className="flex items-center gap-3">
            <ProfileAvatar
              name={ticket.client.name}
              pictureUrl={ticket.client.profilePictureUrl}
              sizeClass="h-16 w-16"
              textClass="text-xl"
            />
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-bold leading-tight text-slate-900">
                {ticket.client.name}
              </h3>
              {ticket.client.company && (
                <p className="truncate text-xs font-medium text-slate-500">
                  {ticket.client.company}
                </p>
              )}
              <p className="text-sm text-slate-500">{formatPhone(ticket.client.phone)}</p>
            </div>
          </div>
          <button
            onClick={() => setContactModalOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            {savedContact ? 'Ver perfil completo' : 'Salvar nos contatos'}
            <ExternalIcon />
          </button>
        </Card>

        {/* Etiquetas */}
        {user?.role !== 'CLIENT' && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
                <TagIcon />
                Etiquetas
              </p>
              <button
                type="button"
                onClick={() => setTagPickerOpen((open) => !open)}
                aria-label={tagPickerOpen ? 'Fechar seletor de etiquetas' : 'Adicionar etiqueta'}
                aria-expanded={tagPickerOpen}
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none transition ${
                  tagPickerOpen
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tagPickerOpen ? '×' : '+'}
              </button>
            </div>

            {tagError && (
              <p role="alert" className="mb-2 text-xs text-chatz-danger">
                {tagError}
              </p>
            )}

            {ticketTags.length > 0 ? (
              <div className="flex flex-col items-start gap-2">
                {ticketTags.map((tag) => (
                  <span
                    key={tag.id}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tagStyle(tag)}`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nenhuma etiqueta na conversa.</p>
            )}

            {tagPickerOpen && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-slate-500">
                    Etiquetas da conversa
                  </p>
                  <TagPicker
                    tags={availableTags}
                    selected={ticketTags}
                    loading={tagsLoading}
                    disabled={tagAction !== null}
                    onToggle={toggleTicketTag}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-slate-500">
                    Etiquetas do contato
                  </p>
                  {savedContact ? (
                    <TagPicker
                      tags={availableTags}
                      selected={savedContact.tags ?? []}
                      loading={tagsLoading}
                      disabled={tagAction !== null}
                      onToggle={toggleContactTag}
                    />
                  ) : (
                    <p className="text-xs text-slate-500">
                      Salve o contato para aplicar etiquetas que persistem entre conversas.
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Resumo */}
        <Card>
          <p className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <ChartIcon />
            Resumo do contato
          </p>
          <div className="space-y-2.5">
            <Row label="Protocolo" value={`#${ticket.id.slice(0, 8)}`} />
            <Row label="Setor" value={ticket.sector.name} />
            <Row label="Atendente" value={ticket.agent?.name ?? 'Aguardando'} />
            <Row label="Status" value={statusLabel(ticket.status)} />
            <Row label="Prioridade" value={priorityLabel(ticket.priority)} />
            <Row label="Última conversa" value={formatLastConversation(ticket.updatedAt)} />
          </div>
        </Card>

        {/* Ações rápidas */}
        <Card>
          <p className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <BoltIcon />
            Ações rápidas
          </p>
          <div className="space-y-2.5">
            {callHref && (
              <a href={callHref} className={actionButton}>
                <PhoneIcon />
                Ligar
              </a>
            )}

            {user?.role !== 'CLIENT' && (
              <button
                type="button"
                onClick={() => setFollowUpOpen((open) => !open)}
                aria-expanded={followUpOpen}
                className={`${actionButton} ${followUpOpen ? 'border-violet-300 bg-violet-50 text-violet-700' : ''}`}
              >
                <CalendarIcon />
                Agendar retorno
              </button>
            )}
            {user?.role !== 'CLIENT' && followUpOpen && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <FollowUpForm ticketId={ticket.id} />
              </div>
            )}

            {canModify && (
              <>
                <button onClick={() => setAddOpen(true)} className={actionButton}>
                  <PlusIcon />
                  Adicionar à conversa
                </button>
                <button onClick={() => setTransferOpen(true)} className={actionButton}>
                  <TransferIcon />
                  Transferir
                </button>
              </>
            )}
          </div>
        </Card>

        {ticket.participants && ticket.participants.length > 0 && (
          <Card>
            <p className="mb-3 text-[15px] font-bold text-slate-900">
              Participantes ({ticket.participants.length})
            </p>
            <div className="space-y-2">
              {ticket.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 text-xs text-slate-500"
                >
                  <span>🎧</span>
                  <span className="text-slate-800">{p.user.name}</span>
                  {p.addedBy && (
                    <span className="text-slate-400">(por {p.addedBy.name})</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {ticket.transfers && ticket.transfers.length > 0 && (
          <Card>
            <p className="mb-3 text-[15px] font-bold text-slate-900">Transferências</p>
            <div className="space-y-2">
              {ticket.transfers.map((t) => (
                <div key={t.id} className="text-xs text-slate-500">
                  <p className="text-slate-800">
                    {t.fromUser.name} →{' '}
                    <span className="text-chatz-purple">
                      {t.toUser?.name ?? t.toSector?.name}
                    </span>
                  </p>
                  {t.reason && (
                    <p className="italic text-slate-400">"{t.reason}"</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {(!isActive || canModify) && (
        <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-3">
          {!isActive && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <p className="text-xs text-slate-600">
                {ticket.status === 'RESOLVED' && '✅ Ticket resolvido'}
                {ticket.status === 'CLOSED' && '🔒 Ticket fechado'}
                {ticket.status === 'TRANSFERRED' && '🔄 Ticket transferido'}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">Não é possível modificar</p>
            </div>
          )}

          {canModify && (
            <button
              onClick={handleResolve}
              disabled={actionLoading}
              className="w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {actionLoading ? 'Processando...' : '✓ Marcar como resolvido'}
            </button>
          )}
        </div>
      )}

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

const actionButton =
  'flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50';

function formatLastConversation(value: string): string {
  const date = new Date(value);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `Hoje • ${time}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • ${time}`;
}

function TagPicker({
  tags,
  selected,
  loading,
  disabled,
  onToggle,
}: {
  tags: Tag[];
  selected: Tag[];
  loading: boolean;
  disabled: boolean;
  onToggle: (tag: Tag) => void;
}) {
  if (loading) {
    return <p className="text-xs text-slate-500">Carregando etiquetas...</p>;
  }
  if (tags.length === 0) {
    return <p className="text-xs text-slate-500">Nenhuma etiqueta disponível.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const isSelected = selected.some((item) => item.id === tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onToggle(tag)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
              isSelected
                ? 'border-violet-600 bg-violet-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
            }`}
          >
            {isSelected ? '✓ ' : '+ '}
            {tag.name}
          </button>
        );
      })}
    </div>
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
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

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function CloseIcon() {
  return (
    <svg {...iconProps} width={16} height={16}>
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg {...iconProps} className="text-slate-700">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg {...iconProps} className="text-slate-700">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" rx="0.5" />
      <rect x="12" y="8" width="3" height="10" rx="0.5" />
      <rect x="17" y="5" width="3" height="13" rx="0.5" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg {...iconProps} className="text-slate-700">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg {...iconProps}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 15h3" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function TransferIcon() {
  return (
    <svg {...iconProps}>
      <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}