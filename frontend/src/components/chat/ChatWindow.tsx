import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useMessagesStore } from '../../stores/messages';
import { useTicketsStore } from '../../stores/tickets';
import { api, getErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { AttachmentPreview, type Attachment } from './AttachmentPreview';
import { SimpleEmojiPicker } from './EmojiPicker';
import type { Ticket, Message } from '../../types';

interface Props {
  onToggleInfo: () => void;
  infoOpen: boolean;
}

interface PendingFile {
  id: string;
  file: File;
  preview: Attachment | null;
  uploading: boolean;
  error?: string;
}

interface TypingUser {
  userId: string;
  userName: string;
  userRole: string;
}

export function ChatWindow({ onToggleInfo, infoOpen }: Props) {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { messages, fetchMessages, addMessage, clear } = useMessagesStore();
  const assignTicket = useTicketsStore((s) => s.assignTicket);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());

  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!id) return;
    fetchMessages(id);
    return () => clear();
  }, [id, fetchMessages, clear]);

  // ==========================
  // SOCKET.IO — TEMPO REAL
  // ==========================
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    if (!socket) return;
    const activeSocket = socket;

    // 🔥 FORÇA JOIN IMEDIATAMENTE
    function join() {
      console.log('📌 [ChatWindow] Entrando na sala ticket:', id);
      activeSocket.emit('ticket:join', id);
    }

    // Sempre chama, independente de estar conectado ou não
    join();

    // E re-join se reconectar
    activeSocket.on('connect', join);

    function handleNew(msg: Message) {
      console.log('📩 [ChatWindow] message:new recebida:', msg);
      if (msg.ticketId !== id) return;
      addMessage(msg);
    }

    function handleUpdated(updated: Ticket) {
      if (updated.id === id)
        setTicket((prev) => (prev ? { ...prev, ...updated } : updated));
    }

    function handleTypingUpdate(data: {
      ticketId: string;
      userId: string;
      userName: string;
      userRole: string;
      typing: boolean;
    }) {
      if (data.ticketId !== id) return;
      if (data.userId === user?.id) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.typing) {
          next.set(data.userId, {
            userId: data.userId,
            userName: data.userName,
            userRole: data.userRole,
          });
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    }

    activeSocket.on('message:new', handleNew);
    activeSocket.on('ticket:updated', handleUpdated);
    activeSocket.on('typing:update', handleTypingUpdate);

    return () => {
      console.log('📌 [ChatWindow] Saindo da sala ticket:', id);
      activeSocket.emit('ticket:leave', id);
      activeSocket.off('connect', join);
      activeSocket.off('message:new', handleNew);
      activeSocket.off('ticket:updated', handleUpdated);
      activeSocket.off('typing:update', handleTypingUpdate);
      if (isTypingRef.current) {
        activeSocket.emit('typing:stop', { ticketId: id });
      }
    };
  }, [id, addMessage, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingFiles, typingUsers]);

  useEffect(() => {
    if (id) inputRef.current?.focus();
  }, [id]);

  // Fecha emoji picker
  useEffect(() => {
    if (!emojiOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(target)
      ) {
        setEmojiOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [emojiOpen]);

  // Typing
  function handleInputChange(value: string) {
    setInput(value);

    const socket = getSocket();
    if (!socket || !id) return;

    if (value.trim() && !isTypingRef.current) {
      socket.emit('typing:start', { ticketId: id });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!value.trim()) {
      if (isTypingRef.current) {
        socket.emit('typing:stop', { ticketId: id });
        isTypingRef.current = false;
      }
      return;
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        socket.emit('typing:stop', { ticketId: id });
        isTypingRef.current = false;
      }
    }, 3000);
  }

  // Emoji
  function handleEmojiClick(emoji: string) {
    const inputEl = inputRef.current;

    if (inputEl) {
      const start = inputEl.selectionStart ?? input.length;
      const end = inputEl.selectionEnd ?? input.length;
      const newValue = input.slice(0, start) + emoji + input.slice(end);
      setInput(newValue);

      requestAnimationFrame(() => {
        inputEl.focus();
        inputEl.setSelectionRange(start + emoji.length, start + emoji.length);
      });

      handleInputChange(newValue);
    } else {
      setInput((prev) => prev + emoji);
    }
  }

  // Arquivos
  function addFiles(files: File[]) {
    const validFiles = files.filter((f) => f.size > 0);
    if (validFiles.length === 0) return;

    const newPending: PendingFile[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: null,
      uploading: true,
    }));

    setPendingFiles((prev) => [...prev, ...newPending]);

    newPending.forEach((pending) => {
      const formData = new FormData();
      formData.append('file', pending.file);

      api
        .post<Attachment>('/uploads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(({ data }) => {
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.id === pending.id ? { ...p, preview: data, uploading: false } : p
            )
          );
        })
        .catch((err) => {
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.id === pending.id
                ? { ...p, uploading: false, error: getErrorMessage(err) }
                : p
            )
          );
        });
    });
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePendingFile(id: string) {
    setPendingFiles((prev) => prev.filter((p) => p.id !== id));
  }

  function clearAllPending() {
    setPendingFiles([]);
  }

  // Drag
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) addFiles(files);
  }

  // Enviar
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const hasUploading = pendingFiles.some((p) => p.uploading);
    if (hasUploading) {
      alert('Aguarde todos os uploads terminarem...');
      return;
    }
    const failedFiles = pendingFiles.filter((p) => p.error);
    if (failedFiles.length > 0) {
      alert('Remova os arquivos com erro antes de enviar.');
      return;
    }

    const readyFiles = pendingFiles.filter((p) => p.preview);
    const content = input.trim();
    if (!content && readyFiles.length === 0) return;

    setSending(true);
    setInput('');
    setPendingFiles([]);
    setEmojiOpen(false);

    const socket = getSocket();
    if (socket && isTypingRef.current) {
      socket.emit('typing:stop', { ticketId: id });
      isTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      if (readyFiles.length > 0) {
        for (let i = 0; i < readyFiles.length; i++) {
          const file = readyFiles[i];
          const msgContent = i === 0 ? content : '';
          await api.post(`/tickets/${id}/messages`, {
            content: msgContent,
            attachment: file.preview,
          });
        }
      } else if (content) {
        await api.post(`/tickets/${id}/messages`, { content });
      }
    } catch (err) {
      alert(getErrorMessage(err));
      if (content) setInput(content);
      setPendingFiles(readyFiles);
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

  if (!id) return <EmptyState />;
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
  const isParticipant = ticket.participants?.some(
    (participant) => participant.userId === user?.id
  ) ?? false;
  const canAssign =
    !ticket.agentId && (user?.role === 'AGENT' || user?.role === 'ADMIN');
  const canSend = isMine || isParticipant;

  const initials = ticket.client.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hasText = input.trim().length > 0;
  const hasUploading = pendingFiles.some((p) => p.uploading);
  const canSubmit =
    !sending && !hasUploading && (hasText || pendingFiles.some((p) => p.preview));

  const typingNames = Array.from(typingUsers.values()).map((t) => t.userName);
  const typingText =
    typingNames.length === 0
      ? null
      : typingNames.length === 1
      ? `${typingNames[0]} está digitando...`
      : `${typingNames.slice(0, 2).join(', ')} estão digitando...`;

  return (
    <div
      className="flex-1 flex flex-col bg-chatz-bg min-w-0 relative"
      onDragOver={canSend ? handleDragOver : undefined}
      onDragLeave={canSend ? handleDragLeave : undefined}
      onDrop={canSend ? handleDrop : undefined}
    >
      {dragging && canSend && (
        <div className="absolute inset-0 z-40 bg-chatz-primary/10 border-4 border-dashed border-chatz-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-chatz-surface px-6 py-4 rounded-xl shadow-lg">
            <p className="text-chatz-primary font-semibold">Solte os arquivos aqui 🎯</p>
          </div>
        </div>
      )}

      <header className="h-16 px-4 bg-chatz-surface border-b border-chatz-border flex items-center justify-between shrink-0 gap-3">
        <button
          onClick={onToggleInfo}
          className="flex items-center gap-3 hover:bg-chatz-surface-hover rounded-chatz px-2 py-1 transition-all min-w-0"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-chatz-purple to-chatz-pink flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {initials}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-chatz-text truncate">
              {ticket.client.name}
            </p>
            <p className="text-xs text-chatz-text-muted truncate">
              {typingText ? (
                <span className="text-chatz-primary italic">{typingText}</span>
              ) : (
                `${ticket.client.phone} · #${ticket.id.slice(0, 8)}`
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {canAssign && (
            <button
              onClick={handleAssign}
              disabled={assigning}
              className="px-4 py-2 rounded-chatz bg-chatz-button-gradient text-white text-sm font-semibold shadow-[0_4px_14px_rgba(236,72,153,0.35)] hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigning ? 'Assumindo...' : '🎧 Assumir'}
            </button>
          )}
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

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-chatz-text-muted text-sm">
            Nenhuma mensagem ainda. Comece a conversa.
          </div>
        )}
        <div className="space-y-2">
          {messages.map((msg) => {
            const isAgentMessage = msg.sender.role !== 'CLIENT';
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isAgent={isAgentMessage}
              />
            );
          })}
        </div>

        {typingText && (
          <div className="flex items-center gap-2 mt-3 animate-fade-in">
            <div className="bg-chatz-surface border border-chatz-border rounded-2xl rounded-bl-sm px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-chatz-text-muted">{typingText}</span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-chatz-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-chatz-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-chatz-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <footer className="border-t border-chatz-border bg-chatz-surface shrink-0">
        {canSend ? (
          <>
            {pendingFiles.length > 0 && (
              <div className="px-3 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-chatz-text-muted font-medium">
                    {pendingFiles.length} arquivo{pendingFiles.length > 1 ? 's' : ''} anexado{pendingFiles.length > 1 ? 's' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={clearAllPending}
                    className="text-xs text-chatz-danger hover:underline"
                  >
                    Remover todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingFiles.map((pending) => (
                    <div
                      key={pending.id}
                      className="relative bg-chatz-surface-alt rounded-chatz border border-chatz-border p-2 flex items-center gap-2 max-w-[220px]"
                    >
                      <div className="w-10 h-10 rounded bg-chatz-primary-light flex items-center justify-center shrink-0 overflow-hidden">
                        {pending.preview?.type === 'image' ? (
                          <img
                            src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${pending.preview.url}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FilePendingIcon />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-chatz-text truncate">
                          {pending.file.name}
                        </p>
                        <p className="text-[10px] text-chatz-text-muted">
                          {pending.uploading ? (
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-2 h-2 border border-chatz-primary border-t-transparent rounded-full animate-spin" />
                              Enviando...
                            </span>
                          ) : pending.error ? (
                            <span className="text-chatz-danger">Erro</span>
                          ) : (
                            formatSize(pending.file.size)
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingFile(pending.id)}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-chatz-text-muted hover:bg-chatz-danger-light hover:text-chatz-danger transition-all shrink-0"
                      >
                        <CloseSmallIcon />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSend} className="p-3 flex items-center gap-2 relative">
              {emojiOpen && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full left-12 mb-2 z-50"
                >
                  <SimpleEmojiPicker
                    onEmojiClick={handleEmojiClick}
                    onClose={() => setEmojiOpen(false)}
                  />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />

              <button
                type="button"
                title="Anexar arquivos"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-chatz flex items-center justify-center text-chatz-text-muted hover:bg-chatz-surface-hover transition-all"
              >
                <PaperclipIcon />
              </button>

              <button
                type="button"
                ref={emojiButtonRef}
                title="Emoji"
                onClick={() => setEmojiOpen((v) => !v)}
                className={`w-10 h-10 rounded-chatz flex items-center justify-center transition-all ${
                  emojiOpen
                    ? 'bg-chatz-primary-light text-chatz-primary'
                    : 'text-chatz-text-muted hover:bg-chatz-surface-hover'
                }`}
              >
                <EmojiIcon />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={
                  pendingFiles.length > 0
                    ? 'Legenda (opcional, vai no primeiro arquivo)'
                    : 'Digite sua mensagem...'
                }
                disabled={sending}
                className="flex-1 px-4 py-2.5 bg-chatz-surface-alt border border-chatz-border rounded-full text-sm text-chatz-text placeholder:text-chatz-text-subtle focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20 transition-all"
              />

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-11 h-11 rounded-full bg-chatz-button-gradient text-white flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(236,72,153,0.35)] hover:brightness-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <SendIcon />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="p-3">
            <p className="text-center text-chatz-text-muted text-sm py-2">
              {ticket.agentId
                ? `Atendimento sendo feito por ${ticket.agent?.name ?? 'outro atendente'}`
                : 'Clique em "Assumir" para responder este atendimento'}
            </p>
          </div>
        )}
      </footer>
    </div>
  );
}

function MessageBubble({ message, isAgent }: { message: Message; isAgent: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const attachment = (message as any).attachment as Attachment | null;
  const hasContent = message.content?.trim().length > 0;

  return (
    <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`max-w-[70%] rounded-2xl ${isAgent ? 'bg-chatz-button-gradient text-white rounded-br-sm shadow-[0_2px_8px_rgba(236,72,153,0.20)]' : 'bg-chatz-surface border border-chatz-border text-chatz-text rounded-bl-sm'} ${attachment && !hasContent ? 'p-2' : 'px-3.5 py-2'}`}>
        <p
          className={`text-xs font-semibold mb-0.5 px-1.5 pt-0.5 ${
            isAgent ? 'text-white/80' : 'text-chatz-purple'
          }`}
        >
          {message.sender.name}
        </p>
        {attachment && (
          <div className={hasContent ? 'mb-2' : ''}>
            <AttachmentPreview attachment={attachment} isMine={isAgent} />
          </div>
        )}
        {hasContent && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        )}
        <p className={`text-[10px] mt-1 text-right px-1 ${isAgent ? 'text-white/70' : 'text-chatz-text-subtle'}`}>{time}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-chatz-bg text-center px-8">
      <div className="w-24 h-24 rounded-full bg-chatz-gradient-soft flex items-center justify-center mb-6">
        <ChatBigIcon />
      </div>
      <h2 className="text-xl font-display font-bold text-chatz-text mb-2">Bem-vindo ao chatZ</h2>
      <p className="text-sm text-chatz-text-muted max-w-sm">Selecione uma conversa à esquerda para começar a atender.</p>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function InfoIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>);
}
function SendIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>);
}
function PaperclipIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>);
}
function EmojiIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" /></svg>);
}
function CloseSmallIcon() {
  return (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>);
}
function FilePendingIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-chatz-primary"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>);
}
function ChatBigIcon() {
  return (<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
}