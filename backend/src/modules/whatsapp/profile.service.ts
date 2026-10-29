import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { emitToSector, emitToTicket } from '../../sockets/socket.server';
import { findClientUsersByPhone } from '../contacts/contactIdentity.service';

const PROFILE_PICTURE_REFRESH_INTERVAL = 24 * 60 * 60 * 1000;

export async function refreshWhatsAppProfilePicture(phone: string) {
  const clients = await findClientUsersByPhone(phone);
  if (clients.length === 0) return;

  const refreshDue = clients.some(
    (client) =>
      !client.profilePictureUpdatedAt ||
      Date.now() - client.profilePictureUpdatedAt.getTime() >=
        PROFILE_PICTURE_REFRESH_INTERVAL
  );
  if (!refreshDue) {
    return;
  }

  try {
    const response = await fetch(
      `${env.EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/${env.EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ number: phone }),
      }
    );

    if (!response.ok) {
      throw new Error(`Evolution API returned ${response.status}`);
    }

    const data: unknown = await response.json();
    const profilePictureUrl = extractProfilePictureUrl(data);
    const clientIds = clients.map((client) => client.id);
    await prisma.user.updateMany({
      where: { id: { in: clientIds } },
      data: {
        ...(profilePictureUrl ? { profilePictureUrl } : {}),
        profilePictureUpdatedAt: new Date(),
      },
    });

    if (!profilePictureUrl) return;

    const tickets = await prisma.ticket.findMany({
      where: {
        clientId: { in: clientIds },
        status: { in: ['WAITING', 'IN_PROGRESS', 'TRANSFERRED'] },
      },
      select: {
        id: true,
        sectorId: true,
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            phone: true,
            role: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    for (const ticket of tickets) {
      emitToSector(ticket.sectorId, 'ticket:updated', ticket);
      emitToTicket(ticket.id, 'ticket:updated', ticket);
    }
  } catch (error) {
    console.error(
      `Erro ao atualizar foto do perfil WhatsApp (${phone}):`,
      error
    );
  }
}

function extractProfilePictureUrl(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }

  const value = (data as Record<string, unknown>).profilePictureUrl;
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}
