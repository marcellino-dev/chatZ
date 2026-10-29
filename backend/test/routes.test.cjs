const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { after, before, test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
const databaseFilename = `route-tests-${process.pid}.db`;
process.env.DATABASE_URL = `file:./${databaseFilename}`;
process.env.JWT_SECRET = 'route-tests-secret-at-least-16-chars';
process.env.EVOLUTION_API_URL = 'http://127.0.0.1:8080';
process.env.EVOLUTION_API_KEY = 'route-tests-key';

const backendDir = path.resolve(__dirname, '..');
execFileSync(
  process.execPath,
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
  { cwd: backendDir, env: process.env, stdio: 'pipe' }
);

const app = require('../dist/app.js').default;
const { prisma } = require('../dist/config/prisma.js');
const { signToken } = require('../dist/utils/jwt.js');

let server;
let baseUrl;
let fixture;

before(async () => {
  const sector = await prisma.sector.create({
    data: { name: 'Testes', slug: `testes-${process.pid}` },
  });
  const supportSector = await prisma.sector.create({
    data: { name: 'Suporte', slug: `suporte-${process.pid}` },
  });
  const [owner, otherAgent, activeParticipant, inactiveParticipant, client] =
    await Promise.all([
      prisma.user.create({
        data: { name: 'Responsável', role: 'AGENT', sectorId: sector.id, email: `owner-${process.pid}@test.invalid` },
      }),
      prisma.user.create({
        data: { name: 'Outro agente', role: 'AGENT', sectorId: sector.id, email: `other-${process.pid}@test.invalid` },
      }),
      prisma.user.create({
        data: { name: 'Participante ativo', role: 'AGENT', sectorId: supportSector.id, email: `participant-${process.pid}@test.invalid` },
      }),
      prisma.user.create({
        data: { name: 'Participante inativo', role: 'AGENT', active: false, sectorId: sector.id, email: `inactive-${process.pid}@test.invalid` },
      }),
      prisma.user.create({
        data: { name: 'Cliente', role: 'CLIENT', phone: '5511999999999' },
      }),
    ]);
  const ticket = await prisma.ticket.create({
    data: {
      subject: 'Conversa de teste',
      status: 'IN_PROGRESS',
      sectorId: sector.id,
      clientId: client.id,
      agentId: owner.id,
    },
  });
  fixture = { sector, supportSector, owner, otherAgent, activeParticipant, inactiveParticipant, ticket };

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
  for (const suffix of ['', '-journal']) {
    const databasePath = path.join(backendDir, 'prisma', `${databaseFilename}${suffix}`);
    require('node:fs').rmSync(databasePath, { force: true });
  }
});

const routes = [
  ['GET', '/'],
  ['POST', '/auth/login', 400],
  ['GET', '/auth/me', 401],
  ['POST', '/auth/users', 401],
  ['GET', '/auth/users', 401],
  ['PATCH', '/auth/users/test-user', 401],
  ['DELETE', '/auth/users/test-user', 401],
  ['POST', '/tickets', 401],
  ['GET', '/tickets', 401],
  ['GET', '/tickets/test-ticket', 401],
  ['PATCH', '/tickets/test-ticket/assign', 401],
  ['PATCH', '/tickets/test-ticket/status', 401],
  ['PATCH', '/tickets/test-ticket/priority', 401],
  ['GET', '/tickets/test-ticket/participants', 401],
  ['POST', '/tickets/test-ticket/participants', 401],
  ['DELETE', '/tickets/test-ticket/participants/test-user', 401],
  ['GET', '/tickets/test-ticket/messages', 401],
  ['POST', '/tickets/test-ticket/messages', 401],
  ['GET', '/tickets/test-ticket/transfers', 401],
  ['POST', '/tickets/test-ticket/transfers', 401],
  ['GET', '/sectors', 401],
  ['GET', '/sectors/test-sector', 401],
  ['POST', '/sectors', 401],
  ['PATCH', '/sectors/test-sector', 401],
  ['DELETE', '/sectors/test-sector', 401],
  ['GET', '/contacts', 401],
  ['POST', '/contacts', 401],
  ['PATCH', '/contacts/test-contact', 401],
  ['DELETE', '/contacts/test-contact', 401],
  ['POST', '/contacts/test-contact/start-conversation', 401],
  ['POST', '/bot/simulate', 400],
  ['GET', '/whatsapp/webhook'],
  ['POST', '/whatsapp/webhook'],
  ['POST', '/uploads', 401],
];

test('all registered API routes respond with their expected access or validation status', async (t) => {
  for (const [method, path, expectedStatus = 200] of routes) {
    await t.test(`${method} ${path}`, async () => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(method === 'GET' || method === 'DELETE'
          ? {}
          : { body: JSON.stringify({}) }),
      });

      assert.equal(response.status, expectedStatus);
      assert.notEqual(response.status, 404);
    });
  }
});

