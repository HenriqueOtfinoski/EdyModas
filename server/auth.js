import crypto from 'node:crypto';

export const SESSION_COOKIE = 'edy_sid';
export const SESSION_MS = 8 * 60 * 60 * 1000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password ?? ''), Buffer.from(saltHex, 'hex'), expected.length || 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

const EXAMPLE_VALUES = ['troque-esta-senha', 'escolha-um-usuario', 'escolha-uma-senha-forte'];

/** Diz o que está errado no usuário/senha do .env (ou null se estiver tudo certo). */
export function adminConfigProblem(username, password) {
  if (!username || !password) return 'defina ADMIN_USER e ADMIN_PASSWORD no arquivo .env';
  if (EXAMPLE_VALUES.includes(username) || EXAMPLE_VALUES.includes(password)) return 'troque os valores de exemplo de ADMIN_USER e ADMIN_PASSWORD no arquivo .env';
  if (password.length < 10) return 'ADMIN_PASSWORD precisa ter pelo menos 10 caracteres';
  return null;
}

/**
 * Garante que o usuário do .env existe. A senha do .env só é (re)aplicada quando ela muda no .env:
 * assim, uma senha trocada pelo painel continua valendo depois que o servidor reinicia.
 */
export function ensureAdmin(db, username, password) {
  const row = db.prepare('SELECT id, password_hash, env_hash FROM admin_users WHERE username = ?').get(username);
  if (!row) {
    db.prepare('INSERT INTO admin_users (username, password_hash, env_hash) VALUES (?, ?, ?)').run(username, hashPassword(password), hashPassword(password));
    return;
  }
  if (row.env_hash && verifyPassword(password, row.env_hash)) return; // .env igual ao da última vez
  if (!verifyPassword(password, row.password_hash)) {
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
  }
  db.prepare('UPDATE admin_users SET env_hash = ? WHERE id = ?').run(hashPassword(password), row.id);
}

// O banco guarda só o hash do token: quem ler o arquivo não consegue assumir sessões.
const tokenKey = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(db, userId) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    tokenKey(token),
    userId,
    Date.now() + SESSION_MS
  );
  return token;
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(tokenKey(token));
}

export function readSessionCookie(req) {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}

/** Middleware: só passa quem tem sessão válida. */
export function requireAdmin(db) {
  return (req, res, next) => {
    const token = readSessionCookie(req);
    const row = token
      ? db
          .prepare(
            `SELECT u.id, u.username, s.expires_at FROM sessions s
               JOIN admin_users u ON u.id = s.user_id WHERE s.token = ?`
          )
          .get(tokenKey(token))
      : null;
    if (!row || row.expires_at < Date.now()) return res.status(401).json({ error: 'Não autorizado' });
    req.admin = { id: row.id, username: row.username };
    next();
  };
}

/** Recusa requisições que mudam dados vindas de outra origem (defesa extra contra CSRF). */
export function sameOriginOnly(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {
      /* origem malformada */
    }
    if (host !== req.headers.host) return res.status(403).json({ error: 'Origem não permitida' });
  }
  next();
}
