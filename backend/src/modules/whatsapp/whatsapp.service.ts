import { env } from '../../config/env';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ==========================
// TIPOS
// ==========================
export interface SendTextOptions {
  phone: string;
  text: string;
}

export interface SendMediaOptions {
  phone: string;
  url: string;
  mimetype: string;
  filename: string;
  caption?: string;
}

export interface DownloadedMedia {
  url: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
}

// ==========================
// ENVIAR TEXTO
// ==========================
export async function sendWhatsAppMessage({ phone, text }: SendTextOptions) {
  const url = `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE}`;

  const body = {
    number: normalizePhone(phone),
    text,
  };

  console.log('');
  console.log(`📤 [EVOLUTION] Texto para ${phone}:`);
  console.log('   ┌─────────────────────────────────────────');
  text.split('\n').forEach((line) => {
    console.log(`   │ ${line}`);
  });
  console.log('   └─────────────────────────────────────────');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('   ❌ Erro Evolution API:', error);
      throw new Error(`Evolution API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`   ✅ Enviado (id: ${data.key?.id})`);
    return data;
  } catch (err) {
    console.error('   ❌ Erro ao enviar texto:', err);
    throw err;
  }
}

// ==========================
// ENVIAR MÍDIA
// ==========================
export async function sendWhatsAppMedia({
  phone,
  url,
  mimetype,
  filename,
  caption,
}: SendMediaOptions) {
  const normalizedPhone = normalizePhone(phone);
  const type = detectMediaType(mimetype);

  console.log('');
  console.log(`📤 [EVOLUTION] Mídia ${type} para ${phone}:`);
  console.log(`   📎 Arquivo: ${filename}`);
  console.log(`   🔗 URL: ${url}`);
  console.log(`   🎭 Mimetype: ${mimetype}`);
  if (caption) console.log(`   💬 Legenda: ${caption}`);

  try {
    let endpoint: string;
    let body: any;

    if (type === 'audio') {
      endpoint = `${env.EVOLUTION_API_URL}/message/sendWhatsAppAudio/${env.EVOLUTION_INSTANCE}`;
      body = {
        number: normalizedPhone,
        audio: url,
      };
    } else {
      endpoint = `${env.EVOLUTION_API_URL}/message/sendMedia/${env.EVOLUTION_INSTANCE}`;
      body = {
        number: normalizedPhone,
        mediatype: type,
        mimetype,
        media: url,
        fileName: filename,
        caption: caption || undefined,
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('   ❌ Erro Evolution API:', error);
      throw new Error(`Evolution API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log(`   ✅ Mídia enviada (id: ${data.key?.id})`);
    return data;
  } catch (err) {
    console.error('   ❌ Erro ao enviar mídia:', err);
    throw err;
  }
}

// ==========================
// BAIXAR MÍDIA RECEBIDA (do WhatsApp)
// ==========================
export async function downloadMediaFromWhatsApp(
  messageObj: any
): Promise<DownloadedMedia | null> {
  try {
    const messageType = messageObj?.messageType;
    if (!messageType || messageType === 'conversation') {
      return null; // não é mídia
    }

    // Tipos suportados
    const supportedTypes = [
      'imageMessage',
      'videoMessage',
      'audioMessage',
      'documentMessage',
      'stickerMessage',
    ];

    if (!supportedTypes.includes(messageType)) {
      console.log(`   ⏭️  Tipo não suportado: ${messageType}`);
      return null;
    }

    console.log(`   📥 Baixando mídia tipo: ${messageType}`);

    // Chama Evolution
    const url = `${env.EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${env.EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        message: {
          key: messageObj.key,
          message: messageObj.message,
          messageType: messageType,
          messageTimestamp: messageObj.messageTimestamp,
        },
        convertToMp4: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('   ❌ Erro ao baixar mídia:', error);
      return null;
    }

    const data = await response.json();

    if (!data.base64) {
      console.error('   ❌ Resposta sem base64');
      return null;
    }

    // Extrai mimetype
    const mimetype = data.mimetype || getMimetypeFromMessageType(messageType);
    const originalName = extractOriginalName(messageObj, messageType);
    const extension = extensionFromMimetype(mimetype, messageType);

    // Decodifica base64
    const buffer = Buffer.from(data.base64, 'base64');

    // Salva
    const uuid = crypto.randomUUID();
    const filename = `${uuid}${extension}`;
    const finalPath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(finalPath, buffer);

    const mediaType = detectMediaType(mimetype);

    console.log(`   ✅ Mídia salva: ${filename} (${formatBytes(buffer.length)})`);

    return {
      url: `/uploads/${filename}`,
      filename,
      originalName,
      mimetype,
      size: buffer.length,
      type: mediaType,
    };
  } catch (err) {
    console.error('   ❌ Erro ao baixar mídia:', err);
    return null;
  }
}

// ==========================
// MENU COM BOTÕES (legado)
// ==========================
export async function sendWhatsAppButtons({
  phone,
  title,
  description,
  buttons,
}: {
  phone: string;
  title: string;
  description: string;
  buttons: { id: string; text: string }[];
}) {
  const text = `${title}\n\n${description}\n\n${buttons
    .map((b, i) => `${i + 1}️⃣ ${b.text}`)
    .join('\n')}`;

  return sendWhatsAppMessage({ phone, text });
}

// ==========================
// HELPERS
// ==========================
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

function detectMediaType(
  mimetype: string
): 'image' | 'video' | 'audio' | 'document' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

function getMimetypeFromMessageType(messageType: string): string {
  switch (messageType) {
    case 'imageMessage':
      return 'image/jpeg';
    case 'videoMessage':
      return 'video/mp4';
    case 'audioMessage':
      return 'audio/ogg';
    case 'documentMessage':
      return 'application/octet-stream';
    case 'stickerMessage':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function extensionFromMimetype(mimetype: string, messageType?: string): string {
  if (messageType === 'stickerMessage') return '.webp';
  if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return '.jpg';
  if (mimetype.includes('png')) return '.png';
  if (mimetype.includes('webp')) return '.webp';
  if (mimetype.includes('gif')) return '.gif';
  if (mimetype.includes('mp4')) return '.mp4';
  if (mimetype.includes('ogg')) return '.ogg';
  if (mimetype.includes('mp3')) return '.mp3';
  if (mimetype.includes('mpeg')) return '.mp3';
  if (mimetype.includes('wav')) return '.wav';
  if (mimetype.includes('pdf')) return '.pdf';
  if (mimetype.includes('zip')) return '.zip';
  if (mimetype.includes('word')) return '.docx';
  if (mimetype.includes('excel')) return '.xlsx';
  return '.bin';
}

function extractOriginalName(messageObj: any, messageType: string): string {
  const msg = messageObj.message || {};

  if (messageType === 'documentMessage' && msg.documentMessage?.fileName) {
    return msg.documentMessage.fileName;
  }
  if (messageType === 'imageMessage') return 'imagem.jpg';
  if (messageType === 'videoMessage') return 'video.mp4';
  if (messageType === 'audioMessage') return 'audio.ogg';
  if (messageType === 'stickerMessage') return 'figurinha.webp';
  return 'arquivo';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}