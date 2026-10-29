import { Request, Response } from 'express';
import { prepareIncomingClient, processMessage } from '../bot/bot.service';
import { downloadMediaFromWhatsApp } from './whatsapp.service';
import { refreshWhatsAppProfilePicture } from './profile.service';

export async function webhook(req: Request, res: Response) {
  try {
    const body = req.body;

    console.log('📥 Webhook recebido:', JSON.stringify(body, null, 2));

    const event = body.event;
    const data = body.data;

    if (event !== 'messages.upsert') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (data?.key?.fromMe) {
      return res.status(200).json({ ok: true, fromMe: true });
    }

    const remoteJid = data?.key?.remoteJid;
    if (!remoteJid) {
      return res.status(200).json({ ok: true, noContent: true });
    }

    const phone = remoteJid.split('@')[0];
    const messageType = data.messageType || 'conversation';

    let content = '';
    let attachment: any = null;

    if (messageType === 'conversation') {
      content =
        data?.message?.conversation ||
        data?.message?.extendedTextMessage?.text ||
        '';
      console.log(`📩 Texto de ${phone}: "${content}"`);
    } else {
      console.log(`📎 Mídia recebida de ${phone}: ${messageType}`);

      content =
        data?.message?.imageMessage?.caption ||
        data?.message?.videoMessage?.caption ||
        data?.message?.documentMessage?.caption ||
        '';

      attachment = await downloadMediaFromWhatsApp({
        key: data.key,
        message: data.message,
        messageType: messageType,
        messageTimestamp: data.messageTimestamp,
      });

      if (!attachment) {
        console.log(`   ⚠️ Mídia não pôde ser baixada. Ignorando.`);
        return res.status(200).json({ ok: true, mediaFailed: true });
      }
    }

    if (!content && !attachment) {
      return res.status(200).json({ ok: true, empty: true });
    }

    await prepareIncomingClient(phone);
    await refreshWhatsAppProfilePicture(phone);
    await processMessage({
      phone,
      message: content,
      attachment,
    } as any);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err);
    return res.status(500).json({ ok: false, error: 'Falha ao processar webhook' });
  }
}

export async function verify(req: Request, res: Response) {
  return res.json({
    status: 'ok',
    message: 'chatZ WhatsApp webhook ready',
    timestamp: new Date().toISOString(),
  });
}