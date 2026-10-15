import { Request, Response } from 'express';
import { processMessage } from '../bot/bot.service';

// ==========================
// WEBHOOK - Recebe mensagens da Evolution API
// ==========================
export async function webhook(req: Request, res: Response) {
  try {
    const body = req.body;

    // Log pra debug
    console.log('📥 Webhook recebido:', JSON.stringify(body, null, 2));

    // Estrutura do webhook da Evolution
    const event = body.event;
    const data = body.data;

    // Só processa mensagens recebidas
    if (event !== 'messages.upsert') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    // Ignora mensagens enviadas por nós
    if (data?.key?.fromMe) {
      return res.status(200).json({ ok: true, fromMe: true });
    }

    // Extrai dados da mensagem
    const remoteJid = data?.key?.remoteJid; // ex: "5511999999999@s.whatsapp.net"
    const messageText =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      '';

    if (!remoteJid || !messageText) {
      return res.status(200).json({ ok: true, noContent: true });
    }

    // Extrai o número limpo (remove @s.whatsapp.net)
    const phone = remoteJid.split('@')[0];

    console.log(`📩 Mensagem de ${phone}: ${messageText}`);

    // Processa no bot (que também envia resposta via WhatsApp)
    await processMessage({ phone, message: messageText });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err);
    return res.status(200).json({ ok: false, error: String(err) });
  }
}

// ==========================
// VERIFICAÇÃO (GET)
// ==========================
export async function verify(req: Request, res: Response) {
  return res.json({
    status: 'ok',
    message: 'chatZ WhatsApp webhook ready',
    timestamp: new Date().toISOString(),
  });
}