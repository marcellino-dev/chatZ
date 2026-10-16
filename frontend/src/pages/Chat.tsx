import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconBar } from '../components/chat/IconBar';
import { ChatList } from '../components/chat/ChatList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatInfo } from '../components/chat/ChatInfo';

export function Chat() {
  const { id } = useParams<{ id: string }>();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex bg-chatz-bg overflow-hidden">
      {/* Coluna 1 — Icon bar */}
      <IconBar />

      {/* Coluna 2 — Lista de conversas */}
      <ChatList />

      {/* Coluna 3 — Conversa ativa */}
      <ChatWindow
        onToggleInfo={() => setInfoOpen((v) => !v)}
        infoOpen={infoOpen}
      />

      {/* Coluna 4 — Info (só quando aberta e tem ticket) */}
      {infoOpen && id && <ChatInfo onClose={() => setInfoOpen(false)} />}
    </div>
  );
}