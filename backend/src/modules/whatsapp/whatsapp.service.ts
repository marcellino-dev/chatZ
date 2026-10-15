import { env } from '../../config/env';

interface SendMessageOptions {
  phone: string;
  text: string;
}

export async function sendWhatsAppMessage({
  phone,
  text,
}: SendMessageOptions) {
  const url = `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE}`;

  const body = {
    number: normalizePhone(phone),
    text,
  };

  console.log(`📤 [EVOLUTION] Enviando para ${phone}:`);
  console.log(`   ┌─ ${text.split('\n').join('\n   │ ')}`);
  console.log(`   └─`);

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
      console.error('❌ Erro Evolution API:', error);
      throw new Error(`Evolution API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`   ✅ Enviada (id: ${data.key?.id})`);
    return data;
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err);
    throw err;
  }
}

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

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}