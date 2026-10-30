const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
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
  fixture = {
    sector,
    supportSector,
    owner,
    otherAgent,
    activeParticipant,
    inactiveParticipant,
    client,
    ticket,
  };

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
  ['PUT', '/auth/me/status', 401],
  ['POST', '/auth/me/profile-picture', 401],
  ['DELETE', '/auth/me/profile-picture', 401],
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
  ['GET', '/tickets/test-ticket/notes', 401],
  ['POST', '/tickets/test-ticket/notes', 401],
  ['PATCH', '/tickets/test-ticket/notes/test-note', 401],
  ['DELETE', '/tickets/test-ticket/notes/test-note', 401],
  ['POST', '/tickets/test-ticket/tags', 401],
  ['DELETE', '/tickets/test-ticket/tags/test-tag', 401],
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
  ['GET', '/contacts/from-ticket/test-ticket', 401],
  ['GET', '/contacts/test-contact', 401],
  ['POST', '/contacts/test-contact/tags/test-tag', 401],
  ['DELETE', '/contacts/test-contact/tags/test-tag', 401],
  ['POST', '/contacts', 401],
  ['POST', '/contacts/from-ticket/test-ticket', 401],
  ['PATCH', '/contacts/test-contact', 401],
  ['DELETE', '/contacts/test-contact', 401],
  ['POST', '/contacts/test-contact/start-conversation', 401],
  ['GET', '/quick-replies', 401],
  ['GET', '/stickers', 401],
  ['GET', '/tags', 401],
  ['POST', '/stickers/from-message', 401],
  ['POST', '/quick-replies', 401],
  ['PATCH', '/quick-replies/test-reply', 401],
  ['DELETE', '/quick-replies/test-reply', 401],
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

test('agents can update only their own status and admins cannot use the agent status route', async () => {
  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador de status',
      role: 'ADMIN',
      email: `status-admin-${process.pid}@test.invalid`,
    },
  });
  const adminToken = signToken({ sub: admin.id, role: 'ADMIN' });

  const profileResponse = await fetch(`${baseUrl}/auth/me?userId=${fixture.otherAgent.id}`, {
    headers: { authorization: `Bearer ${agentToken}` },
  });
  assert.equal(profileResponse.status, 200);
  const profile = await profileResponse.json();
  assert.equal(profile.id, fixture.owner.id);
  assert.equal(profile.status, 'ONLINE');
  assert.equal(profile.soundEnabled, true);
  assert.equal(profile.desktopNotifications, true);

  const statusResponse = await fetch(`${baseUrl}/auth/me/status`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${agentToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status: 'AWAY', userId: fixture.otherAgent.id }),
  });
  assert.equal(statusResponse.status, 200);
  assert.equal((await statusResponse.json()).status, 'AWAY');
  assert.equal(
    (await prisma.user.findUnique({ where: { id: fixture.owner.id } })).status,
    'AWAY',
  );
  assert.equal(
    (await prisma.user.findUnique({ where: { id: fixture.otherAgent.id } })).status,
    'ONLINE',
  );

  const invalidStatusResponse = await fetch(`${baseUrl}/auth/me/status`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${agentToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status: 'INVISIBLE' }),
  });
  assert.equal(invalidStatusResponse.status, 400);

  const forbiddenResponse = await fetch(`${baseUrl}/auth/me/status`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status: 'BUSY' }),
  });
  assert.equal(forbiddenResponse.status, 403);
});

test('successful agent login returns an offline agent to online status', async () => {
  const password = 'test-password';
  const agent = await prisma.user.create({
    data: {
      name: 'Atendente offline',
      role: 'AGENT',
      email: `offline-agent-${process.pid}@test.invalid`,
      password: await bcrypt.hash(password, 10),
      status: 'OFFLINE',
      statusChangedAt: new Date('2025-01-01T00:00:00.000Z'),
    },
  });

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: agent.email, password }),
  });

  assert.equal(response.status, 200);
  const { user } = await response.json();
  assert.equal(user.status, 'ONLINE');
  assert.ok(new Date(user.statusChangedAt) > new Date('2025-01-01T00:00:00.000Z'));

  const persistedAgent = await prisma.user.findUniqueOrThrow({
    where: { id: agent.id },
  });
  assert.equal(persistedAgent.status, 'ONLINE');
  assert.equal(persistedAgent.statusChangedAt.toISOString(), user.statusChangedAt);
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

