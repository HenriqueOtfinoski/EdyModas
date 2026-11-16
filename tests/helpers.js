import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';

/** Sobe a aplicação com banco em memória numa porta livre. */
export async function startTestApp() {
  const db = openDb(':memory:');
  seed(db);
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edy-uploads-'));
  const app = createApp(db, { uploadsDir, rateLimit: false });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    db,
    uploadsDir,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => {
          fs.rmSync(uploadsDir, { recursive: true, force: true });
          resolve();
        });
      }),
  };
}

export function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

export const validLead = {
  name: 'Maria Silva',
  whatsapp: '(54) 99472-0227',
  interest: 'Feminino',
  message: 'Quero ver as novidades',
  consent: true,
  source: 'modal',
};
