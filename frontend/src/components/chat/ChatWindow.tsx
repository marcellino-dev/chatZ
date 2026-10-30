import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useMessagesStore } from '../../stores/messages';
import { useTicketsStore } from '../../stores/tickets';
import { api, getErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { AttachmentPreview, type Attachment } from './AttachmentPreview';
import { SimpleEmojiPicker } from './EmojiPicker';
import { ProfileAvatar } from '../ProfileAvatar';
import type { Ticket, Message, QuickReply, TicketNote } from '../../types';

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

interface Sticker {
  id: string;
  name: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  sourceMessageId?: string | null;
}

interface TicketNotesState {
  ticketId: string | null;
  notes: TicketNote[];
  error: string;
}

export function ChatWindow({ onToggleInfo, infoOpen }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { messages, fetchMessages, addMessage, clear } = useMessagesStore();
  const assignTicket = useTicketsStore((s) => s.assignTicket);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketNotes, setTicketNotes] = useState<TicketNotesState>({
    ticketId: null,
    notes: [],
    error: '',
  });
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [quickReplyError, setQuickReplyError] = useState('');
  const [quickRepliesLoading, setQuickRepliesLoading] = useState(true);
  const [activeQuickReply, setActiveQuickReply] = useState(0);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [stickersLoading, setStickersLoading] = useState(true);
  const [stickerUploading, setStickerUploading] = useState(false);
  const [stickerError, setStickerError] = useState('');
  const [stickerName, setStickerName] = useState('');
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [favoriteMenuMessageId, setFavoriteMenuMessageId] = useState<string | null>(null);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);

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
    if (!user || user.role === 'CLIENT') return;
    let active = true;
    api
      .get<QuickReply[]>('/quick-replies')
      .then(({ data }) => {
        if (active) {
          setQuickReplies(data);
          setQuickReplyError('');
        }
      })
      .catch((error: unknown) => {
        if (active) setQuickReplyError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setQuickRepliesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role === 'CLIENT') {
      setStickersLoading(false);
      return;
    }

    let active = true;
    api
      .get<Sticker[]>('/stickers')
      .then(({ data }) => {
        if (active) {
          setStickers(data);
          setStickerError('');
        }
      })
      .catch((error: unknown) => {
        if (active) setStickerError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setStickersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!id) return;
    fetchMessages(id);
    return () => clear();
  }, [id, fetchMessages, clear]);

  useEffect(() => {
    if (!id || !user || user.role === 'CLIENT') return;

    let active = true;
    api
      .get<TicketNote[]>(`/tickets/${id}/notes`)
      .then(({ data }) => {
        if (active) setTicketNotes({ ticketId: id, notes: data, error: '' });
      })
      .catch((error: unknown) => {
        if (active) {
          setTicketNotes({
            ticketId: id,
            notes: [],
            error: getErrorMessage(error),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [id, user]);

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

    function handleAccessRevoked(data: { ticketId: string }) {
      if (data.ticketId !== id) return;
      clear();
      setTicket(null);
      navigate('/chat', { replace: true });
    }

    function handleNoteCreated(note: TicketNote) {
      if (note.ticketId !== id) return;
      setTicketNotes((current) => {
        const currentNotes = current.ticketId === id ? current.notes : [];
        return {
          ticketId: id,
          error: '',
          notes: currentNotes.some((item) => item.id === note.id)
            ? currentNotes
            : [...currentNotes, note].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              ),
        };
      });
    }

    function handleNoteUpdated(note: TicketNote) {
      if (note.ticketId !== id) return;
      setTicketNotes((current) => ({
        ticketId: id,
        error: '',
        notes: (current.ticketId === id ? current.notes : []).map((item) =>
          item.id === note.id ? note : item
        ),
      }));
    }

    function handleNoteDeleted(data: { ticketId: string; noteId: string }) {
      if (data.ticketId !== id) return;
      setTicketNotes((current) => ({
        ticketId: id,
        error: '',
        notes: (current.ticketId === id ? current.notes : []).filter(
          (note) => note.id !== data.noteId
        ),
      }));
    }

    activeSocket.on('message:new', handleNew);
    activeSocket.on('ticket:updated', handleUpdated);
    activeSocket.on('typing:update', handleTypingUpdate);
    activeSocket.on('ticket:note-created', handleNoteCreated);
    activeSocket.on('ticket:note-updated', handleNoteUpdated);
    activeSocket.on('ticket:note-deleted', handleNoteDeleted);
    activeSocket.on('ticket:join-error', handleAccessRevoked);
    activeSocket.on('ticket:access-revoked', handleAccessRevoked);

    return () => {
      console.log('📌 [ChatWindow] Saindo da sala ticket:', id);
      activeSocket.emit('ticket:leave', id);
      activeSocket.off('connect', join);
      activeSocket.off('message:new', handleNew);
      activeSocket.off('ticket:updated', handleUpdated);
      activeSocket.off('typing:update', handleTypingUpdate);
      activeSocket.off('ticket:note-created', handleNoteCreated);
      activeSocket.off('ticket:note-updated', handleNoteUpdated);
      activeSocket.off('ticket:note-deleted', handleNoteDeleted);
      activeSocket.off('ticket:join-error', handleAccessRevoked);
      activeSocket.off('ticket:access-revoked', handleAccessRevoked);
      if (isTypingRef.current) {
        activeSocket.emit('typing:stop', { ticketId: id });
      }
    };
  }, [id, addMessage, clear, navigate, user?.id]);

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
    setActiveQuickReply(0);

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

  const slashMatch = /(^|\s)\/([^\s]*)$/.exec(input);
  const slashQuery = slashMatch?.[2].toLocaleLowerCase() ?? '';
  const quickReplyStart = slashMatch
    ? input.length - slashMatch[0].length + slashMatch[1].length
    : -1;
  const matchingQuickReplies = slashMatch
    ? quickReplies.filter((reply) =>
        `${reply.title} ${reply.content}`.toLocaleLowerCase().includes(slashQuery)
      )
    : [];
  const showQuickReplies = slashMatch !== null;

  function chooseQuickReply(reply: QuickReply) {
    const start = quickReplyStart;
    if (start < 0) return;
    const nextInput = `${input.slice(0, start)}${reply.content}`;
    setInput(nextInput);
    setActiveQuickReply(0);
    const socket = getSocket();
    if (socket && id && !isTypingRef.current) {
      socket.emit('typing:start', { ticketId: id });
      isTypingRef.current = true;
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextInput.length, nextInput.length);
    });
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showQuickReplies || matchingQuickReplies.length === 0) {
      if (event.key === 'Escape') setActiveQuickReply(0);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveQuickReply((index) => (index + 1) % matchingQuickReplies.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveQuickReply(
        (index) => (index - 1 + matchingQuickReplies.length) % matchingQuickReplies.length
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      chooseQuickReply(matchingQuickReplies[activeQuickReply]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      const currentMatch = /(^|\s)\/([^\s]*)$/.exec(input);
      if (currentMatch) {
        const start = input.length - currentMatch[0].length + currentMatch[1].length;
        setInput(input.slice(0, start));
      }
      setActiveQuickReply(0);
    }
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

  async function handleStickerInputChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const name =
      stickerName.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 60);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    setStickerUploading(true);
    setStickerError('');

    try {
      const { data } = await api.post<Sticker>('/stickers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStickers((current) => [data, ...current]);
      setStickerName('');
    } catch (error) {
      setStickerError(getErrorMessage(error));
    } finally {
      setStickerUploading(false);
    }
  }

  async function sendSticker(sticker: Sticker) {
    if (!id || sending) return;

    setSending(true);
    try {
      const { data } = await api.post<Message & { deliveryWarning?: string }>(
        `/tickets/${id}/messages`,
        {
          content: '',
          attachment: {
            url: sticker.url,
            filename: sticker.filename,
            originalName: sticker.name,
            mimetype: sticker.mimetype,
            size: sticker.size,
            type: 'image',
            sticker: true,
          },
        }
      );
      if (data.deliveryWarning) alert(data.deliveryWarning);
      setStickerPickerOpen(false);
    } catch (error) {
      alert(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function deleteSticker(sticker: Sticker) {
    if (!window.confirm(`Excluir a figurinha "${sticker.name}"?`)) return;

    try {
      await api.delete(`/stickers/${sticker.id}`);
      setStickers((current) => current.filter((item) => item.id !== sticker.id));
    } catch (error) {
      setStickerError(getErrorMessage(error));
    }
  }

  async function toggleIncomingStickerFavorite(message: Message) {
    const savedSticker = stickers.find(
      (sticker) => sticker.sourceMessageId === message.id
    );
    if (savedSticker) {
      try {
        await api.delete(`/stickers/${savedSticker.id}`);
        setStickers((current) =>
          current.filter((sticker) => sticker.id !== savedSticker.id)
        );
      } catch (error) {
        alert(getErrorMessage(error));
      }
      return;
    }

    const suggestedName =
      message.attachment?.originalName.replace(/\.[^.]+$/, '') ||
      'Figurinha do cliente';
    const name = window.prompt('Nome para salvar a figurinha', suggestedName);
    if (!name?.trim()) return;

    try {
      const { data } = await api.post<Sticker>('/stickers/from-message', {
        messageId: message.id,
        name: name.trim(),
      });
      setStickers((current) =>
        current.some((sticker) => sticker.id === data.id)
          ? current
          : [data, ...current]
      );
    } catch (error) {
      alert(getErrorMessage(error));
    }
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
          const { data } = await api.post<Message & { deliveryWarning?: string }>(
            `/tickets/${id}/messages`,
            {
              content: msgContent,
              attachment: file.preview,
            }
          );
          if (data.deliveryWarning) alert(data.deliveryWarning);
        }
      } else if (content) {
        const { data } = await api.post<Message & { deliveryWarning?: string }>(
          `/tickets/${id}/messages`,
          { content }
        );
        if (data.deliveryWarning) alert(data.deliveryWarning);
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

  async function handleCreateNote(event: FormEvent) {
    event.preventDefault();
    if (!id || !noteDraft.trim() || noteSaving) return;

    setNoteSaving(true);
    try {
      const { data } = await api.post<TicketNote>(`/tickets/${id}/notes`, {
        content: noteDraft,
      });
      setTicketNotes((current) => {
        const currentNotes = current.ticketId === id ? current.notes : [];
        return {
          ticketId: id,
          error: '',
          notes: currentNotes.some((note) => note.id === data.id)
            ? currentNotes
            : [...currentNotes, data].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              ),
        };
      });
      setNoteDraft('');
    } catch (error) {
      setTicketNotes((current) => ({
        ticketId: id,
        notes: current.ticketId === id ? current.notes : [],
        error: getErrorMessage(error),
      }));
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleUpdateNote(noteId: string, content: string) {
    if (!id) return;
    const { data } = await api.patch<TicketNote>(
      `/tickets/${id}/notes/${noteId}`,
      { content }
    );
    setTicketNotes((current) => ({
      ticketId: id,
      error: '',
      notes: (current.ticketId === id ? current.notes : []).map((note) =>
        note.id === data.id ? data : note
      ),
    }));
  }

  async function handleDeleteNote(noteId: string) {
    if (!id || !window.confirm('Excluir esta nota interna?')) return;
    try {
      await api.delete(`/tickets/${id}/notes/${noteId}`);
      setTicketNotes((current) => ({
        ticketId: id,
        error: '',
        notes: (current.ticketId === id ? current.notes : []).filter(
          (note) => note.id !== noteId
        ),
      }));
    } catch (error) {
      setTicketNotes((current) => ({
        ticketId: id,
        notes: current.ticketId === id ? current.notes : [],
        error: getErrorMessage(error),
      }));
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
  const isTicketOpen =
    ticket.status === 'WAITING' ||
    ticket.status === 'IN_PROGRESS' ||
    ticket.status === 'TRANSFERRED';
  const canManageNotes =
    (user?.role === 'ADMIN' || user?.role === 'AGENT') && isTicketOpen;
  const notes =
    ticketNotes.ticketId === id && user?.role !== 'CLIENT'
      ? ticketNotes.notes
      : [];
  const notesError =
    ticketNotes.ticketId === id && user?.role !== 'CLIENT'
      ? ticketNotes.error
      : '';
  const notesLoading =
    user?.role !== 'CLIENT' && Boolean(user) && ticketNotes.ticketId !== id;
  const timeline = [
    ...messages.map((message) => ({
      type: 'message' as const,
      id: message.id,
      createdAt: message.createdAt,
      message,
    })),
    ...notes.map((note) => ({
      type: 'note' as const,
      id: note.id,
      createdAt: note.createdAt,
      note,
    })),
  ].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

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
          <ProfileAvatar
            name={ticket.client.name}
            pictureUrl={ticket.client.profilePictureUrl}
            sizeClass="w-10 h-10"
          />
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-chatz-text truncate">
              {ticket.client.name}
            </p>
            {ticket.client.company && (
              <p className="text-[10px] font-medium text-chatz-pink truncate">
                {ticket.client.company}
              </p>
            )}
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
        {timeline.length === 0 && !notesLoading && (
          <div className="text-center py-12 text-chatz-text-muted text-sm">
            Nenhuma mensagem ainda. Comece a conversa.
          </div>
        )}
        {notesLoading && (
          <p className="mb-3 text-center text-xs text-chatz-text-muted">
            Carregando notas internas...
          </p>
        )}
        {notesError && (
          <p role="alert" className="mb-3 rounded-chatz bg-chatz-danger-light p-2 text-xs text-chatz-danger">
            {notesError}
          </p>
        )}
        <div className="space-y-2">
          {timeline.map((entry) =>
            entry.type === 'note' ? (
              <InternalNote
                key={`note-${entry.id}`}
                note={entry.note}
                canEdit={canManageNotes && entry.note.authorId === user?.id}
                onSave={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ) : (() => {
              const msg = entry.message;
              const isAgentMessage = msg.sender.role !== 'CLIENT';
              return (
              <MessageBubble
                key={`message-${msg.id}`}
                message={msg}
                isAgent={isAgentMessage}
                onFavoriteSticker={
                  user?.role !== 'CLIENT' &&
                  msg.sender.role === 'CLIENT' &&
                  msg.attachment?.sticker
                    ? () => toggleIncomingStickerFavorite(msg)
                    : undefined
                }
                stickerSaved={stickers.some(
                  (sticker) => sticker.sourceMessageId === msg.id
                )}
                favoriteMenuOpen={favoriteMenuMessageId === msg.id}
                onStickerClick={
                  user?.role !== 'CLIENT' &&
                  msg.sender.role === 'CLIENT' &&
                  msg.attachment?.sticker
                    ? () =>
                        setFavoriteMenuMessageId((current) =>
                          current === msg.id ? null : msg.id
                        )
                    : undefined
                }
              />
              );
            })()
          )}
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

      {canManageNotes && (
        <form
          onSubmit={handleCreateNote}
          className="border-t border-amber-300 bg-amber-50 px-3 py-2"
        >
          <label
            htmlFor="internal-note"
            className="mb-1 block text-xs font-semibold text-amber-900"
          >
            Nota interna · só equipe
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="internal-note"
              value={noteDraft}
              maxLength={5000}
              rows={2}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Escreva uma observação que não será enviada ao cliente"
              className="min-h-10 flex-1 resize-y rounded-chatz border border-amber-300 bg-white px-3 py-2 text-sm text-chatz-text outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={noteSaving || !noteDraft.trim()}
              className="rounded-chatz bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {noteSaving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      )}

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
              {stickerPickerOpen && user?.role !== 'CLIENT' && (
                <div
                  role="dialog"
                  aria-label="Minhas figurinhas"
                  className="absolute bottom-full left-2 mb-2 z-50 w-72
                             rounded-chatz-xl border border-chatz-border
                             bg-chatz-surface shadow-chatz-lg p-3"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-chatz-text">
                      Minhas figurinhas
                    </p>
                    <button
                      type="button"
                      onClick={() => setStickerPickerOpen(false)}
                      aria-label="Fechar figurinhas"
                      className="text-chatz-text-muted hover:text-chatz-text"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={stickerName}
                      maxLength={60}
                      onChange={(event) => setStickerName(event.target.value)}
                      placeholder="Nome da figurinha"
                      className="min-w-0 flex-1 px-3 py-2 text-xs rounded-chatz
                                 border border-chatz-border bg-chatz-surface-alt
                                 text-chatz-text"
                    />
                    <input
                      ref={stickerInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleStickerInputChange}
                    />
                    <button
                      type="button"
                      disabled={stickerUploading}
                      onClick={() => stickerInputRef.current?.click()}
                      className="px-3 py-2 rounded-chatz text-xs font-semibold
                                 bg-chatz-primary text-white disabled:opacity-50"
                    >
                      {stickerUploading ? 'Salvando...' : 'Criar'}
                    </button>
                  </div>
                  {stickerError && (
                    <p role="alert" className="mb-2 text-xs text-chatz-danger">
                      {stickerError}
                    </p>
                  )}
                  {stickersLoading ? (
                    <p className="py-4 text-center text-xs text-chatz-text-muted">
                      Carregando figurinhas...
                    </p>
                  ) : stickers.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                      {stickers.map((sticker) => (
                        <div
                          key={sticker.id}
                          className="group relative rounded-chatz border border-chatz-border
                                     bg-chatz-surface-alt p-1"
                        >
                          <button
                            type="button"
                            onClick={() => sendSticker(sticker)}
                            disabled={sending}
                            title={`Enviar ${sticker.name}`}
                            className="w-full flex flex-col items-center gap-1
                                       text-center disabled:opacity-50"
                          >
                            <img
                              src={getStickerUrl(sticker.url)}
                              alt={sticker.name}
                              className="w-16 h-16 object-contain"
                              loading="lazy"
                            />
                            <span className="w-full truncate text-[10px] text-chatz-text">
                              {sticker.name}
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Excluir ${sticker.name}`}
                            onClick={() => deleteSticker(sticker)}
                            className="absolute right-0 top-0 flex w-5 h-5 rounded-full
                                       items-center justify-center bg-chatz-danger
                                       text-white text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-xs text-chatz-text-muted">
                      Nenhuma figurinha criada ainda.
                    </p>
                  )}
                </div>
              )}

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

              {user?.role !== 'CLIENT' && (
                <button
                  type="button"
                  title="Minhas figurinhas"
                  aria-label="Abrir minhas figurinhas"
                  aria-expanded={stickerPickerOpen}
                  onClick={() => {
                    setStickerPickerOpen((open) => !open);
                    setEmojiOpen(false);
                  }}
                  className={`w-10 h-10 rounded-chatz flex items-center justify-center
                              transition-all ${
                                stickerPickerOpen
                                  ? 'bg-chatz-primary-light text-chatz-primary'
                                  : 'text-chatz-text-muted hover:bg-chatz-surface-hover'
                              }`}
                >
                  <StickerIcon />
                </button>
              )}

              <button
                type="button"
                ref={emojiButtonRef}
                title="Emoji"
                onClick={() => {
                  setEmojiOpen((v) => !v);
                  setStickerPickerOpen(false);
                }}
                className={`w-10 h-10 rounded-chatz flex items-center justify-center transition-all ${
                  emojiOpen
                    ? 'bg-chatz-primary-light text-chatz-primary'
                    : 'text-chatz-text-muted hover:bg-chatz-surface-hover'
                }`}
              >
                <EmojiIcon />
              </button>

              <div className="relative flex-1 min-w-0">
                {showQuickReplies && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 z-50
                                  max-h-72 overflow-y-auto bg-chatz-surface
                                  border border-chatz-border rounded-chatz-xl
                                  shadow-chatz-lg">
                    {matchingQuickReplies.length > 0 ? (
                      matchingQuickReplies.map((reply, index) => (
                        <button
                          key={reply.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseQuickReply(reply)}
                          className={`w-full text-left px-4 py-3 border-b
                                      border-chatz-border last:border-0
                                      ${index === activeQuickReply
                                        ? 'bg-chatz-primary-light'
                                        : 'hover:bg-chatz-surface-hover'}`}
                        >
                          <span className="block text-sm font-semibold
                                           text-chatz-text">{reply.title}</span>
                          <span className="block text-xs text-chatz-text-muted
                                           truncate mt-1">{reply.content}</span>
                        </button>
                      ))
                    ) : quickRepliesLoading && user?.role !== 'CLIENT' ? (
                      <p className="px-4 py-3 text-sm text-chatz-text-muted">
                        Carregando respostas prontas...
                      </p>
                    ) : quickReplyError ? (
                      <p role="alert" className="px-4 py-3 text-sm text-chatz-danger">
                        {quickReplyError}
                      </p>
                    ) : (
                      <p className="px-4 py-3 text-sm text-chatz-text-muted">
                        Nenhuma resposta encontrada. Cadastre uma em “Respostas prontas”.
                      </p>
                    )}
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={
                    pendingFiles.length > 0
                      ? 'Legenda (opcional, vai no primeiro arquivo)'
                      : 'Digite sua mensagem...'
                  }
                  disabled={sending}
                  className="w-full px-4 py-2.5 bg-chatz-surface-alt border
                             border-chatz-border rounded-full text-sm
                             text-chatz-text placeholder:text-chatz-text-subtle
                             focus:border-chatz-primary focus:ring-2
                             focus:ring-chatz-primary/20 transition-all"
                />
              </div>

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

function InternalNote({
  note,
  canEdit,
  onSave,
  onDelete,
}: {
  note: TicketNote;
  canEdit: boolean;
  onSave: (noteId: string, content: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const createdAt = new Date(note.createdAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!content.trim() || saving) return;

    setSaving(true);
    setError('');
    try {
      await onSave(note.id, content);
      setEditing(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="ml-auto max-w-[85%] rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-sm">
      <header className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="rounded-full bg-amber-200 px-2 py-0.5 font-bold uppercase tracking-wide">
          Só equipe
        </span>
        <span className="font-semibold">{note.author.name}</span>
        <time dateTime={note.createdAt} className="text-amber-800">
          {createdAt}
        </time>
      </header>

      {editing ? (
        <form onSubmit={handleSave}>
          <textarea
            autoFocus
            value={content}
            maxLength={5000}
            rows={3}
            onChange={(event) => setContent(event.target.value)}
            className="w-full resize-y rounded border border-amber-400 bg-white p-2 text-sm text-chatz-text"
          />
          {error && <p role="alert" className="mt-1 text-xs text-chatz-danger">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setContent(note.content);
                setEditing(false);
                setError('');
              }}
              disabled={saving}
              className="text-xs text-amber-900 hover:underline"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !content.trim()}
              className="rounded bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words">{note.content}</p>
          {canEdit && (
            <div className="mt-2 flex justify-end gap-3 border-t border-amber-200 pt-1.5">
              <button
                type="button"
                onClick={() => {
                  setContent(note.content);
                  setEditing(true);
                }}
                className="text-xs font-medium text-amber-900 hover:underline"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void onDelete(note.id)}
                className="text-xs font-medium text-chatz-danger hover:underline"
              >
                Excluir
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}

function MessageBubble({
  message,
  isAgent,
  onFavoriteSticker,
  stickerSaved,
  favoriteMenuOpen,
  onStickerClick,
}: {
  message: Message;
  isAgent: boolean;
  onFavoriteSticker?: () => void;
  stickerSaved: boolean;
  favoriteMenuOpen: boolean;
  onStickerClick?: () => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const attachment = message.attachment;
  const hasContent = message.content?.trim().length > 0;

  return (
    <div className={`flex items-end gap-2 ${isAgent ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {!isAgent && (
        <ProfileAvatar
          name={message.sender.name}
          pictureUrl={message.sender.profilePictureUrl}
          sizeClass="w-7 h-7"
          textClass="text-[9px]"
        />
      )}
      <div className={`max-w-[70%] rounded-2xl ${isAgent ? 'bg-chatz-button-gradient text-white rounded-br-sm shadow-[0_2px_8px_rgba(236,72,153,0.20)]' : 'bg-chatz-surface border border-chatz-border text-chatz-text rounded-bl-sm'} ${attachment && !hasContent ? 'p-2' : 'px-3.5 py-2'}`}>
        <p
          className={`text-xs font-semibold mb-0.5 px-1.5 pt-0.5 ${
            isAgent ? 'text-white/80' : 'text-chatz-purple'
          }`}
        >
          {message.sender.name}
        </p>
        {message.sender.company && (
          <p className="px-1.5 text-[10px] font-medium text-chatz-pink">
            {message.sender.company}
          </p>
        )}
        {attachment && (
          <div className={hasContent ? 'mb-2' : ''}>
            <div className="relative">
              <AttachmentPreview
                attachment={attachment}
                isMine={isAgent}
                onStickerClick={onStickerClick}
              />
              {onFavoriteSticker && favoriteMenuOpen && (
                <div
                  className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2
                             rounded-full border border-chatz-border bg-chatz-surface
                             p-1 shadow-chatz-lg"
                >
                  <button
                    type="button"
                    onClick={onFavoriteSticker}
                    className="whitespace-nowrap rounded-full px-3 py-1.5
                               text-xs font-medium text-chatz-text
                               hover:bg-chatz-surface-hover"
                  >
                    {stickerSaved
                      ? 'Remover dos favoritos'
                      : 'Adicionar aos favoritos'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {hasContent && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        )}
        <p className={`text-[10px] mt-1 text-right px-1 ${isAgent ? 'text-white/70' : 'text-chatz-text-subtle'}`}>{time}</p>
      </div>
      {isAgent && (
        <ProfileAvatar
          name={message.sender.name}
          pictureUrl={message.sender.profilePictureUrl}
          sizeClass="w-7 h-7"
          textClass="text-[9px]"
        />
      )}
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

function getStickerUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${url}`;
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
function StickerIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7.5" /><path d="M20 13h-5a2 2 0 0 0-2 2v5" /><path d="m20 13-7 7" /></svg>);
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