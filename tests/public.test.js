import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, postJson, validLead } from './helpers.js';
import { openStatus, validateLead } from '../server/validate.js';
import { DEFAULT_SETTINGS } from '../server/seed.js';

let ctx;
before(async () => {
  ctx = await startTestApp();
});
after(() => ctx.close());

const leadCount = () => ctx.db.prepare('SELECT COUNT(*) n FROM leads').get().n;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString();
const addPromo = (starts, ends, active = 1) =>
  ctx.db
    .prepare('INSERT INTO promotions (title, text, starts_at, ends_at, active) VALUES (?, ?, ?, ?, ?)')
    .run('Promo teste', 'texto', starts, ends, active);
const clearPromos = () => ctx.db.exec('DELETE FROM promotions');

test('GET /api/site devolve configurações, 5 categorias e status de aberto/fechado', async () => {
  const res = await fetch(`${ctx.url}/api/site`);
  assert.equal(res.status, 200);
  const site = await res.json();
  assert.equal(site.settings.whatsapp, '5554994720227');
  assert.equal(site.categories.length, 5);
  assert.equal(site.promotion, null);
  assert.deepEqual(site.testimonials, []);
  assert.equal(typeof site.open.isOpen, 'boolean');
  assert.equal(typeof site.open.label, 'string');
  assert.equal('seeded' in site.settings, false);
});

test('GET /api/products filtra por categoria e nunca devolve inativos', async () => {
  ctx.db.prepare("UPDATE products SET active = 0 WHERE name = 'Short jeans'").run();
  const all = await (await fetch(`${ctx.url}/api/products`)).json();
  assert.equal(all.length, 7);
  const fem = await (await fetch(`${ctx.url}/api/products?category=feminino`)).json();
  assert.equal(fem.length, 2);
  assert.ok(fem.every((p) => p.category_slug === 'feminino'));
  const featured = await (await fetch(`${ctx.url}/api/products?featured=1`)).json();
  assert.ok(featured.length > 0 && featured.every((p) => p.featured === 1));
});

test('POST /api/leads aceita WhatsApp formatado e grava só os dígitos', async () => {
  const before = leadCount();
  const res = await postJson(`${ctx.url}/api/leads`, validLead);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.whatsappUrl, /^https:\/\/wa\.me\/5554994720227\?text=/);
  assert.equal(leadCount(), before + 1);
  const row = ctx.db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 1').get();
  assert.equal(row.whatsapp, '54994720227');
  assert.equal(row.name, 'Maria Silva');
  assert.equal(row.consent, 1);
});

test('POST /api/leads rejeita sem consentimento, nome curto e WhatsApp inválido', async () => {
  const before = leadCount();
  for (const bad of [
    { ...validLead, consent: false },
    { ...validLead, name: 'A' },
    { ...validLead, whatsapp: '123' },
    { ...validLead, message: 'x'.repeat(501) },
  ]) {
    const res = await postJson(`${ctx.url}/api/leads`, bad);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(Array.isArray(body.errors) && body.errors.length > 0);
  }
  assert.equal(leadCount(), before);
});

test('POST /api/leads guarda HTML no nome como texto literal', async () => {
  const name = '<img src=x onerror=1> 😀';
  const res = await postJson(`${ctx.url}/api/leads`, { ...validLead, name });
  assert.equal(res.status, 201);
  const row = ctx.db.prepare('SELECT name FROM leads ORDER BY id DESC LIMIT 1').get();
  assert.equal(row.name, name);
});

test('POST /api/leads com campo-isca preenchido responde 201 sem gravar', async () => {
  const before = leadCount();
  const res = await postJson(`${ctx.url}/api/leads`, { ...validLead, website: 'http://spam.example' });
  assert.equal(res.status, 201);
  assert.equal(leadCount(), before);
});

test('POST /api/leads com corpo que não é JSON responde 400', async () => {
  const res = await fetch(`${ctx.url}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{quebrado',
  });
  assert.equal(res.status, 400);
});

test('promoção vencida não aparece como ativa', async () => {
  clearPromos();
  addPromo(iso(-10), iso(-1));
  const site = await (await fetch(`${ctx.url}/api/site`)).json();
  assert.equal(site.promotion, null);
  const res = await fetch(`${ctx.url}/api/promotions/active`);
  assert.equal(await res.json(), null);
});

test('promoção dentro do período e ativa é devolvida', async () => {
  clearPromos();
  addPromo(iso(-1), iso(1));
  const site = await (await fetch(`${ctx.url}/api/site`)).json();
  assert.equal(site.promotion.title, 'Promo teste');
});

test('promoção futura, desativada ou com data inválida não é devolvida', async () => {
  clearPromos();
  addPromo(iso(1), iso(5));
  addPromo(iso(-1), iso(1), 0);
  addPromo(iso(-1), 'lixo');
  addPromo('lixo', iso(1));
  const site = await (await fetch(`${ctx.url}/api/site`)).json();
  assert.equal(site.promotion, null);
});

test('POST /api/events grava tipo permitido e rejeita tipo desconhecido', async () => {
  const ok = await postJson(`${ctx.url}/api/events`, { type: 'click_whatsapp', detail: 'hero' });
  assert.equal(ok.status, 204);
  const row = ctx.db.prepare("SELECT * FROM events WHERE type = 'click_whatsapp'").get();
  assert.equal(row.detail, 'hero');
  const bad = await postJson(`${ctx.url}/api/events`, { type: 'drop_table', detail: '' });
  assert.equal(bad.status, 400);
});

test('rota de API inexistente responde 404 em JSON', async () => {
  const res = await fetch(`${ctx.url}/api/nao-existe`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Não encontrado');
});

test('respostas trazem cabeçalhos de segurança', async () => {
  const res = await fetch(`${ctx.url}/api/site`);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-powered-by'), null);
});

// 2026-11-17 é terça-feira; São Paulo = UTC-3
test('openStatus: terça 10h está aberto e informa quando fecha', () => {
  const s = openStatus(DEFAULT_SETTINGS.hours, new Date('2026-11-17T13:00:00Z'));
  assert.deepEqual(s, { isOpen: true, label: 'Aberto agora • fecha 12h' });
});

test('openStatus: terça 12h30 está fechado e abre ainda hoje', () => {
  const s = openStatus(DEFAULT_SETTINGS.hours, new Date('2026-11-17T15:30:00Z'));
  assert.deepEqual(s, { isOpen: false, label: 'Fechado • abre às 13h30' });
});

test('openStatus: domingo está fechado e abre na segunda', () => {
  const s = openStatus(DEFAULT_SETTINGS.hours, new Date('2026-11-22T13:00:00Z'));
  assert.deepEqual(s, { isOpen: false, label: 'Fechado • abre seg 8h30' });
});

test('openStatus: horários ausentes ou malformados não quebram', () => {
  assert.deepEqual(openStatus(undefined, new Date()), { isOpen: false, label: '' });
  assert.deepEqual(openStatus([[], [], [], [], [], [], []], new Date()), { isOpen: false, label: 'Fechado' });
});

test('validateLead normaliza espaços e limita a origem', () => {
  const r = validateLead({ ...validLead, name: '  Ana  ', source: 'x'.repeat(100) });
  assert.equal(r.ok, true);
  assert.equal(r.value.name, 'Ana');
  assert.equal(r.value.source.length, 40);
});
