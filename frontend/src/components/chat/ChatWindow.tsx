import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useMessagesStore } from '../../stores/messages';
import { useTicketsStore } from '../../stores/tickets';
import { api, getErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { Ticket, Message } from '../../types';

interface Props {
  onToggleInfo: () => void;
  infoOpen: boolean;
}

export function ChatWindow({ onToggleInfo, infoOpen }: Props) {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { messages, fetchMessages, sendMessage, addMessage, clear } =
    useMessagesStore();
  const assignTicket = useTicketsStore((s) => s.assignTicket);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega ticket
  function loadTicket() {
    if (!id) return;
    setLoading(true);
    api
      .get<Ticket>(`/tickets/${id}`)
      .then(({ data }) => setTicket(data))
      .catch(() => setTicket(null))
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

    function handleNew(msg: Message) {
      if (msg.ticketId === id) addMessage(msg);
    }

    function handleUpdated(updated: Ticket) {
      if (updated.id === id) setTicket((prev) => (prev ? { ...prev, ...updated } : updated));
    }

    socket.on('message:new', handleNew);
    socket.on('ticket:updated', handleUpdated);

    return () => {
      socket.emit('ticket:leave', id);
      socket.off('message:new', handleNew);
      socket.off('ticket:updated', handleUpdated);
    };
  }, [id, addMessage]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Foca no input
  useEffect(() => {
    if (id) inputRef.current?.focus();
  }, [id]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !id) return;

    setSending(true);
    const content = input.trim();
    setInput('');

    try {
      await sendMessage(id, content);
    } catch (err) {
      alert(getErrorMessage(err));
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  async function handleAssign() {
    if (!id) return;
    setAssigning(true);
    try {
      await assignTicket(id);
      loadTicket();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setAssigning(false);
    }
  }

  if (!id) {
    return <EmptyState />;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chatz-bg">
        <p className="text-chatz-text-muted text-sm">Carregando...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chatz-bg">
        <p className="text-chatz-text-muted text-sm">Ticket não encontrado</p>
      </div>
    );
  }

  const isMine = user?.role === 'ADMIN' || ticket.agentId === user?.id;
  const canAssign = !ticket.agentId && (user?.role === 'AGENT' || user?.role === 'ADMIN');
  const canSend = isMine;

  const initials = ticket.client.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex-1 flex flex-col bg-chatz-bg min-w-0">

      {/* Header */}
      <header className="h-16 px-4 bg-chatz-surface border-b border-chatz-border
                         flex items-center justify-between shrink-0 gap-3">
        <button
          onClick={onToggleInfo}
          className="flex items-center gap-3 hover:bg-chatz-surface-hover rounded-chatz px-2 py-1 transition-all min-w-0"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-chatz-purple to-chatz-pink
                          flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {initials}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-chatz-text truncate">
              {ticket.client.name}
            </p>
            <p className="text-xs text-chatz-text-muted truncate">
              {ticket.client.phone} · #{ticket.id.slice(0, 8)}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* Botão Assumir */}
          {canAssign && (
            <button
              onClick={handleAssign}
              disabled={assigning}
              className="px-4 py-2 rounded-chatz bg-chatz-button-gradient text-white
                         text-sm font-semibold shadow-[0_4px_14px_rgba(236,72,153,0.35)]
                         hover:brightness-105 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigning ? 'Assumindo...' : '🎧 Assumir'}
            </button>
          )}

          {/* Botão Info */}
          <button
            onClick={onToggleInfo}
            title="Info do cliente"
            className={`w-9 h-9 rounded-chatz flex items-center justify-center transition-all ${
              infoOpen
                ? 'bg-chatz-primary text-white'
                : 'text-chatz-text-muted hover:bg-chatz-surface-hover'
            }`}
          >
            <InfoIcon />
          </button>
        </div>
      </header>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-chatz-text-muted text-sm">
            Nenhuma mensagem ainda. Comece a conversa.
          </div>
        )}

        <div className="space-y-1">
          {messages.map((msg, idx) => {
            const prev = messages[idx - 1];
            const isMineMsg = msg.senderId === user?.id;
            const showName = !prev || prev.senderId !== msg.senderId;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMine={isMineMsg}
                showName={showName}
              />
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <footer className="border-t border-chatz-border bg-chatz-surface p-3 shrink-0">
        {canSend ? (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button"
              title="Anexar (em breve)"
              className="w-10 h-10 rounded-chatz flex items-center justify-center
                         text-chatz-text-muted hover:bg-chatz-surface-hover transition-all"
              onClick={() => alert('Em breve: anexar arquivos')}
            >
              <PaperclipIcon />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={sending}
              className="flex-1 px-4 py-2.5 bg-chatz-surface-alt border border-chatz-border rounded-full
                         text-sm text-chatz-text placeholder:text-chatz-text-subtle
                         focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20 transition-all"
            />

            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="w-11 h-11 rounded-full bg-chatz-button-gradient text-white
                         flex items-center justify-center shrink-0
                         shadow-[0_4px_14px_rgba(236,72,153,0.35)]
                         hover:brightness-105 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <SendIcon />
              )}
            </button>
          </form>
        ) : (
          <p className="text-center text-chatz-text-muted text-sm py-2">
            {ticket.agentId
              ? `Atendimento sendo feito por ${ticket.agent?.name ?? 'outro atendente'}`
              : 'Clique em "Assumir" para responder este atendimento'}
          </p>
        )}
      </footer>
    </div>
  );
}

// ==========================
// BOLHA DE MENSAGEM
// ==========================
function MessageBubble({
  message,
  isMine,
  showName,
}: {
  message: Message;
  isMine: boolean;
  showName: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[70%] px-3.5 py-2 rounded-2xl ${
          isMine
            ? 'bg-chatz-button-gradient text-white rounded-br-sm shadow-[0_2px_8px_rgba(236,72,153,0.20)]'
            : 'bg-chatz-surface border border-chatz-border text-chatz-text rounded-bl-sm'
        }`}
      >
        {showName && !isMine && (
          <p className="text-xs font-semibold mb-0.5 text-chatz-purple">
            {message.sender.name}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
        <p
          className={`text-[10px] mt-1 text-right ${
            isMine ? 'text-white/70' : 'text-chatz-text-subtle'
          }`}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

// ==========================
// ESTADO VAZIO
// ==========================
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-chatz-bg text-center px-8">
      <div className="w-24 h-24 rounded-full bg-chatz-gradient-soft flex items-center justify-center mb-6">
        <ChatBigIcon />
      </div>
      <h2 className="text-xl font-display font-bold text-chatz-text mb-2">
        Bem-vindo ao chatZ
      </h2>
      <p className="text-sm text-chatz-text-muted max-w-sm">
        Selecione uma conversa à esquerda para começar a atender.
        Ou aguarde novos atendimentos chegarem em tempo real.
      </p>
    </div>
  );
}

// ==========================
// ÍCONES
// ==========================
function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function ChatBigIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}