test('admins can list all ticket statuses while agents only receive active and waiting tickets', async () => {
  const resolvedTicket = await prisma.ticket.create({
    data: {
      subject: 'Atendimento resolvido',
      status: 'RESOLVED',
      sectorId: fixture.sector.id,
      clientId: fixture.client.id,
      agentId: fixture.owner.id,
    },
  });
  const waitingTicket = await prisma.ticket.create({
    data: {
      subject: 'Atendimento aguardando',
      status: 'WAITING',
      sectorId: fixture.sector.id,
      clientId: fixture.client.id,
    },
  });
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador dos tickets',
      role: 'ADMIN',
      email: `ticket-admin-${process.pid}@test.invalid`,
    },
  });
  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const adminToken = signToken({ sub: admin.id, role: 'ADMIN' });

  const agentResponse = await fetch(`${baseUrl}/tickets`, {
    headers: { authorization: `Bearer ${agentToken}` },
  });
  assert.equal(agentResponse.status, 200);
  const agentTickets = await agentResponse.json();
  assert.ok(agentTickets.every((ticket) => ['WAITING', 'IN_PROGRESS'].includes(ticket.status)));
  assert.ok(!agentTickets.some((ticket) => ticket.id === resolvedTicket.id));
  assert.ok(agentTickets.some((ticket) => ticket.id === waitingTicket.id));

  const resolvedForAgentResponse = await fetch(
    `${baseUrl}/tickets?status=RESOLVED`,
    { headers: { authorization: `Bearer ${agentToken}` } }
  );
  assert.equal(resolvedForAgentResponse.status, 200);
  assert.deepEqual(await resolvedForAgentResponse.json(), []);

  const adminResponse = await fetch(`${baseUrl}/tickets`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminResponse.status, 200);
  const adminTickets = await adminResponse.json();
  assert.ok(adminTickets.some((ticket) => ticket.id === resolvedTicket.id));
  assert.ok(adminTickets.some((ticket) => ticket.id === waitingTicket.id));
});

test('agents only see and claim waiting tickets in their sector or addressed to them', async () => {
  const [
    unassignedTicket,
    requestedTicket,
    foreignTicket,
    noSectorAgent,
    noSectorQueueTicket,
    raceTicket,
  ] =
    await Promise.all([
      prisma.ticket.create({
        data: {
          subject: 'Fila do setor',
          status: 'WAITING',
          sectorId: fixture.sector.id,
          clientId: fixture.client.id,
        },
      }),
      prisma.ticket.create({
        data: {
          subject: 'Direcionado ao outro atendente',
          status: 'WAITING',
          sectorId: fixture.sector.id,
          clientId: fixture.client.id,
          requestedAgentId: fixture.otherAgent.id,
        },
      }),
      prisma.ticket.create({
        data: {
          subject: 'Fila de outro setor',
          status: 'WAITING',
          sectorId: fixture.supportSector.id,
          clientId: fixture.client.id,
        },
      }),
      prisma.user.create({
        data: {
          name: 'Atendente sem setor',
          role: 'AGENT',
          email: `no-sector-${process.pid}@test.invalid`,
        },
      }),
      prisma.ticket.create({
        data: {
          subject: 'Fila sem setor vinculado',
          status: 'WAITING',
          sectorId: fixture.sector.id,
          clientId: fixture.client.id,
        },
      }),
      prisma.ticket.create({
        data: {
          subject: 'Disputa de atendimento',
          status: 'WAITING',
          sectorId: fixture.sector.id,
          clientId: fixture.client.id,
        },
      }),
    ]);

  const ownerHeaders = {
    authorization: `Bearer ${signToken({
      sub: fixture.owner.id,
      role: 'AGENT',
    })}`,
  };
  const otherAgentHeaders = {
    authorization: `Bearer ${signToken({
      sub: fixture.otherAgent.id,
      role: 'AGENT',
    })}`,
  };
  const noSectorHeaders = {
    authorization: `Bearer ${signToken({
      sub: noSectorAgent.id,
      role: 'AGENT',
    })}`,
  };

  const listResponse = await fetch(`${baseUrl}/tickets`, {
    headers: ownerHeaders,
  });
  assert.equal(listResponse.status, 200);
  const ownerTickets = await listResponse.json();
  assert.ok(ownerTickets.some((ticket) => ticket.id === unassignedTicket.id));
  assert.ok(!ownerTickets.some((ticket) => ticket.id === requestedTicket.id));
  assert.ok(!ownerTickets.some((ticket) => ticket.id === foreignTicket.id));

  const requestedListResponse = await fetch(`${baseUrl}/tickets`, {
    headers: otherAgentHeaders,
  });
  const requestedTickets = await requestedListResponse.json();
  assert.ok(requestedTickets.some((ticket) => ticket.id === requestedTicket.id));

  const assignOwnResponse = await fetch(
    `${baseUrl}/tickets/${unassignedTicket.id}/assign`,
    { method: 'PATCH', headers: ownerHeaders },
  );
  assert.equal(assignOwnResponse.status, 200);
  assert.equal((await assignOwnResponse.json()).agentId, fixture.owner.id);

  const assignRequestedByOtherResponse = await fetch(
    `${baseUrl}/tickets/${requestedTicket.id}/assign`,
    { method: 'PATCH', headers: ownerHeaders },
  );
  assert.equal(assignRequestedByOtherResponse.status, 403);

  const assignRequestedResponse = await fetch(
    `${baseUrl}/tickets/${requestedTicket.id}/assign`,
    { method: 'PATCH', headers: otherAgentHeaders },
  );
  assert.equal(assignRequestedResponse.status, 200);
  assert.equal((await assignRequestedResponse.json()).agentId, fixture.otherAgent.id);

  const raceResponses = await Promise.all([
    fetch(`${baseUrl}/tickets/${raceTicket.id}/assign`, {
      method: 'PATCH',
      headers: ownerHeaders,
    }),
    fetch(`${baseUrl}/tickets/${raceTicket.id}/assign`, {
      method: 'PATCH',
      headers: otherAgentHeaders,
    }),
  ]);
  assert.deepEqual(
    raceResponses.map((response) => response.status).sort(),
    [200, 409],
  );
  const claimedRaceTicket = await prisma.ticket.findUnique({
    where: { id: raceTicket.id },
  });
  assert.ok([fixture.owner.id, fixture.otherAgent.id].includes(claimedRaceTicket.agentId));

  for (const suffix of [
    '',
    '/messages',
    '/participants',
    '/transfers',
  ]) {
    const response = await fetch(
      `${baseUrl}/tickets/${foreignTicket.id}${suffix}`,
      {
        ...(suffix === '' ? {} : { method: 'GET' }),
        headers: ownerHeaders,
      },
    );
    assert.equal(response.status, 403, `acesso negado a /tickets/:id${suffix}`);
  }

  const noSectorTicketResponse = await fetch(
    `${baseUrl}/tickets/${noSectorQueueTicket.id}`,
    { headers: noSectorHeaders },
  );
  assert.equal(noSectorTicketResponse.status, 403);
  const noSectorAssignResponse = await fetch(
    `${baseUrl}/tickets/${noSectorQueueTicket.id}/assign`,
    { method: 'PATCH', headers: noSectorHeaders },
  );
  assert.equal(noSectorAssignResponse.status, 403);
});

