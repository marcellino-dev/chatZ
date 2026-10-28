// ==========================
// CONTADOR DE NÃO LIDAS NO TÍTULO
// ==========================

let baseTitle = document.title;
let unreadCount = 0;

export function setBaseTitle(title: string) {
  baseTitle = title;
  updateTitle();
}

export function setUnreadCount(count: number) {
  unreadCount = count;
  updateTitle();
  updateFavicon();
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

// ==========================
// ATUALIZA TÍTULO
// ==========================
function updateTitle() {
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
}

// ==========================
// ATUALIZA FAVICON (bolinha vermelha)
// ==========================
function updateFavicon() {
  const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) return;

  if (unreadCount === 0) {
    // Restaura favicon original
    link.href = '/logo.jpg';
    return;
  }

  // Desenha favicon com bolinha vermelha
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Carrega imagem do logo
  const img = new Image();
  img.src = '/logo.jpg';
  img.onload = () => {
    ctx.clearRect(0, 0, 64, 64);

    // Desenha logo
    ctx.drawImage(img, 0, 0, 64, 64);

    // Desenha bolinha vermelha
    ctx.beginPath();
    ctx.arc(48, 16, 16, 0, 2 * Math.PI);
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    // Desenha número
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayCount = unreadCount > 9 ? '9+' : String(unreadCount);
    ctx.fillText(displayCount, 48, 16);

    link.href = canvas.toDataURL('image/png');
  };
}

// ==========================
// VISIBILITY — limpa ao voltar pra aba
// ==========================
export function setupVisibilityListener() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      resetUnread();
    }
  });
}