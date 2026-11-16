import path from 'node:path';
import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp, ROOT } from './app.js';
import { ensureAdmin } from './auth.js';

const dbPath = process.env.DB_PATH || path.join(ROOT, 'data', 'edy.db');
const port = Number(process.env.PORT) || 3000;

const db = openDb(dbPath);
seed(db);

const { ADMIN_USER, ADMIN_PASSWORD } = process.env;
if (ADMIN_USER && ADMIN_PASSWORD && ADMIN_PASSWORD.length >= 10) {
  ensureAdmin(db, ADMIN_USER, ADMIN_PASSWORD);
} else {
  console.warn('Painel sem acesso: defina ADMIN_USER e ADMIN_PASSWORD (10+ caracteres) no arquivo .env');
}

const app = createApp(db);
app.listen(port, () => {
  console.log(`Edy Modas no ar: http://localhost:${port}  (painel: http://localhost:${port}/admin)`);
});