test('health and public webhook endpoints return their documented payloads', async () => {
  const healthResponse = await fetch(`${baseUrl}/`);
  const health = await healthResponse.json();
  assert.equal(health.status, 'ok');

  const verifyResponse = await fetch(`${baseUrl}/whatsapp/webhook`);
  const verify = await verifyResponse.json();
  assert.equal(verify.status, 'ok');

  const webhookResponse = await fetch(`${baseUrl}/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'untracked-event' }),
  });
  assert.deepEqual(await webhookResponse.json(), { ok: true, ignored: true });
});

test('malformed JSON is reported as a client error', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Requisição inválida' });
});

test('agents can create, search, and edit contacts', async () => {
  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const headers = {
    authorization: `Bearer ${agentToken}`,
    'content-type': 'application/json',
  };
  const createResponse = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Ana Souza',
      phone: '91991552191',
      company: 'Empresa Azul',
    }),
  });

  assert.equal(createResponse.status, 201);
  const contact = await createResponse.json();
  assert.equal(contact.name, 'Ana Souza');
  assert.equal(contact.company, 'Empresa Azul');
  assert.equal(contact.phone, '91991552191');
  assert.equal(Object.hasOwn(contact, 'normalizedPhone'), false);
  const storedContact = await prisma.contact.findUnique({
    where: { id: contact.id },
  });
  assert.equal(storedContact.normalizedPhone, '5591991552191');

  const searchResponse = await fetch(`${baseUrl}/contacts?q=91991552191`, {
    headers,
  });
  assert.equal(searchResponse.status, 200);
  const searchResults = await searchResponse.json();
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, contact.id);

  const updateResponse = await fetch(`${baseUrl}/contacts/${contact.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: 'Ana Silva', company: '' }),
  });
  assert.equal(updateResponse.status, 200);
  const updatedContact = await updateResponse.json();
  assert.equal(updatedContact.name, 'Ana Silva');
  assert.equal(updatedContact.company, null);
  assert.equal(updatedContact.phone, '91991552191');
});

