import { prisma } from '../../config/prisma';
import { emitToSector, emitToTicket } from '../../sockets/socket.server';

const brazilianAreaCodes = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67',
  '68', '69', '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

export function normalizeBrazilianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  let nationalNumber: string;

  if (digits.length === 10 || digits.length === 11) {
    nationalNumber = digits;
  } else if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55')
  ) {
    nationalNumber = digits.slice(2);
  } else {
    return null;
  }

  const areaCode = nationalNumber.slice(0, 2);
  const subscriberNumber = nationalNumber.slice(2);
  const validSubscriber =
    (subscriberNumber.length === 8 && /^[2-9]/.test(subscriberNumber)) ||
    (subscriberNumber.length === 9 && subscriberNumber.startsWith('9'));

  if (!brazilianAreaCodes.has(areaCode) || !validSubscriber) return null;
  return `55${nationalNumber}`;
}

function getPhoneVariants(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const canonical = normalizeBrazilianPhone(digits);
  const national = canonical?.slice(2);

  return [...new Set([
    digits,
    canonical,
    national,
    canonical ? `+${canonical}` : null,
    national ? `+55${national}` : null,
  ].filter((value): value is string => Boolean(value)))];
}

export async function findClientUsersByPhone(phone: string) {
  const variants = getPhoneVariants(phone);
  const directMatches = await prisma.user.findMany({
    where: { role: 'CLIENT', phone: { in: variants } },
  });

  if (directMatches.length > 0) return directMatches;

  const canonical = normalizeBrazilianPhone(phone);
  if (!canonical) return [];

  const clients = await prisma.user.findMany({
    where: { role: 'CLIENT', phone: { not: null } },
  });
  return clients.filter(
    (client) =>
      client.phone !== null &&
      normalizeBrazilianPhone(client.phone) === canonical
  );
}

export async function findContactByPhone(phone: string) {
  const normalizedPhone = normalizeBrazilianPhone(phone);
  if (!normalizedPhone) return null;

  return prisma.contact.findUnique({ where: { normalizedPhone } });
}

export async function syncContactIdentity(
  contact: {
    id: string;
    name: string;
    company: string | null;
    phone: string;
    normalizedPhone?: string;
  },
  previousNormalizedPhone?: string
) {
  const normalizedPhone =
    contact.normalizedPhone ?? normalizeBrazilianPhone(contact.phone);
  if (!normalizedPhone) {
    throw new Error('Contato possui um telefone brasileiro inválido');
  }

  if (previousNormalizedPhone && previousNormalizedPhone !== normalizedPhone) {
    const formerContact = await prisma.contact.findUnique({
      where: { normalizedPhone: previousNormalizedPhone },
    });
    const previousUsers = await findClientUsersByPhone(previousNormalizedPhone);

    if (formerContact) {
      await Promise.all(
        previousUsers.map((client) =>
          prisma.user.update({
            where: { id: client.id },
            data: { name: formerContact.name, company: formerContact.company },
          })
        )
      );
    } else {
      await resetClientIdentity(previousUsers);
    }

    await emitClientTicketUpdates(previousUsers.map((client) => client.id));
  }

  const clients = await findClientUsersByPhone(normalizedPhone);
  const changedClients = clients.filter(
    (client) => client.name !== contact.name || client.company !== contact.company
  );
  const updatedClients = await Promise.all(
    changedClients.map((client) =>
      prisma.user.update({
        where: { id: client.id },
        data: { name: contact.name, company: contact.company },
      })
    )
  );

  await emitClientTicketUpdates(changedClients.map((client) => client.id));
  const updatedById = new Map(updatedClients.map((client) => [client.id, client]));
  return clients.map((client) => updatedById.get(client.id) ?? client);
}

export async function resetClientIdentity(
  clients: Array<{ id: string; phone: string | null }>
) {
  return Promise.all(
    clients.map((client) =>
      prisma.user.update({
        where: { id: client.id },
        data: {
          name: `Cliente ${client.phone?.replace(/\D/g, '').slice(-4) ?? ''}`,
          company: null,
        },
      })
    )
  );
}

async function emitClientTicketUpdates(clientIds: string[]) {
  if (clientIds.length === 0) return;

  const tickets = await prisma.ticket.findMany({
    where: { clientId: { in: clientIds } },
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
    emitToSector(ticket.sectorId, 'ticket:updated', { id: ticket.id });
    emitToTicket(ticket.id, 'ticket:updated', ticket);
  }
}
