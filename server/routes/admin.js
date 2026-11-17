import { Router } from 'express';
import { getSettings, setSettings } from '../db.js';
import {
  SESSION_COOKIE,
  SESSION_MS,
  verifyPassword,
  hashPassword,
  createSession,
  destroySession,
  readSessionCookie,
  requireAdmin,
  sameOriginOnly,
} from '../auth.js';
import { uploadMiddleware, saveImage } from '../upload.js';
import { publicSettings } from './public.js';

// ---------- validação ----------
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const flag = (v, fallback) => (v === undefined ? fallback : v === true || v === 1 || v === '1' ? 1 : 0);
const IMAGE_PATH = /^\/(uploads|assets)\/[\w\-./]+$/;

function image(v, errors) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !IMAGE_PATH.test(v) || v.includes('..')) {
    errors.push('Imagem inválida: envie a foto pelo painel.');
    return null;
  }
  return v;
}

function required(value, label, max, errors) {
  if (!value || value.length > max) errors.push(`${label}: obrigatório, até ${max} caracteres.`);
  return value;
}
function optional(value, label, max, errors) {
  if (value.length > max) errors.push(`${label}: até ${max} caracteres.`);
  return value;
}

export function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const validators = {
  products(b, db) {
    const errors = [];
    const value = {
      name: required(text(b.name), 'Nome', 120, errors),
      description: optional(text(b.description), 'Descrição', 500, errors),
      price_cents: null,
      sizes: optional(text(b.sizes), 'Tamanhos', 80, errors),
      category_id: null,
      image: image(b.image, errors),
      featured: flag(b.featured, 0),
      active: flag(b.active, 1),
      is_demo: 0,
    };
    if (b.price_cents !== null && b.price_cents !== undefined && b.price_cents !== '') {
      if (!Number.isInteger(b.price_cents) || b.price_cents < 0 || b.price_cents > 100_000_00) {
        errors.push('Preço inválido.');
      } else value.price_cents = b.price_cents;
    }
    if (b.category_id !== null && b.category_id !== undefined && b.category_id !== '') {
      const exists =
        Number.isInteger(b.category_id) && db.prepare('SELECT 1 FROM categories WHERE id = ?').get(b.category_id);
      if (!exists) errors.push('Coleção inexistente.');
      else value.category_id = b.category_id;
    }
    return { errors, value };
  },

  categories(b) {
    const errors = [];
    const name = required(text(b.name), 'Nome', 60, errors);
    const slug = slugify(text(b.slug) || name);
    if (name && !slug) errors.push('Nome precisa ter letras ou números.');
    const sort = b.sort === undefined || b.sort === '' ? 0 : b.sort;
    if (!Number.isInteger(sort)) errors.push('Ordem inválida.');
    return {
      errors,
      value: { name, slug, description: optional(text(b.description), 'Descrição', 200, errors), image: image(b.image, errors), sort },
    };
  },

  promotions(b) {
    const errors = [];
    const start = Date.parse(b.starts_at);
    const end = Date.parse(b.ends_at);
    if (Number.isNaN(start) || Number.isNaN(end)) errors.push('Informe as datas de início e fim.');
    else if (end <= start) errors.push('O fim precisa ser depois do início.');
    return {
      errors,
      value: {
        title: required(text(b.title), 'Título', 120, errors),
        text: optional(text(b.text), 'Texto', 400, errors),
        image: image(b.image, errors),
        starts_at: Number.isNaN(start) ? '' : new Date(start).toISOString(),
        ends_at: Number.isNaN(end) ? '' : new Date(end).toISOString(),
        active: flag(b.active, 1),
      },
    };
  },

  testimonials(b) {
    const errors = [];
    const rating = b.rating === undefined ? 5 : b.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push('Nota deve ser de 1 a 5.');
    return {
      errors,
      value: {
        name: required(text(b.name), 'Nome', 80, errors),
        text: required(text(b.text), 'Depoimento', 600, errors),
        rating,
        active: flag(b.active, 1),
      },
    };
  },
};

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const isHttpsUrl = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

