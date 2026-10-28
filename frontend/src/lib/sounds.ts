// ==========================
// SONS VIA WEB AUDIO API
// ==========================

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new Ctx();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// ==========================
// DING — mensagem recebida (2 notas: A5 → E6)
// ==========================
export function playDing() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    playTone(ctx, 880, now, 0.1, 0.15);
    playTone(ctx, 1318, now + 0.1, 0.15, 0.2);
  } catch (err) {
    console.warn('Erro ao tocar som:', err);
  }
}

// ==========================
// NOTIFICATION — ticket novo na fila (3 notas: C5 → E5 → G5)
// ==========================
export function playNotification() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    playTone(ctx, 523, now, 0.1, 0.15);       // C5
    playTone(ctx, 659, now + 0.1, 0.1, 0.15); // E5
    playTone(ctx, 784, now + 0.2, 0.15, 0.3); // G5
  } catch (err) {
    console.warn('Erro ao tocar som:', err);
  }
}

// ==========================
// SEND — mensagem enviada (curto)
// ==========================
export function playSend() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    playTone(ctx, 1200, now, 0.05, 0.08);
  } catch (err) {
    console.warn('Erro ao tocar som:', err);
  }
}

// ==========================
// HELPER — toca um tom
// ==========================
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

// ==========================
// PREPARAR AUDIO (chamar no primeiro clique)
// ==========================
export function prepareAudio() {
  try {
    getAudioContext();
  } catch (err) {
    console.warn('Erro ao preparar audio:', err);
  }
}