import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
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
}

export function GlobalNotifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  const ticketCacheRef = useRef(new Map<string, string>());

  function getActiveTicketIdFromPath(path: string): string | null {
    const match = path.match(/^\/chat\/([^/]+)$/);
    return match ? match[1] : null;
  }

  useEffect(() => {
    console.log('🎬 [GlobalNotifications] useEffect rodou');
    
    if (!user) {
      console.log('❌ Sem user');
      return;
    }
    
    const socket = getSocket();
    console.log('🔌 Socket:', socket ? 'existe' : 'null');
    console.log('🔌 Socket conectado:', socket?.connected);
    
    if (!socket) {
      console.log('❌ Sem socket');
      return;
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

    async function handleMessage(msg: MessageNewPayload) {
      console.log('🎯 [GlobalNotifications] message:new:', msg);

      const s = useSettingsStore.getState();
      console.log('⚙️ Settings:', {
        enabled: s.notificationsEnabled,
        messages: s.messageNotifications,
        sound: s.soundEnabled,
      });

      if (!s.notificationsEnabled) {
        console.log('⏭️ Notificações desabilitadas');
        return;
      }
      if (!s.messageNotifications) {
        console.log('⏭️ Notificações de mensagens desabilitadas');
        return;
      }

      if (msg.senderId === user?.id) {
        console.log('⏭️ Minha própria mensagem');
        return;
      }

      const currentPath = pathnameRef.current;
      const activeTicket = getActiveTicketIdFromPath(currentPath);
      const isCurrentTicket = activeTicket === msg.ticketId;
      const isTabHidden = document.hidden;
      const isNotInChat = activeTicket === null;

      console.log('📍 Estado:', {
        currentPath,
        activeTicket,
        msgTicketId: msg.ticketId,
        isCurrentTicket,
        isTabHidden,
        isNotInChat,
      });

      let shouldNotify = false;
      if (isTabHidden) shouldNotify = true;
      else if (isNotInChat) shouldNotify = true;
      else if (!isCurrentTicket) shouldNotify = true;

      console.log('🔔 Should notify:', shouldNotify);

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

    async function handleTicketNew(ticket: TicketNewPayload) {
      console.log('🎯 [GlobalNotifications] ticket:new:', ticket);

      const s = useSettingsStore.getState();
      if (!s.notificationsEnabled) return;
      if (!s.ticketNotifications) return;

      if (ticket.requestedAgentId && ticket.requestedAgentId !== user?.id) {
        return;
      }

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

    console.log('✅ Registrando listeners');
    socket.on('message:new', handleMessage);
    socket.on('ticket:new', handleTicketNew);

    return () => {
      console.log('🧹 Cleanup');
      socket.off('message:new', handleMessage);
      socket.off('ticket:new', handleTicketNew);
    };
  }, [user, navigate]);

  return null;
}