const settingRules = {
  whatsapp: (v) => typeof v === 'string' && /^\d{10,13}$/.test(v),
  whatsapp_display: (v) => typeof v === 'string' && v.length <= 30,
  instagram_url: (v) => typeof v === 'string' && isHttpsUrl(v) && v.length <= 200,
  instagram_handle: (v) => typeof v === 'string' && v.length <= 40,
  facebook_url: (v) => typeof v === 'string' && isHttpsUrl(v) && v.length <= 200,
  address: (v) => typeof v === 'string' && v.length <= 200,
  hours: (v) =>
    Array.isArray(v) &&
    v.length === 7 &&
    v.every(
      (day) =>
        Array.isArray(day) &&
        day.length <= 4 &&
        day.every((p) => Array.isArray(p) && p.length === 2 && TIME.test(p[0]) && TIME.test(p[1]) && minutesOf(p[0]) < minutesOf(p[1]))
    ),
  marquee: (v) => Array.isArray(v) && v.length <= 12 && v.every((s) => typeof s === 'string' && s.length <= 80),
  stats: (v) =>
    Array.isArray(v) &&
    v.length <= 6 &&
    v.every(
      (s) =>
        s &&
        Number.isFinite(s.value) &&
        s.value >= 0 &&
        typeof s.label === 'string' &&
        s.label.length <= 80 &&
        (s.suffix === undefined || (typeof s.suffix === 'string' && s.suffix.length <= 4))
    ),
};