test('agents can create internal notes only on accessible open tickets', async () => {
  const queueTicket = await prisma.ticket.create({
    data: {
      subject: 'Atendimento na fila com nota',
      status: 'WAITING',
      sectorId: fixture.sector.id,
      clientId: fixture.client.id,
    },
  });
  const closedTicket = await prisma.ticket.create({
    data: {
      subject: 'Atendimento encerrado com nota',
      status: 'IN_PROGRESS',
      sectorId: fixture.sector.id,
      clientId: fixture.client.id,
      agentId: fixture.owner.id,
    },
  });
  const ownerHeaders = {
    authorization: `Bearer ${signToken({
      sub: fixture.owner.id,
      role: 'AGENT',
    })}`,
    'content-type': 'application/json',
  };
  const colleagueHeaders = {
    authorization: `Bearer ${signToken({
      sub: fixture.otherAgent.id,
      role: 'AGENT',
    })}`,
    'content-type': 'application/json',
  };
  const otherSectorHeaders = {
    authorization: `Bearer ${signToken({
      sub: fixture.activeParticipant.id,
      role: 'AGENT',
    })}`,
    'content-type': 'application/json',
  };
  const createResponse = await fetch(
    `${baseUrl}/tickets/${queueTicket.id}/notes`,
    {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ content: 'Cliente pediu retorno por e-mail.' }),
    },
  );
  assert.equal(createResponse.status, 201);
  const note = await createResponse.json();
  assert.equal(note.authorId, fixture.owner.id);
  assert.equal(note.author.name, fixture.owner.name);
  assert.equal(note.content, 'Cliente pediu retorno por e-mail.');
  assert.ok(note.createdAt);
  assert.equal(
    await prisma.message.count({ where: { ticketId: queueTicket.id } }),
    0,
    'nota interna não pode ser registrada como mensagem do cliente',
  );

  const listResponse = await fetch(`${baseUrl}/tickets/${queueTicket.id}/notes`, {
    headers: ownerHeaders,
  });
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).length, 1);

  const colleagueUpdateResponse = await fetch(
    `${baseUrl}/tickets/${queueTicket.id}/notes/${note.id}`,
    {
      method: 'PATCH',
      headers: colleagueHeaders,
      body: JSON.stringify({ content: 'Alteração por outro atendente' }),
    },
  );
  assert.equal(colleagueUpdateResponse.status, 403);

  const inaccessibleListResponse = await fetch(
    `${baseUrl}/tickets/${queueTicket.id}/notes`,
    { headers: otherSectorHeaders },
  );
  assert.equal(inaccessibleListResponse.status, 403);
  const inaccessibleCreateResponse = await fetch(
    `${baseUrl}/tickets/${queueTicket.id}/notes`,
    {
      method: 'POST',
      headers: otherSectorHeaders,
      body: JSON.stringify({ content: 'Sem acesso' }),
    },
  );
  assert.equal(inaccessibleCreateResponse.status, 403);

  const ownUpdateResponse = await fetch(
    `${baseUrl}/tickets/${queueTicket.id}/notes/${note.id}`,
    {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ content: 'Cliente pediu retorno amanhã.' }),
    },
  );
  assert.equal(ownUpdateResponse.status, 200);
  assert.equal(
    (await ownUpdateResponse.json()).content,
    'Cliente pediu retorno amanhã.',
  );

  const transferredTicket = await prisma.ticket.create({
    data: {
      subject: 'Atendimento transferido com nota',
      status: 'IN_PROGRESS',
      sectorId: fixture.sector.id,
      clientId: fixture.client.id,
      agentId: fixture.owner.id,
    },
  });
  const transferNoteResponse = await fetch(
    `${baseUrl}/tickets/${transferredTicket.id}/notes`,
    {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ content: 'Nota que deve acompanhar a transferência.' }),
    },
  );
  assert.equal(transferNoteResponse.status, 201);
  const transferNote = await transferNoteResponse.json();
  const transferResponse = await fetch(
    `${baseUrl}/tickets/${transferredTicket.id}/transfers`,
    {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ toUserId: fixture.otherAgent.id }),
    },
  );
  assert.equal(transferResponse.status, 200);
  const newOwnerNotesResponse = await fetch(
    `${baseUrl}/tickets/${transferredTicket.id}/notes`,
    { headers: colleagueHeaders },
  );
  assert.equal(newOwnerNotesResponse.status, 200);
  assert.deepEqual(
    (await newOwnerNotesResponse.json()).map(({ id, content }) => ({
      id,
      content,
    })),
    [{ id: transferNote.id, content: 'Nota que deve acompanhar a transferência.' }],
  );

  const closedNoteResponse = await fetch(
    `${baseUrl}/tickets/${closedTicket.id}/notes`,
    {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ content: 'Nota antes do encerramento.' }),
    },
  );
  assert.equal(closedNoteResponse.status, 201);
  const closedNote = await closedNoteResponse.json();
  await prisma.ticket.update({
    where: { id: closedTicket.id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });

  const closedUpdateResponse = await fetch(
    `${baseUrl}/tickets/${closedTicket.id}/notes/${closedNote.id}`,
    {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ content: 'Não pode editar' }),
    },
  );
  assert.equal(closedUpdateResponse.status, 409);
  const closedDeleteResponse = await fetch(
    `${baseUrl}/tickets/${closedTicket.id}/notes/${closedNote.id}`,
    { method: 'DELETE', headers: ownerHeaders },
  );
  assert.equal(closedDeleteResponse.status, 409);
});

