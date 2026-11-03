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
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#f4f6fb]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <IconBar />
        <div className={`${id ? 'hidden md:flex' : 'flex'} min-h-0 shrink-0`}>
          <ChatList />
        </div>
        <div className={`${id ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1`}>
          <ChatWindow
            onToggleInfo={() => setInfoOpen((v) => !v)}
            infoOpen={infoOpen}
          />
        </div>
        {infoOpen && id && (
          <>
            <button
              type="button"
              aria-label="Fechar detalhes do contato"
              onClick={() => setInfoOpen(false)}
              className="fixed inset-0 z-20 bg-slate-950/30 md:hidden"
            />
            <ChatInfo onClose={() => setInfoOpen(false)} />
          </>
        )}
      </div>
    </div>
  );
}