// ---------- CSV ----------
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // impede que planilhas executem o texto como fórmula
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------- rotas ----------
export function adminRoutes(db, { uploadsDir, loginLimiter }) {
  const router = Router();
  const production = process.env.NODE_ENV === 'production';
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: production, path: '/', maxAge: SESSION_MS };

  router.use(sameOriginOnly);

  router.post('/login', loginLimiter, (req, res) => {
    const { username, password } = req.body ?? {};
    const user =
      typeof username === 'string' && typeof password === 'string'
        ? db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username)
        : null;
    // Compara sempre com algum hash, para o tempo de resposta não revelar se o usuário existe.
    const ok = verifyPassword(password, user?.password_hash ?? DUMMY_HASH) && Boolean(user);
    if (!ok) return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    res.cookie(SESSION_COOKIE, createSession(db, user.id), cookieOptions);
    res.json({ username: user.username });
  });

  router.post('/logout', (req, res) => {
    destroySession(db, readSessionCookie(req));
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.status(204).end();
  });

  router.use(requireAdmin(db));

  router.get('/me', (req, res) => res.json({ username: req.admin.username }));

  // CRUD genérico
  const orderBy = { products: 'id DESC', categories: 'sort, id', promotions: 'ends_at DESC', testimonials: 'id DESC' };
  for (const [table, validate] of Object.entries(validators)) {
    const parseId = (req) => (/^\d+$/.test(req.params.id) ? Number(req.params.id) : null);
    const find = (id) => (id === null ? undefined : db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id));
    const guard = (res, fn) => {
      try {
        return fn();
      } catch (err) {
        if (String(err.message).includes('UNIQUE')) return res.status(400).json({ errors: ['Já existe um item com esse nome.'] });
        throw err;
      }
    };

    router.get(`/${table}`, (req, res) => res.json(db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy[table]}`).all()));

    router.post(`/${table}`, (req, res) => {
      const { errors, value } = validate(req.body ?? {}, db);
      if (errors.length) return res.status(400).json({ errors });
      const cols = Object.keys(value);
      guard(res, () => {
        const info = db
          .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
          .run(...cols.map((c) => value[c]));
        res.status(201).json(find(Number(info.lastInsertRowid)));
      });
    });

    router.put(`/${table}/:id`, (req, res) => {
      const id = parseId(req);
      if (!find(id)) return res.status(404).json({ error: 'Não encontrado' });
      const { errors, value } = validate(req.body ?? {}, db);
      if (errors.length) return res.status(400).json({ errors });
      const cols = Object.keys(value);
      guard(res, () => {
        db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
          ...cols.map((c) => value[c]),
          id
        );
        res.json(find(id));
      });
    });

    router.delete(`/${table}/:id`, (req, res) => {
      const id = parseId(req);
      if (!find(id)) return res.status(404).json({ error: 'Não encontrado' });
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      res.status(204).end();
    });
  }

  // Configurações
  router.get('/settings', (req, res) => res.json(publicSettings(db)));
  router.put('/settings', (req, res) => {
    const body = req.body ?? {};
    const accepted = {};
    const errors = [];
    for (const [key, rule] of Object.entries(settingRules)) {
      if (!(key in body)) continue;
      if (rule(body[key])) accepted[key] = body[key];
      else errors.push(`Valor inválido para "${key}".`);
    }
    if (errors.length) return res.status(400).json({ errors });
    setSettings(db, accepted);
    res.json(publicSettings(db));
  });

  // Senha do painel
  router.put('/password', (req, res) => {
    const { current, next } = req.body ?? {};
    const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
    if (!verifyPassword(current, user.password_hash)) return res.status(400).json({ errors: ['Senha atual incorreta.'] });
    if (typeof next !== 'string' || next.length < 10 || next.length > 200) {
      return res.status(400).json({ errors: ['A nova senha precisa ter pelo menos 10 caracteres.'] });
    }
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
    res.status(204).end();
  });

  // Contatos
  const allLeads = () => db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 2000').all();
  router.get('/leads', (req, res) => res.json(allLeads()));
  router.get('/leads.csv', (req, res) => {
    const rows = allLeads().map((l) =>
      [l.created_at, l.name, l.whatsapp, l.interest, l.message, l.source].map(csvCell).join(';')
    );
    const csv = ['data;nome;whatsapp;interesse;mensagem;origem', ...rows].join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="contatos-edy-modas.csv"');
    res.send(`﻿${csv}\r\n`);
  });
  router.delete('/leads/:id', (req, res) => {
    const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : null;
    const info = id === null ? { changes: 0 } : db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    if (!info.changes) return res.status(404).json({ error: 'Não encontrado' });
    res.status(204).end();
  });

  // Medição (dias no horário de Brasília, UTC-3)
  router.get('/stats', (req, res) => {
    const days = Math.min(90, Math.max(1, Number.parseInt(req.query.days, 10) || 30));
    const since = `-${days - 1} days`;
    const dayExpr = "date(created_at, '-3 hours')";
    const from = `date('now', '-3 hours', '${since}')`;
    const events = db
      .prepare(`SELECT ${dayExpr} AS day, type, COUNT(*) AS n FROM events WHERE ${dayExpr} >= ${from} GROUP BY day, type`)
      .all();
    const leads = db
      .prepare(`SELECT ${dayExpr} AS day, COUNT(*) AS n FROM leads WHERE ${dayExpr} >= ${from} GROUP BY day`)
      .all();

    const byDay = [];
    const index = new Map();
    const todayLocal = Date.now() - 3 * 60 * 60 * 1000;
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(todayLocal - i * 86400000).toISOString().slice(0, 10);
      const entry = { day, visits: 0, clicks: 0, leads: 0 };
      byDay.push(entry);
      index.set(day, entry);
    }
    const totals = { visits: 0, whatsapp: 0, instagram: 0, facebook: 0, products: 0, maps: 0, leads: 0 };
    const totalKey = { visit: 'visits', click_whatsapp: 'whatsapp', click_instagram: 'instagram', click_facebook: 'facebook', click_product: 'products', click_maps: 'maps' };
    for (const e of events) {
      const key = totalKey[e.type];
      if (!key) continue;
      totals[key] += e.n;
      const entry = index.get(e.day);
      if (entry) entry[e.type === 'visit' ? 'visits' : 'clicks'] += e.n;
    }
    for (const l of leads) {
      totals.leads += l.n;
      const entry = index.get(l.day);
      if (entry) entry.leads += l.n;
    }
    res.json({ totals, byDay });
  });

  // Upload de imagem
  router.post('/upload', uploadMiddleware, (req, res) => {
    const url = req.file ? saveImage(req.file.buffer, uploadsDir) : null;
    if (!url) return res.status(400).json({ errors: ['Envie uma imagem JPG, PNG ou WebP de até 5 MB.'] });
    res.json({ url });
  });

  return router;
}

const DUMMY_HASH = hashPassword('valor-que-nunca-confere');