test('shared tags can be applied independently to tickets and persistent contacts', async () => {
  const ownerHeaders = {
    authorization: `Bearer ${signToken({
      sub: fixture.owner.id,
      role: 'AGENT',
    })}`,
    'content-type': 'application/json',
  };
  const otherSectorHeaders = {
    authorization: `Bearer ${signToken({
      sub: fixture.activeParticipant.id,
      role: 'AGENT',
    })}`,
  };
  const taggedClient = await prisma.user.create({
    data: {
      name: 'Cliente com etiqueta persistente',
      role: 'CLIENT',
      phone: `5521999${String(process.pid).padStart(6, '0').slice(-6)}`,
    },
  });
  const tagsResponse = await fetch(`${baseUrl}/tags`, {
    headers: ownerHeaders,
  });
  assert.equal(tagsResponse.status, 200);
  const tags = await tagsResponse.json();
  const defaultTagNames = new Set(tags.map((tag) => tag.name));
  for (const name of ['Orçamento', 'Dúvida', 'Reclamação', 'Suporte', 'Financeiro']) {
    assert.ok(defaultTagNames.has(name), `etiqueta padrão ${name} deve existir`);
  }
  const supportTag = tags.find((tag) => tag.name === 'Suporte');

  const addTicketTagResponse = await fetch(
    `${baseUrl}/tickets/${fixture.ticket.id}/tags`,
    {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ tagId: supportTag.id }),
    },
  );
  assert.equal(addTicketTagResponse.status, 200);
  assert.deepEqual((await addTicketTagResponse.json()).map((tag) => tag.id), [
    supportTag.id,
  ]);
  const ticketResponse = await fetch(
    `${baseUrl}/tickets/${fixture.ticket.id}`,
    { headers: ownerHeaders },
  );
  assert.deepEqual(
    (await ticketResponse.json()).tags.map((tag) => tag.id),
    [supportTag.id],
  );

  const inaccessibleTagResponse = await fetch(
    `${baseUrl}/tickets/${fixture.ticket.id}/tags`,
    {
      method: 'POST',
      headers: {
        ...otherSectorHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tagId: supportTag.id }),
    },
  );
  assert.equal(inaccessibleTagResponse.status, 403);

  const contactCreateResponse = await fetch(`${baseUrl}/contacts`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      name: taggedClient.name,
      phone: taggedClient.phone,
    }),
  });
  const contact = await contactCreateResponse.json();
  assert.equal(contactCreateResponse.status, 201, JSON.stringify(contact));
  assert.deepEqual(contact.tags, []);

  const addContactTagResponse = await fetch(
    `${baseUrl}/contacts/${contact.id}/tags/${supportTag.id}`,
    { method: 'POST', headers: ownerHeaders },
  );
  assert.equal(addContactTagResponse.status, 200);
  assert.deepEqual(
    (await addContactTagResponse.json()).tags.map((tag) => tag.id),
    [supportTag.id],
  );

  const linkedTicket = await prisma.ticket.create({
    data: {
      subject: 'Outra conversa do mesmo contato',
      status: 'WAITING',
      sectorId: fixture.sector.id,
      clientId: taggedClient.id,
    },
  });
  const linkedContactResponse = await fetch(
    `${baseUrl}/contacts/from-ticket/${linkedTicket.id}`,
    { headers: ownerHeaders },
  );
  assert.equal(linkedContactResponse.status, 200);
  assert.deepEqual(
    (await linkedContactResponse.json()).tags.map((tag) => tag.id),
    [supportTag.id],
    'etiqueta do contato deve persistir entre conversas',
  );

  const removeTicketTagResponse = await fetch(
    `${baseUrl}/tickets/${fixture.ticket.id}/tags/${supportTag.id}`,
    { method: 'DELETE', headers: ownerHeaders },
  );
  assert.equal(removeTicketTagResponse.status, 200);
  assert.deepEqual(await removeTicketTagResponse.json(), []);

  const contactAfterTicketRemoval = await fetch(
    `${baseUrl}/contacts/${contact.id}`,
    { headers: ownerHeaders },
  );
  assert.deepEqual(
    (await contactAfterTicketRemoval.json()).tags.map((tag) => tag.id),
    [supportTag.id],
    'remover etiqueta da conversa não deve removê-la do contato',
  );

  const removeContactTagResponse = await fetch(
    `${baseUrl}/contacts/${contact.id}/tags/${supportTag.id}`,
    { method: 'DELETE', headers: ownerHeaders },
  );
  assert.equal(removeContactTagResponse.status, 200);
  assert.deepEqual((await removeContactTagResponse.json()).tags, []);
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

