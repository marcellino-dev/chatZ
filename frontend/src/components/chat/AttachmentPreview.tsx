import { useState } from 'react';

export interface Attachment {
  url: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface Props {
  attachment: Attachment;
  isMine: boolean;
}

// ==========================
// COMPONENTE PRINCIPAL
// ==========================
export function AttachmentPreview({ attachment, isMine }: Props) {
  const fullUrl = getFullUrl(attachment.url);

  switch (attachment.type) {
    case 'image':
      return <ImagePreview url={fullUrl} name={attachment.originalName} />;
    case 'video':
      return <VideoPreview url={fullUrl} />;
    case 'audio':
      return <AudioPreview url={fullUrl} isMine={isMine} />;
    case 'document':
    default:
      return (
        <DocumentPreview
          url={fullUrl}
          name={attachment.originalName}
          size={attachment.size}
          mimetype={attachment.mimetype}
          isMine={isMine}
        />
      );
  }
}

// ==========================
// IMAGEM
// ==========================
function ImagePreview({ url, name }: { url: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        src={url}
        alt={name}
        onClick={() => setOpen(true)}
        className="max-w-[280px] max-h-[280px] rounded-lg cursor-pointer
                   hover:opacity-90 transition-opacity object-cover"
        loading="lazy"
      />

      {/* Lightbox (tela cheia ao clicar) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <img
            src={url}
            alt={name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                       text-white flex items-center justify-center text-2xl transition-all"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

// ==========================
// VÍDEO
// ==========================
function VideoPreview({ url }: { url: string }) {
  return (
    <video
      src={url}
      controls
      preload="metadata"
      className="max-w-[280px] rounded-lg"
    />
  );
}

// ==========================
// ÁUDIO
// ==========================
function AudioPreview({ url, isMine }: { url: string; isMine: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio
        src={url}
        controls
        preload="metadata"
        className={`w-full ${isMine ? 'audio-mine' : ''}`}
      />
    </div>
  );
}

// ==========================
// DOCUMENTO
// ==========================
function DocumentPreview({
  url,
  name,
  size,
  mimetype,
  isMine,
}: {
  url: string;
  name: string;
  size: number;
  mimetype: string;
  isMine: boolean;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all min-w-[200px] ${
        isMine
          ? 'bg-white/15 hover:bg-white/25'
          : 'bg-chatz-surface-alt hover:bg-chatz-surface-hover'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          isMine ? 'bg-white/20' : 'bg-chatz-primary-light'
        }`}
      >
        <FileIcon mimetype={mimetype} isMine={isMine} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p
          className={`text-xs ${
            isMine ? 'text-white/70' : 'text-chatz-text-muted'
          }`}
        >
          {formatSize(size)}
        </p>
      </div>
      <DownloadIcon isMine={isMine} />
    </a>
  );
}

// ==========================
// HELPERS
// ==========================
function getFullUrl(url: string): string {
  // Se já for URL absoluta, retorna
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Se for relativa, adiciona base do backend
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  return `${base}${url}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ==========================
// ÍCONES
// ==========================
function FileIcon({ mimetype, isMine }: { mimetype: string; isMine: boolean }) {
  const color = isMine ? 'text-white' : 'text-chatz-primary';

  if (mimetype.includes('pdf')) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={color}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <text x="8" y="18" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">PDF</text>
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={color}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function DownloadIcon({ isMine }: { isMine: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${isMine ? 'text-white/70' : 'text-chatz-text-muted'}`}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}