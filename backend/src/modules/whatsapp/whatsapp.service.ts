import { env } from '../../config/env';

interface SendMessageOptions {
  phone: string;
  text: string;
}

// ==========================
// ENVIAR MENSAGEM VIA EVOLUTION API
// ==========================
export async function sendWhatsAppMessage({
  phone,
  text,
}: SendMessageOptions) {
  const url = `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE}`;

  const body = {
    number: normalizePhone(phone),
    text,
  };

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
    console.log(`📤 Mensagem enviada para ${phone}:`, data.key?.id);
    return data;
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err);
    throw err;
  }
}

// ==========================
// ENVIAR MENU COM BOTÕES (opcional)
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
  // Implementação futura - menu interativo
  // Por enquanto, envia como texto
  const text = `${title}\n\n${description}\n\n${buttons
    .map((b, i) => `${i + 1}️⃣ ${b.text}`)
    .join('\n')}`;

  return sendWhatsAppMessage({ phone, text });
}

// ==========================
// NORMALIZA TELEFONE
// ==========================
function normalizePhone(phone: string): string {
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '');

  // Adiciona DDI 55 se não tiver
  if (digits.length === 11 && !digits.startsWith('55')) {
    return `55${digits}`;
  }

  return digits;
}