test('only admins can manage employees and the team list excludes admins and clients', async () => {
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      role: 'ADMIN',
      email: `team-admin-${process.pid}@test.invalid`,
    },
  });
  const adminToken = signToken({ sub: admin.id, role: 'ADMIN' });
  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const adminHeaders = {
    authorization: 'Bearer ' + adminToken,
    'content-type': 'application/json',
  };
  const agentHeaders = {
    authorization: 'Bearer ' + agentToken,
    'content-type': 'application/json',
  };

  const listResponse = await fetch(`${baseUrl}/auth/users`, {
    headers: adminHeaders,
  });
  assert.equal(listResponse.status, 200);
  const team = await listResponse.json();
  assert.ok(team.length > 0);
  assert.ok(team.every((user) => user.role === 'AGENT'));
  assert.ok(team.every((user) => user.id !== admin.id));
  assert.ok(team.every((user) => user.id !== fixture.client.id));

  const adminCreateResponse = await fetch(`${baseUrl}/auth/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Novo atendente',
      email: `new-agent-${process.pid}@test.invalid`,
      password: '123456',
      role: 'AGENT',
      sectorId: fixture.sector.id,
    }),
  });
  assert.equal(adminCreateResponse.status, 201);
  assert.equal((await adminCreateResponse.json()).role, 'AGENT');

  const createAdminResponse = await fetch(`${baseUrl}/auth/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Outro administrador',
      email: `extra-admin-${process.pid}@test.invalid`,
      password: '123456',
      role: 'ADMIN',
    }),
  });
  assert.equal(createAdminResponse.status, 400);

  const createResponse = await fetch(`${baseUrl}/auth/users`, {
    method: 'POST',
    headers: agentHeaders,
    body: JSON.stringify({
      name: 'Novo atendente',
      email: `new-agent-${process.pid}@test.invalid`,
      password: '123456',
      role: 'AGENT',
      sectorId: fixture.sector.id,
    }),
  });
  assert.equal(createResponse.status, 403);

  const updateResponse = await fetch(`${baseUrl}/auth/users/${fixture.owner.id}`, {
    method: 'PATCH',
    headers: agentHeaders,
    body: JSON.stringify({ name: 'Nome alterado' }),
  });
  assert.equal(updateResponse.status, 403);

  const deleteResponse = await fetch(`${baseUrl}/auth/users/${fixture.owner.id}`, {
    method: 'DELETE',
    headers: agentHeaders,
  });
  assert.equal(deleteResponse.status, 403);
});

test('agents can save an incoming client as a contact and open existing contacts', async () => {
  const ownerToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const response = await fetch(
    `${baseUrl}/contacts/from-ticket/${fixture.ticket.id}`,
    { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` } }
  );
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.existing, false);
  assert.equal(result.contact.name, 'Cliente');
  assert.equal(result.contact.phone, '5511999999999');

  const existingResponse = await fetch(
    `${baseUrl}/contacts/from-ticket/${fixture.ticket.id}`,
    { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` } }
  );
  assert.equal(existingResponse.status, 200);
  const existingResult = await existingResponse.json();
  assert.equal(existingResult.existing, true);
  assert.equal(existingResult.contact.id, result.contact.id);

  const getResponse = await fetch(`${baseUrl}/contacts/${result.contact.id}`, {
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).id, result.contact.id);

  const unrelatedToken = signToken({
    sub: fixture.otherAgent.id,
    role: 'AGENT',
  });
  const forbiddenResponse = await fetch(
    `${baseUrl}/contacts/from-ticket/${fixture.ticket.id}`,
    { method: 'POST', headers: { authorization: `Bearer ${unrelatedToken}` } }
  );
  assert.equal(forbiddenResponse.status, 403);
});