test('contacts reject duplicate phone numbers regardless of formatting', async () => {
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      role: 'ADMIN',
      email: `admin-${process.pid}@test.invalid`,
    },
  });
  const token = signToken({ sub: admin.id, role: 'ADMIN' });
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
  const first = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Contato um', phone: '11999997777' }),
  });
  assert.equal(first.status, 201);
  const firstContact = await first.json();
  assert.equal(firstContact.name, 'Contato um');

  const duplicate = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Contato duplicado',
      phone: '+55 (11) 99999-7777',
    }),
  });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), {
    error: 'Já existe um contato com esse telefone',
  });

  const second = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Contato dois', phone: '11999998888' }),
  });
  const secondContact = await second.json();
  const duplicateUpdate = await fetch(
    `${baseUrl}/contacts/${secondContact.id}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ phone: '+55 (11) 99999-7777' }),
    }
  );
  assert.equal(duplicateUpdate.status, 409);

  const invalidPhone = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Contato inválido', phone: 'abc' }),
  });
  assert.equal(invalidPhone.status, 400);

  const foreignPhone = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Contato estrangeiro', phone: '+1 202 555 0100' }),
  });
  assert.equal(foreignPhone.status, 400);
});

test('clients cannot manage contacts and updating unknown contacts returns 404', async () => {
  const clientToken = signToken({ sub: fixture.ticket.clientId, role: 'CLIENT' });
  const clientHeaders = {
    authorization: `Bearer ${clientToken}`,
    'content-type': 'application/json',
  };
  const forbiddenResponse = await fetch(`${baseUrl}/contacts`, {
    headers: clientHeaders,
  });
  assert.equal(forbiddenResponse.status, 403);

  const forbiddenDelete = await fetch(`${baseUrl}/contacts/test-contact`, {
    method: 'DELETE',
    headers: clientHeaders,
  });
  assert.equal(forbiddenDelete.status, 403);

  const forbiddenStart = await fetch(
    `${baseUrl}/contacts/test-contact/start-conversation`,
    { method: 'POST', headers: clientHeaders, body: JSON.stringify({}) }
  );
  assert.equal(forbiddenStart.status, 403);

  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const missingResponse = await fetch(`${baseUrl}/contacts/missing-contact`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${agentToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: 'Contato atualizado' }),
  });
  assert.equal(missingResponse.status, 404);
});

test('agents can start and reopen the same WhatsApp conversation from a contact', async () => {
  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const headers = {
    authorization: `Bearer ${agentToken}`,
    'content-type': 'application/json',
  };
  const createContactResponse = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Cliente direto',
      phone: '11988881234',
    }),
  });
  const contact = await createContactResponse.json();

  const startResponse = await fetch(
    `${baseUrl}/contacts/${contact.id}/start-conversation`,
    { method: 'POST', headers, body: JSON.stringify({}) }
  );
  assert.equal(startResponse.status, 201);
  const ticket = await startResponse.json();
  assert.equal(ticket.status, 'IN_PROGRESS');
  assert.equal(ticket.channel, 'WHATSAPP');
  assert.equal(ticket.agentId, fixture.owner.id);
  assert.equal(ticket.sectorId, fixture.sector.id);
  assert.equal(ticket.client.name, 'Cliente direto');
  assert.equal(ticket.client.phone, '5511988881234');

  const conversation = await prisma.conversation.findUnique({
    where: { phone: '5511988881234' },
  });
  assert.equal(conversation.state, 'IN_ATTENDANCE');
  assert.equal(conversation.ticketId, ticket.id);

  const repeatStartResponse = await fetch(
    `${baseUrl}/contacts/${contact.id}/start-conversation`,
    { method: 'POST', headers, body: JSON.stringify({}) }
  );
  assert.equal(repeatStartResponse.status, 201);
  assert.equal((await repeatStartResponse.json()).id, ticket.id);

  const otherAgentToken = signToken({
    sub: fixture.otherAgent.id,
    role: 'AGENT',
  });
  const conflictResponse = await fetch(
    `${baseUrl}/contacts/${contact.id}/start-conversation`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${otherAgentToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );
  assert.equal(conflictResponse.status, 409);

  const deleteResponse = await fetch(`${baseUrl}/contacts/${contact.id}`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(deleteResponse.status, 200);
  assert.ok(await prisma.ticket.findUnique({ where: { id: ticket.id } }));
  assert.equal(
    await prisma.contact.findUnique({ where: { id: contact.id } }),
    null
  );
});

test('agents cannot start a contact conversation in another sector', async () => {
  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const headers = {
    authorization: `Bearer ${agentToken}`,
    'content-type': 'application/json',
  };
  const contactResponse = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Cliente setor',
      phone: '5511977776655',
    }),
  });
  const contact = await contactResponse.json();

  const response = await fetch(
    `${baseUrl}/contacts/${contact.id}/start-conversation`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ sectorId: fixture.supportSector.id }),
    }
  );
  assert.equal(response.status, 403);
});

test('admins can choose a sector when starting contact conversations', async () => {
  const admin = await prisma.user.create({
    data: {
      name: 'Admin de atendimento',
      role: 'ADMIN',
      email: `contact-admin-${process.pid}@test.invalid`,
    },
  });
  const headers = {
    authorization: `Bearer ${signToken({ sub: admin.id, role: 'ADMIN' })}`,
    'content-type': 'application/json',
  };
  const contactResponse = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Contato administrado',
      phone: '5511966665544',
    }),
  });
  const contact = await contactResponse.json();

  const response = await fetch(
    `${baseUrl}/contacts/${contact.id}/start-conversation`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ sectorId: fixture.supportSector.id }),
    }
  );
  assert.equal(response.status, 201);
  const ticket = await response.json();
  assert.equal(ticket.sectorId, fixture.supportSector.id);
  assert.equal(ticket.agentId, admin.id);
});

test('assigned agent can add an active participant to a ticket', async () => {
  const ownerToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const response = await fetch(
    `${baseUrl}/tickets/${fixture.ticket.id}/participants`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId: fixture.activeParticipant.id }),
    }
  );

  assert.equal(response.status, 201);
  const participant = await response.json();
  assert.equal(participant.userId, fixture.activeParticipant.id);
  assert.equal(participant.addedById, fixture.owner.id);

  const listResponse = await fetch(
    `${baseUrl}/tickets/${fixture.ticket.id}/participants`,
    { headers: { authorization: `Bearer ${ownerToken}` } }
  );
  assert.equal(listResponse.status, 200);
  const participants = await listResponse.json();
  assert.equal(participants.length, 1);
  assert.equal(participants[0].user.id, fixture.activeParticipant.id);

  const participantToken = signToken({
    sub: fixture.activeParticipant.id,
    role: 'AGENT',
  });
  const participantTicketsResponse = await fetch(`${baseUrl}/tickets`, {
    headers: { authorization: `Bearer ${participantToken}` },
  });
  assert.equal(participantTicketsResponse.status, 200);
  const participantTickets = await participantTicketsResponse.json();
  assert.ok(
    participantTickets.some((ticket) => ticket.id === fixture.ticket.id),
    'participante deve ver a conversa mesmo estando em outro setor'
  );

  const unrelatedAgentToken = signToken({
    sub: fixture.otherAgent.id,
    role: 'AGENT',
  });
  const unrelatedTicketsResponse = await fetch(`${baseUrl}/tickets`, {
    headers: { authorization: `Bearer ${unrelatedAgentToken}` },
  });
  assert.equal(unrelatedTicketsResponse.status, 200);
  const unrelatedTickets = await unrelatedTicketsResponse.json();
  assert.ok(
    unrelatedTickets.every((ticket) => ticket.id !== fixture.ticket.id),
    'agentes que não pertencem à conversa não devem vê-la'
  );

  const originalFetch = global.fetch;
  const providerRequests = [];
  let sentMessageId;
  global.fetch = async (url, options) => {
    providerRequests.push({
      url: String(url),
      body: JSON.parse(options.body),
    });
    return new Response(JSON.stringify({ key: { id: 'mock-message-id' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const messagesUrl = `${baseUrl}/tickets/${fixture.ticket.id}/messages`;
    const sendMessage = (body) =>
      originalFetch(messagesUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${participantToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

    const sendMessageResponse = await sendMessage({
      content: 'Ana está respondendo o cliente',
    });
    assert.equal(sendMessageResponse.status, 201);
    const sentMessage = await sendMessageResponse.json();
    sentMessageId = sentMessage.id;
    assert.equal(sentMessage.content, 'Ana está respondendo o cliente');
    assert.equal(sentMessage.senderId, fixture.activeParticipant.id);
    assert.equal(sentMessage.sender.name, fixture.activeParticipant.name);
    assert.equal(
      providerRequests[0].body.text,
      '*Participante ativo:*\nAna está respondendo o cliente'
    );

    const imageResponse = await sendMessage({
      attachment: {
        url: '/uploads/image.png',
        filename: 'image.png',
        originalName: 'image.png',
        mimetype: 'image/png',
        size: 10,
        type: 'image',
      },
    });
    assert.equal(imageResponse.status, 201);
    assert.equal(providerRequests[1].body.caption, '*Participante ativo:*');

    const audioResponse = await sendMessage({
      attachment: {
        url: '/uploads/audio.ogg',
        filename: 'audio.ogg',
        originalName: 'audio.ogg',
        mimetype: 'audio/ogg',
        size: 10,
        type: 'audio',
      },
    });
    assert.equal(audioResponse.status, 201);
    assert.equal(
      providerRequests[2].body.text,
      '*Participante ativo:*\nEnviou um áudio'
    );
    assert.match(providerRequests[3].url, /sendWhatsAppAudio/);
  } finally {
    global.fetch = originalFetch;
  }

  const messagesResponse = await fetch(
    `${baseUrl}/tickets/${fixture.ticket.id}/messages`,
    { headers: { authorization: `Bearer ${ownerToken}` } }
  );
  assert.equal(messagesResponse.status, 200);
  const messages = await messagesResponse.json();
  const messageFromParticipant = messages.find(
    (message) => message.id === sentMessageId
  );
  assert.ok(messageFromParticipant);
  assert.equal(messageFromParticipant.sender.name, fixture.activeParticipant.name);
});

test('only the ticket owner or an admin can add participants', async () => {
  const token = signToken({ sub: fixture.otherAgent.id, role: 'AGENT' });
  const response = await fetch(
    `${baseUrl}/tickets/${fixture.ticket.id}/participants`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId: fixture.inactiveParticipant.id }),
    }
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: 'Apenas o atendente responsável pode adicionar',
  });
});

test('inactive participants are rejected and duplicates return a conflict', async () => {
  const token = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
  const url = `${baseUrl}/tickets/${fixture.ticket.id}/participants`;

  const inactiveResponse = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId: fixture.inactiveParticipant.id }),
  });
  assert.equal(inactiveResponse.status, 400);
  assert.deepEqual(await inactiveResponse.json(), { error: 'Usuário inativo' });

  const duplicateResponse = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId: fixture.activeParticipant.id }),
  });
  assert.equal(duplicateResponse.status, 409);
  assert.deepEqual(await duplicateResponse.json(), {
    error: 'Este usuário já está participando',
  });
});
