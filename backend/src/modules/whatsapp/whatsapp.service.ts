import { env } from '../../config/env';

// ==========================
// TIPOS
// ==========================
interface SendTextOptions {
  phone: string;
  text: string;
}

interface SendMediaOptions {
  phone: string;
  url: string;         // URL pública (ex: http://host.docker.internal:3000/uploads/x.pdf)
  mimetype: string;    // image/jpeg, video/mp4, audio/ogg, application/pdf
  filename: string;    // nome do arquivo
  caption?: string;    // legenda opcional
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
// ENVIAR MÍDIA (imagem, vídeo, áudio, documento)
// ==========================
export async function sendWhatsAppMedia({
  phone,
  url,
  mimetype,
  filename,
  caption,
}: SendMediaOptions) {
  const normalizedPhone = normalizePhone(phone);

  // Detecta tipo
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
      // Áudio tem endpoint próprio
      endpoint = `${env.EVOLUTION_API_URL}/message/sendWhatsAppAudio/${env.EVOLUTION_INSTANCE}`;
      body = {
        number: normalizedPhone,
        audio: url,
      };
    } else {
      // Imagem, vídeo e documento usam sendMedia
      endpoint = `${env.EVOLUTION_API_URL}/message/sendMedia/${env.EVOLUTION_INSTANCE}`;
      body = {
        number: normalizedPhone,
        mediatype: type,           // "image" | "video" | "document"
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
// ENVIAR MENU COM BOTÕES (legado, texto por enquanto)
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