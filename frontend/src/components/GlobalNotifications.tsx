import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { useTicketsStore } from '../stores/tickets';  // 🔥 IMPORT
import { playDing, playNotification } from '../lib/sounds';
import {
  incrementUnread,
  incrementTicketUnread,
  showSystemNotification,
} from '../lib/notifications';
import { api } from '../lib/api';

interface MessageNewPayload {
  id: string;
  ticketId: string;
  senderId: string;
  content?: string;
  attachment?: any;
  sender: { id: string; name: string; role: string };
}

interface TicketNewPayload {
  id: string;
  subject: string;
  sectorId: string;
  client: { name: string; phone: string };
  requestedAgentId?: string | null;
  agentId?: string | null;
  participants?: Array<{
    userId?: string;
    user?: { id: string; name: string };
  }>;
}

export function GlobalNotifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchTickets = useTicketsStore((s) => s.fetchTickets);  // 🔥 STORE

  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  const ticketCacheRef = useRef(new Map<string, string>());

  function getActiveTicketIdFromPath(path: string): string | null {
    const match = path.match(/^\/chat\/([^/]+)$/);
    return match ? match[1] : null;
  }

  // 🔥 Recarrega lista de tickets (chamado em eventos de ticket)
  async function reloadTickets() {
    console.log('🔄 [GlobalNotifications] Recarregando lista de tickets');
    try {
      await fetchTickets({});
    } catch (err) {
      console.error('Erro ao recarregar tickets:', err);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('🛑 [GlobalNotifications] User não autenticado');
      return;
    }

    console.log('🎬 [GlobalNotifications] Registrando listeners pro user:', user.id);

    function getCurrentSocket() {
      return getSocket();
    }

    async function fetchClientName(ticketId: string): Promise<string> {
      if (ticketCacheRef.current.has(ticketId)) {
        return ticketCacheRef.current.get(ticketId)!;
      }
      try {
        const { data } = await api.get(`/tickets/${ticketId}`);
        const name = data.client?.name || data.client?.phone || 'Cliente';
        ticketCacheRef.current.set(ticketId, name);
        return name;
      } catch {
        return 'Cliente';
      }
    }

    function buildPreview(msg: MessageNewPayload): string {
      if (msg.attachment) {
        const typeLabel = {
          image: '📷 Imagem',
          video: '🎥 Vídeo',
          audio: '🎤 Áudio',
          document: '📎 Arquivo',
        }[msg.attachment.type] || '📎 Arquivo';
        const content = (msg.content || '').trim();
        if (content) return `${typeLabel}: ${content}`;
        return `${typeLabel}: ${msg.attachment.originalName || 'arquivo'}`;
      }
      const text = (msg.content || '').trim();
      return text || 'Nova mensagem';
    }

    // ==========================
    // NOVA MENSAGEM
    // ==========================
    async function handleMessage(msg: MessageNewPayload) {
      console.log('🎯 [GlobalNotifications] message:new:', msg);

      const s = useSettingsStore.getState();
      if (!s.notificationsEnabled) return;
      if (!s.messageNotifications) return;
      if (msg.senderId === user?.id) return;

      const currentPath = pathnameRef.current;
      const activeTicket = getActiveTicketIdFromPath(currentPath);
      const isCurrentTicket = activeTicket === msg.ticketId;
      const isTabHidden = document.hidden;
      const isNotInChat = activeTicket === null;

      let shouldNotify = false;
      if (isTabHidden) shouldNotify = true;
      else if (isNotInChat) shouldNotify = true;
      else if (!isCurrentTicket) shouldNotify = true;

      if (!shouldNotify) return;

      if (s.soundEnabled) {
        if (s.soundType === 'ding') playDing();
        else if (s.soundType === 'notification') playNotification();
      }

      incrementUnread();
      incrementTicketUnread(msg.ticketId);

      const clientName = await fetchClientName(msg.ticketId);
      let preview = buildPreview(msg);
      if (!s.showPreview) preview = 'Nova mensagem';
      if (preview.length > 80) preview = preview.slice(0, 80) + '...';

      showSystemNotification({
        title: clientName,
        body: preview,
        onClick: () => {
          window.focus();
          navigate(`/chat/${msg.ticketId}`);
        },
      });
    }

    // ==========================
    // NOVO TICKET
    // ==========================
    async function handleTicketNew(ticket: TicketNewPayload) {
      console.log('🎯 [GlobalNotifications] ticket:new:', ticket);
      console.log('   requestedAgentId:', ticket.requestedAgentId);
      console.log('   userId:', user?.id);
      console.log('   participants:', ticket.participants);

      const s = useSettingsStore.getState();

      // 🔥 Verifica se é participante
      const participants = ticket.participants || [];
      const isParticipant = participants.some((p) => {
        const pUserId = p.userId || p.user?.id;
        return pUserId === user?.id;
      });

      const isRequestedAgent = ticket.requestedAgentId === user?.id;

      console.log('   isParticipant:', isParticipant);
      console.log('   isRequestedAgent:', isRequestedAgent);

      // 🔥 SEMPRE recarrega a lista (mesmo se não notificar)
      await reloadTickets();

      // 🔥 Se não é nem um nem outro, NÃO notifica
      if (!isRequestedAgent && !isParticipant) {
        console.log('⏭️ Ignorando notificação (não é requested nem participante)');
        return;
      }

      if (!s.notificationsEnabled) return;
      if (!s.ticketNotifications) return;

      if (s.soundEnabled) {
        if (s.soundType === 'ding') playDing();
        else if (s.soundType === 'notification') playNotification();
      }

      incrementUnread();

      const clientName = ticket.client?.name || ticket.client?.phone || 'Cliente';
      const preview = s.showPreview
        ? `🎫 Novo atendimento: ${ticket.subject || 'Sem assunto'}`
        : '🎫 Novo atendimento na fila';

      showSystemNotification({
        title: clientName,
        body: preview,
        onClick: () => {
          window.focus();
          navigate(`/chat/${ticket.id}`);
        },
      });
    }

    // 🔥 HANDLER de participante adicionado
    async function handleParticipantAdded(data: any) {
      console.log('🎯 [GlobalNotifications] participant-added:', data);
      // 🔥 Recarrega a lista (garante que aparece)
      await reloadTickets();
    }

    async function handleParticipantRemoved(data: any) {
      console.log('🎯 [GlobalNotifications] participant-removed:', data);
      await reloadTickets();
    }

    async function handleTicketUpdated(ticket: any) {
      // 🔥 Recarrega a lista quando ticket atualiza (status/agent)
      await reloadTickets();
    }

    // 🔥 Conecta listeners
    function attachListeners() {
      const socket = getCurrentSocket();
      if (!socket) {
        console.log('⚠️ [GlobalNotifications] Socket null, retry em 1s...');
        setTimeout(attachListeners, 1000);
        return;
      }

      console.log('✅ [GlobalNotifications] Anexando listeners ao socket:', socket.id);

      socket.off('message:new', handleMessage);
      socket.off('ticket:new', handleTicketNew);
      socket.off('ticket:participant-added', handleParticipantAdded);
      socket.off('ticket:participant-removed', handleParticipantRemoved);
      socket.off('ticket:updated', handleTicketUpdated);

      socket.on('message:new', handleMessage);
      socket.on('ticket:new', handleTicketNew);
      socket.on('ticket:participant-added', handleParticipantAdded);
      socket.on('ticket:participant-removed', handleParticipantRemoved);
      socket.on('ticket:updated', handleTicketUpdated);
    }

    attachListeners();

    function handleConnect() {
      console.log('🔌 [GlobalNotifications] Socket reconectou, re-anexando');
      attachListeners();
    }

    const currentSocket = getCurrentSocket();
    if (currentSocket) {
      currentSocket.on('connect', handleConnect);
    }

    return () => {
      console.log('🧹 [GlobalNotifications] Cleanup');
      const socket = getCurrentSocket();
      if (socket) {
        socket.off('message:new', handleMessage);
        socket.off('ticket:new', handleTicketNew);
        socket.off('ticket:participant-added', handleParticipantAdded);
        socket.off('ticket:participant-removed', handleParticipantRemoved);
        socket.off('ticket:updated', handleTicketUpdated);
        socket.off('connect', handleConnect);
      }
    };
  }, [isAuthenticated, user?.id, navigate, fetchTickets]);

  return null;
}