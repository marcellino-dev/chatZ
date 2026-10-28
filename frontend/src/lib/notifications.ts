let baseTitle = document.title;
let unreadCount = 0;

const ticketUnreadCounts = new Map<string, number>();

type UnreadListener = () => void;
const listeners: UnreadListener[] = [];

export function onUnreadChange(cb: UnreadListener) {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function setBaseTitle(title: string) {
  baseTitle = title;
  updateTitle();
}

export function incrementUnread() {
  unreadCount++;
  updateTitle();
  updateFavicon();
}

export function resetUnread() {
  unreadCount = 0;
  updateTitle();
  updateFavicon();
}

export function getUnreadCount() {
  return unreadCount;
}

export function incrementTicketUnread(ticketId: string) {
  const current = ticketUnreadCounts.get(ticketId) || 0;
  ticketUnreadCounts.set(ticketId, current + 1);
  notifyListeners();
}

export function resetTicketUnread(ticketId: string) {
  if (ticketUnreadCounts.has(ticketId)) {
    ticketUnreadCounts.delete(ticketId);
    notifyListeners();
  }
}

export function getTicketUnread(ticketId: string): number {
  return ticketUnreadCounts.get(ticketId) || 0;
}

function updateTitle() {
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
}

function updateFavicon() {
  const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) return;

  if (unreadCount === 0) {
    link.href = '/logo.jpg';
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.src = '/logo.jpg';
  img.onload = () => {
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(img, 0, 0, 64, 64);

    ctx.beginPath();
    ctx.arc(48, 16, 16, 0, 2 * Math.PI);
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayCount = unreadCount > 9 ? '9+' : String(unreadCount);
    ctx.fillText(displayCount, 48, 16);

    link.href = canvas.toDataURL('image/png');
  };
}

export function setupVisibilityListener() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      resetUnread();
    }
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
}

interface ShowNotificationOptions {
  title: string;
  body: string;
  onClick?: () => void;
}

export function showSystemNotification({
  title,
  body,
  onClick,
}: ShowNotificationOptions) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      silent: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (onClick) onClick();
    };

    setTimeout(() => notification.close(), 8000);
  } catch (err) {
    console.warn('Erro ao mostrar notificação:', err);
  }
}