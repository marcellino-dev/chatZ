import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useMessagesStore } from '../stores/messages';
import { api, getErrorMessage } from '../lib/api';
import { getSocket } from '../lib/socket';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { TransferModal } from '../components/TransferModal';
import type { Ticket, Message, Transfer } from '../types';

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { messages, fetchMessages, sendMessage, addMessage, clear } =
    useMessagesStore();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega ticket + transfers
  function loadTicket() {
    if (!id) return;
    setLoading(true);
    api
      .get<Ticket>(`/tickets/${id}`)
      .then(({ data }) => {
        setTicket(data);
        setTransfers(data.transfers || []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTicket();
  }, [id]);

  // Carrega mensagens
  useEffect(() => {
    if (!id) return;
    fetchMessages(id);
    return () => clear();
  }, [id, fetchMessages, clear]);

  // Socket.IO
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('ticket:join', id);

    function handleNewMessage(msg: Message) {
      if (msg.ticketId === id) addMessage(msg);
    }

    function handleTicketUpdated(updated: Ticket) {
      if (updated.id === id) {
        setTicket((prev) => (prev ? { ...prev, ...updated } : updated));
      }
    }

    socket.on('message:new', handleNewMessage);
    socket.on('ticket:updated', handleTicketUpdated);

    return () => {
      socket.emit('ticket:leave', id);
      socket.off('message:new', handleNewMessage);
      socket.off('ticket:updated', handleTicketUpdated);
    };
  }, [id, addMessage]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !id) return;

    setSending(true);
    try {
      await sendMessage(id, input.trim());
      setInput('');
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <p className="text-chatz-muted">Carregando...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-chatz-danger/10 border border-chatz-danger/30 text-chatz-danger
                        rounded-lg px-4 py-3">
          {error || 'Ticket não encontrado'}
        </div>
      </div>
    );
  }

  const canSend =
    user?.role === 'ADMIN' ||
    (user?.role === 'AGENT' && ticket.agentId === user.id);

  const canTransfer =
    ticket.status !== 'RESOLVED' &&
    ticket.status !== 'CLOSED' &&
    (user?.role === 'ADMIN' || ticket.agentId === user?.id);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/tickets"
          className="text-chatz-muted hover:text-chatz-text text-sm inline-flex items-center gap-1"
        >
          ← Voltar
        </Link>

        {canTransfer && (
          <button
            onClick={() => setTransferModalOpen(true)}
            className="px-4 py-2 bg-chatz-warning/10 hover:bg-chatz-warning/20
                       border border-chatz-warning/30 text-chatz-warning
                       text-sm font-medium rounded-lg transition-all"
          >
            🔄 Transferir
          </button>
        )}
      </div>

      {/* Header do ticket */}
      <div className="bg-chatz-card border border-chatz-border rounded-t-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-chatz-text truncate">
              {ticket.subject}
            </h1>
            <p className="text-chatz-muted text-xs mt-1">
              #{ticket.id.slice(0, 8)} · {new Date(ticket.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <PriorityBadge priority={ticket.priority} />
          <span className="text-chatz-muted">🏢 {ticket.sector.name}</span>
          <span className="text-chatz-muted">👤 {ticket.client.name}</span>
          {ticket.agent && (
            <span className="text-chatz-muted">🎧 {ticket.agent.name}</span>
          )}
        </div>

        {/* Histórico de transferências */}
        {transfers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-chatz-border">
            <p className="text-xs text-chatz-muted mb-2 font-medium">
              🔄 Histórico de transferências
            </p>
            <div className="space-y-1">
              {transfers.slice(0, 3).map((t) => (
                <div key={t.id} className="text-xs text-chatz-muted">
                  <span className="text-chatz-text">{t.fromUser.name}</span>
                  {' → '}
                  <span className="text-chatz-primary">
                    {t.toUser ? t.toUser.name : t.toSector?.name}
                  </span>
                  {t.reason && (
                    <span className="italic"> — "{t.reason}"</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div className="bg-chatz-bg border-x border-chatz-border h-[500px] overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-chatz-muted text-sm">
            Nenhuma mensagem ainda. Comece a conversa.
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} currentUserId={user?.id} />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-chatz-card border border-chatz-border rounded-b-2xl p-4">
        {canSend ? (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={sending}
              className="flex-1 px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text placeholder-chatz-muted
                         focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20
                         transition-all"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-6 py-3 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white font-semibold rounded-lg transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '...' : 'Enviar'}
            </button>
          </form>
        ) : (
          <p className="text-chatz-muted text-sm text-center py-2">
            {ticket.agentId
              ? `Atendimento sendo feito por ${ticket.agent?.name}`
              : 'Assuma o ticket para responder'}
          </p>
        )}
      </div>

      {/* Modal de transferência */}
      <TransferModal
        isOpen={transferModalOpen}
        ticketId={ticket.id}
        currentSectorId={ticket.sectorId}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={() => {
          loadTicket();
        }}
      />
    </div>
  );
}

function MessageBubble({
  message,
  currentUserId,
}: {
  message: Message;
  currentUserId?: string;
}) {
  const isMine = message.senderId === currentUserId;
  const isClient = message.sender.role === 'CLIENT';

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isMine
            ? 'bg-chatz-primary text-white'
            : isClient
            ? 'bg-chatz-card border border-chatz-border text-chatz-text'
            : 'bg-chatz-card-hover border border-chatz-border text-chatz-text'
        }`}
      >
        <p className="text-xs font-medium mb-1 opacity-75">
          {message.sender.name}
        </p>
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={`text-[10px] mt-1 ${
            isMine ? 'text-white/70' : 'text-chatz-muted'
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}