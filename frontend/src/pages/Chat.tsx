import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconBar } from '../components/chat/IconBar';
import { ChatList } from '../components/chat/ChatList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatInfo } from '../components/chat/ChatInfo';
import { NotificationPermissionBanner } from '../components/NotificationPermissionBanner';
import { NotificationPermissionModal } from '../components/NotificationPermissionModal';

export function Chat() {
  const { id } = useParams<{ id: string }>();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-chatz-bg overflow-hidden">
      {/* 🔥 Modal de primeiro acesso */}
      <NotificationPermissionModal />

      {/* Banner (caso tenha negado) */}
      <NotificationPermissionBanner />

      <div className="flex-1 flex overflow-hidden">
        <IconBar />
        <ChatList />
        <ChatWindow
          onToggleInfo={() => setInfoOpen((v) => !v)}
          infoOpen={infoOpen}
        />
        {infoOpen && id && <ChatInfo onClose={() => setInfoOpen(false)} />}
      </div>
    </div>
  );
}