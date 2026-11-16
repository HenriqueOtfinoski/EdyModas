import { Router } from 'express';
import { getSettings } from '../db.js';
import { validateLead, validateEvent, isPromotionLive, openStatus } from '../validate.js';

const PRIVATE_KEYS = ['seeded'];

export function publicSettings(db) {
  const settings = getSettings(db);
  for (const key of PRIVATE_KEYS) delete settings[key];
  return settings;
}

export function activePromotion(db) {
  const rows = db.prepare('SELECT * FROM promotions WHERE active = 1 ORDER BY ends_at ASC').all();
  return rows.find((p) => isPromotionLive(p)) ?? null;
}

const listCategories = (db) => db.prepare('SELECT * FROM categories ORDER BY sort, id').all();
const listTestimonials = (db) =>
  db.prepare('SELECT id, name, text, rating FROM testimonials WHERE active = 1 ORDER BY id DESC').all();

export function publicRoutes(db, { leadLimiter, eventLimiter }) {
  const router = Router();

  router.get('/site', (req, res) => {
    const settings = publicSettings(db);
    res.json({
      settings,
      categories: listCategories(db),
      promotion: activePromotion(db),
      testimonials: listTestimonials(db),
      open: openStatus(settings.hours),
    });
  });

  router.get('/categories', (req, res) => res.json(listCategories(db)));
  router.get('/testimonials', (req, res) => res.json(listTestimonials(db)));
  router.get('/promotions/active', (req, res) => res.json(activePromotion(db)));

  router.get('/products', (req, res) => {
    const where = ['p.active = 1'];
    const params = [];
    if (typeof req.query.category === 'string' && req.query.category) {
      where.push('c.slug = ?');
      params.push(req.query.category);
    }
    if (req.query.featured === '1') where.push('p.featured = 1');
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.description, p.price_cents, p.sizes, p.image, p.featured,
                c.slug AS category_slug, c.name AS category_name
           FROM products p LEFT JOIN categories c ON c.id = p.category_id
          WHERE ${where.join(' AND ')}
          ORDER BY p.featured DESC, p.id DESC`
      )
      .all(...params);
    res.json(rows);
  });

  router.post('/leads', leadLimiter, (req, res) => {
    // Campo-isca: pessoas não o veem; robôs preenchem. Responde como sucesso sem gravar.
    if (req.body && typeof req.body.website === 'string' && req.body.website.trim()) {
      return res.status(201).json({ ok: true, whatsappUrl: null });
    }
    const result = validateLead(req.body);
    if (!result.ok) return res.status(400).json({ errors: result.errors });
    const v = result.value;
    db.prepare(
      'INSERT INTO leads (name, whatsapp, interest, message, consent, source) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(v.name, v.whatsapp, v.interest, v.message, v.consent, v.source);

    const { whatsapp } = getSettings(db);
    const lines = [`Olá! Sou ${v.name} e vim pelo site da Edy Modas.`];
    if (v.interest) lines.push(`Tenho interesse em: ${v.interest}.`);
    if (v.message) lines.push(v.message);
    const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(lines.join(' '))}`;
    res.status(201).json({ ok: true, whatsappUrl });
  });

  router.post('/events', eventLimiter, (req, res) => {
    const result = validateEvent(req.body);
    if (!result.ok) return res.status(400).json({ errors: result.errors });
    db.prepare('INSERT INTO events (type, detail) VALUES (?, ?)').run(result.value.type, result.value.detail);
    res.status(204).end();
  });

  return router;
}
