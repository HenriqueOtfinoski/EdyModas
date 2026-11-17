import path from 'node:path';
import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp, ROOT } from './app.js';
import { ensureAdmin, adminConfigProblem } from './auth.js';

const dbPath = process.env.DB_PATH || path.join(ROOT, 'data', 'edy.db');
const port = Number(process.env.PORT) || 3000;

const db = openDb(dbPath);
seed(db);

const { ADMIN_USER, ADMIN_PASSWORD } = process.env;
const problem = adminConfigProblem(ADMIN_USER, ADMIN_PASSWORD);
if (problem) console.warn(`Painel sem acesso novo: ${problem}.`);
else ensureAdmin(db, ADMIN_USER, ADMIN_PASSWORD);

// Medição: guarda só os últimos 13 meses de visitas e cliques
db.prepare("DELETE FROM events WHERE created_at < datetime('now', '-13 months')").run();

const app = createApp(db);
app.listen(port, () => {
  console.log(`Edy Modas no ar: http://localhost:${port}  (painel: http://localhost:${port}/admin)`);
});
