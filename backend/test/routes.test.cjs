const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_URL = 'file:./route-tests.db';
process.env.JWT_SECRET = 'route-tests-secret-at-least-16-chars';
process.env.EVOLUTION_API_URL = 'http://127.0.0.1:8080';
process.env.EVOLUTION_API_KEY = 'route-tests-key';

const app = require('../dist/app.js').default;
const { prisma } = require('../dist/config/prisma.js');

let server;
let baseUrl;

before(async () => {
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