test('agents can save a client with a legacy Brazilian mobile number', async () => {
  const client = await prisma.user.create({
    data: {
      name: 'Cliente legado',
      role: 'CLIENT',
      phone: '554789299801',
    },
  });
  const ticket = await prisma.ticket.create({
    data: {
      subject: 'Atendimento com número antigo',
      status: 'IN_PROGRESS',
      sectorId: fixture.sector.id,
      clientId: client.id,
      agentId: fixture.owner.id,
    },
  });
  const token = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const response = await fetch(`${baseUrl}/contacts/from-ticket/${ticket.id}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.contact.phone, '554789299801');
  const storedContact = await prisma.contact.findUnique({
    where: { id: result.contact.id },
  });
  assert.equal(storedContact.normalizedPhone, '554789299801');
});

test('saved contact identity and company appear on tickets and incoming messages', async () => {
  const phone = '5547999887766';
  const client = await prisma.user.create({
    data: { name: 'Cliente original', role: 'CLIENT', phone },
  });
  const ticket = await prisma.ticket.create({
    data: {
      subject: 'Atendimento do Marcelo',
      status: 'IN_PROGRESS',
      sectorId: fixture.sector.id,
      clientId: client.id,
      agentId: fixture.owner.id,
    },
  });
  const token = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const saveResponse = await fetch(
    `${baseUrl}/contacts/from-ticket/${ticket.id}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Marcelo', company: 'Empresa do Marcelo' }),
    }
  );
  assert.equal(saveResponse.status, 201);
  const saved = await saveResponse.json();
  assert.equal(saved.contact.name, 'Marcelo');
  assert.equal(saved.contact.company, 'Empresa do Marcelo');

  const storedClient = await prisma.user.findUnique({ where: { id: client.id } });
  assert.equal(storedClient.name, 'Marcelo');
  assert.equal(storedClient.company, 'Empresa do Marcelo');

  const savedContactResponse = await fetch(
    `${baseUrl}/contacts/from-ticket/${ticket.id}`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  assert.equal(savedContactResponse.status, 200);
  assert.equal((await savedContactResponse.json()).name, 'Marcelo');

  await prisma.conversation.create({
    data: {
      phone,
      state: 'IN_ATTENDANCE',
      sectorId: fixture.sector.id,
      ticketId: ticket.id,
    },
  });

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/chat/fetchProfilePictureUrl/')) {
      return new Response(
        JSON.stringify({ profilePictureUrl: 'https://cdn.test.invalid/marcelo.jpg' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const webhookResponse = await originalFetch(`${baseUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: `${phone}@s.whatsapp.net` },
          messageType: 'conversation',
          message: { conversation: 'Olá novamente' },
          messageTimestamp: 1,
        },
      }),
    });
    assert.equal(webhookResponse.status, 200);

    const messagesResponse = await originalFetch(
      `${baseUrl}/tickets/${ticket.id}/messages`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    assert.equal(messagesResponse.status, 200);
    const messages = await messagesResponse.json();
    assert.equal(messages.at(-1).sender.name, 'Marcelo');
    assert.equal(messages.at(-1).sender.company, 'Empresa do Marcelo');
    assert.equal(
      messages.at(-1).sender.profilePictureUrl,
      'https://cdn.test.invalid/marcelo.jpg'
    );

    const ticketResponse = await originalFetch(`${baseUrl}/tickets/${ticket.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const ticketDetails = await ticketResponse.json();
    assert.equal(ticketDetails.client.name, 'Marcelo');
    assert.equal(ticketDetails.client.company, 'Empresa do Marcelo');
    assert.equal(
      ticketDetails.client.profilePictureUrl,
      'https://cdn.test.invalid/marcelo.jpg'
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('agents can create shared quick replies and manage them', async () => {
  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const headers = {
    authorization: `Bearer ${agentToken}`,
    'content-type': 'application/json',
  };
  const createResponse = await fetch(`${baseUrl}/quick-replies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Saudação',
      content: 'Olá! Como podemos ajudar?',
    }),
  });
  assert.equal(createResponse.status, 201);
  const reply = await createResponse.json();

  const otherAgentToken = signToken({
    sub: fixture.otherAgent.id,
    role: 'AGENT',
  });
  const listResponse = await fetch(`${baseUrl}/quick-replies`, {
    headers: { authorization: `Bearer ${otherAgentToken}` },
  });
  assert.equal(listResponse.status, 200);
  assert.ok((await listResponse.json()).some((item) => item.id === reply.id));

  const updateResponse = await fetch(`${baseUrl}/quick-replies/${reply.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ content: 'Olá, {{nome}}! Como podemos ajudar?' }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(
    (await updateResponse.json()).content,
    'Olá, {{nome}}! Como podemos ajudar?'
  );

  const invalidResponse = await fetch(`${baseUrl}/quick-replies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: '', content: '' }),
  });
  assert.equal(invalidResponse.status, 400);

  const deleteResponse = await fetch(`${baseUrl}/quick-replies/${reply.id}`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(deleteResponse.status, 200);
});

test('agents can create personal stickers and send them as message attachments', async () => {
  const token = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const headers = { authorization: `Bearer ${token}` };
  const formData = new FormData();
  formData.append('name', 'Figurinha de teste');
  formData.append(
    'file',
    new Blob([
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=',
        'base64'
      ),
    ], { type: 'image/png' }),
    'figurinha.png'
  );

  const createResponse = await fetch(`${baseUrl}/stickers`, {
    method: 'POST',
    headers,
    body: formData,
  });
  assert.equal(createResponse.status, 201);
  const sticker = await createResponse.json();
  assert.equal(sticker.name, 'Figurinha de teste');
  assert.equal(sticker.mimetype, 'image/png');
  assert.equal(sticker.userId, fixture.owner.id);

  const listResponse = await fetch(`${baseUrl}/stickers`, { headers });
  assert.equal(listResponse.status, 200);
  assert.deepEqual((await listResponse.json()).map(({ id }) => id), [sticker.id]);

  const otherAgentToken = signToken({
    sub: fixture.otherAgent.id,
    role: 'AGENT',
  });
  const otherListResponse = await fetch(`${baseUrl}/stickers`, {
    headers: { authorization: `Bearer ${otherAgentToken}` },
  });
  assert.deepEqual(await otherListResponse.json(), []);

  const stickerClient = await prisma.user.create({
    data: {
      name: 'Cliente de figurinha',
      role: 'CLIENT',
      email: `sticker-client-${process.pid}@test.invalid`,
    },
  });
  const stickerTicket = await prisma.ticket.create({
    data: {
      subject: 'Teste de figurinha',
      sectorId: fixture.sector.id,
      clientId: stickerClient.id,
      agentId: fixture.owner.id,
    },
  });
  const messageResponse = await fetch(
    `${baseUrl}/tickets/${stickerTicket.id}/messages`,
    {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        content: '',
        attachment: {
          url: sticker.url,
          filename: sticker.filename,
          originalName: sticker.name,
          mimetype: sticker.mimetype,
          size: sticker.size,
          type: 'image',
          sticker: true,
        },
      }),
    }
  );
  assert.equal(messageResponse.status, 201);
  assert.equal((await messageResponse.json()).attachment.sticker, true);

  const incomingMessage = await prisma.message.create({
    data: {
      content: '',
      ticketId: stickerTicket.id,
      senderId: stickerClient.id,
      attachment: {
        url: sticker.url,
        filename: sticker.filename,
        originalName: 'figurinha-recebida.webp',
        mimetype: sticker.mimetype,
        size: sticker.size,
        type: 'image',
        sticker: true,
      },
    },
  });
  const saveIncomingResponse = await fetch(`${baseUrl}/stickers/from-message`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      messageId: incomingMessage.id,
      name: 'Favorita do cliente',
    }),
  });
  assert.equal(saveIncomingResponse.status, 201);
  const savedIncomingSticker = await saveIncomingResponse.json();
  assert.equal(savedIncomingSticker.sourceMessageId, incomingMessage.id);
  assert.notEqual(savedIncomingSticker.filename, sticker.filename);

  const duplicateFavoriteResponse = await fetch(
    `${baseUrl}/stickers/from-message`,
    {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        messageId: incomingMessage.id,
        name: 'Favorita do cliente',
      }),
    }
  );
  assert.equal((await duplicateFavoriteResponse.json()).id, savedIncomingSticker.id);

  const forbiddenFavoriteResponse = await fetch(
    `${baseUrl}/stickers/from-message`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${otherAgentToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messageId: incomingMessage.id,
        name: 'Sem acesso',
      }),
    }
  );
  assert.equal(forbiddenFavoriteResponse.status, 403);

  const forbiddenDelete = await fetch(`${baseUrl}/stickers/${sticker.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${otherAgentToken}` },
  });
  assert.equal(forbiddenDelete.status, 404);

  const deleteResponse = await fetch(`${baseUrl}/stickers/${sticker.id}`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(deleteResponse.status, 200);
  const stickerFilePath = path.join(backendDir, 'uploads', sticker.filename);
  assert.equal(require('node:fs').existsSync(stickerFilePath), true);
  require('node:fs').unlinkSync(stickerFilePath);
  const savedStickerFilePath = path.join(
    backendDir,
    'uploads',
    savedIncomingSticker.filename
  );
  assert.equal(require('node:fs').existsSync(savedStickerFilePath), true);
  require('node:fs').unlinkSync(savedStickerFilePath);
});

test('outgoing WebP stickers are sent to Evolution using the native sticker endpoint', async () => {
  const token = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
  const stickerForm = new FormData();
  stickerForm.append('name', 'Figurinha WebP');
  stickerForm.append(
    'file',
    new Blob(['fake-webp'], { type: 'image/webp' }),
    'sticker.webp'
  );
  const stickerResponse = await fetch(`${baseUrl}/stickers`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: stickerForm,
  });
  assert.equal(stickerResponse.status, 201);
  const sticker = await stickerResponse.json();

  const client = await prisma.user.create({
    data: {
      name: 'Cliente WhatsApp',
      role: 'CLIENT',
      phone: `5511888${process.pid.toString().slice(-7)}`,
    },
  });
  const ticket = await prisma.ticket.create({
    data: {
      subject: 'Envio de figurinha',
      sectorId: fixture.sector.id,
      clientId: client.id,
      agentId: fixture.owner.id,
    },
  });
  const originalFetch = global.fetch;
  let providerUrl = '';
  let providerRequestBody;
  let providerFails = false;
  global.fetch = async (input, init) => {
    providerUrl = String(input);
    providerRequestBody = JSON.parse(init.body);
    if (providerFails) return new Response('provider rejected sticker', { status: 500 });
    return new Response(JSON.stringify({ key: { id: 'sticker-message-id' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const response = await originalFetch(`${baseUrl}/tickets/${ticket.id}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: '',
        attachment: {
          url: sticker.url,
          filename: sticker.filename,
          originalName: sticker.name,
          mimetype: sticker.mimetype,
          size: sticker.size,
          type: 'image',
          sticker: true,
        },
      }),
    });
    assert.equal(response.status, 201);
    assert.match(providerUrl, /\/message\/sendSticker\//);
    assert.equal(providerRequestBody.number, client.phone);
    assert.match(providerRequestBody.sticker, /^[A-Za-z0-9+/]+=*$/);

    providerFails = true;
    const messageCount = await prisma.message.count({
      where: { ticketId: ticket.id },
    });
    const failedResponse = await originalFetch(
      `${baseUrl}/tickets/${ticket.id}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: '',
          attachment: {
            url: sticker.url,
            filename: sticker.filename,
            originalName: sticker.name,
            mimetype: sticker.mimetype,
            size: sticker.size,
            type: 'image',
            sticker: true,
          },
        }),
      }
    );
    assert.equal(failedResponse.status, 201);
    const failedResult = await failedResponse.json();
    assert.match(failedResult.deliveryWarning, /não foi possível enviá-la/);
    assert.equal(
      await prisma.message.count({ where: { ticketId: ticket.id } }),
      messageCount + 1
    );
  } finally {
    global.fetch = originalFetch;
  }

  await prisma.sticker.delete({ where: { id: sticker.id } });
  require('node:fs').unlinkSync(path.join(backendDir, 'uploads', sticker.filename));
});

test('agents can upload a profile picture with image validation', async () => {
  const token = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const formData = new FormData();
  formData.append('file', new Blob(['fake image'], { type: 'image/png' }), 'avatar.png');
  const response = await fetch(`${baseUrl}/auth/me/profile-picture`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  });
  assert.equal(response.status, 200);
  const user = await response.json();
  assert.match(user.profilePictureUrl, /^\/uploads\/.+\.png$/);

  const storedUser = await prisma.user.findUnique({
    where: { id: fixture.owner.id },
  });
  assert.equal(storedUser.profilePictureUrl, user.profilePictureUrl);

  const invalidForm = new FormData();
  invalidForm.append(
    'file',
    new Blob(['not an image'], { type: 'text/plain' }),
    'not-image.txt'
  );
  const invalidResponse = await fetch(`${baseUrl}/auth/me/profile-picture`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: invalidForm,
  });
  assert.equal(invalidResponse.status, 400);

  const removeResponse = await fetch(`${baseUrl}/auth/me/profile-picture`, {
    method: 'DELETE',
    headers: { authorization: 'Bearer ' + token },
  });
  assert.equal(removeResponse.status, 200);
  const updatedUser = await removeResponse.json();
  assert.equal(updatedUser.profilePictureUrl, null);
  const userWithoutPicture = await prisma.user.findUnique({
    where: { id: fixture.owner.id },
  });
  assert.equal(userWithoutPicture.profilePictureUrl, null);
});

test('incoming WhatsApp messages refresh the client profile picture', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes('/chat/fetchProfilePictureUrl/')) {
      return new Response(
        JSON.stringify({ profilePictureUrl: 'https://cdn.test.invalid/customer.jpg' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ key: { id: 'mock-whatsapp-message' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const webhookResponse = await originalFetch(
      `${baseUrl}/whatsapp/webhook`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'messages.upsert',
          data: {
            key: {
              fromMe: false,
              remoteJid: '5511987654321@s.whatsapp.net',
            },
            messageType: 'conversation',
            message: { conversation: 'Olá' },
            messageTimestamp: 1,
          },
        }),
      }
    );
    assert.equal(webhookResponse.status, 200);

    const client = await prisma.user.findUnique({
      where: { phone: '5511987654321' },
    });
    assert.equal(client.profilePictureUrl, 'https://cdn.test.invalid/customer.jpg');
    assert.ok(
      requests.some((url) => url.includes('/chat/fetchProfilePictureUrl/chatz'))
    );

    const ticket = await prisma.ticket.create({
      data: {
        subject: 'Atendimento com foto',
        status: 'IN_PROGRESS',
        sectorId: fixture.sector.id,
        clientId: client.id,
        agentId: fixture.owner.id,
      },
    });
    const ticketToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
    const ticketResponse = await originalFetch(`${baseUrl}/tickets/${ticket.id}`, {
      headers: { authorization: 'Bearer ' + ticketToken },
    });
    assert.equal(ticketResponse.status, 200);
    const ticketDetails = await ticketResponse.json();
    assert.equal(
      ticketDetails.client.profilePictureUrl,
      'https://cdn.test.invalid/customer.jpg'
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('agents can create, search, and edit contacts', async () => {
  const agentToken = signToken({ sub: fixture.owner.id, role: 'AGENT' });
  const client = await prisma.user.create({
    data: {
      name: 'Cliente sem contato salvo',
      role: 'CLIENT',
      phone: '+55 (91) 99155-2191',
    },
  });
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
  const identifiedClient = await prisma.user.findUnique({
    where: { id: client.id },
  });
  assert.equal(identifiedClient.name, 'Ana Souza');
  assert.equal(identifiedClient.company, 'Empresa Azul');

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
  const updatedClient = await prisma.user.findUnique({
    where: { id: client.id },
  });
  assert.equal(updatedClient.name, 'Ana Silva');
  assert.equal(updatedClient.company, null);
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
