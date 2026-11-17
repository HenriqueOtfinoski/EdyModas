import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { startTestApp, postJson, validLead } from './helpers.js';
import { hashPassword, verifyPassword, ensureAdmin, adminConfigProblem } from '../server/auth.js';

const USER = 'admin';
const PASS = 'senha-de-teste-123';
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

let ctx;
let cookie;

before(async () => {
  ctx = await startTestApp();
  ensureAdmin(ctx.db, USER, PASS);
  const res = await postJson(`${ctx.url}/api/admin/login`, { username: USER, password: PASS });
  cookie = res.headers.get('set-cookie').split(';')[0];
});
after(() => ctx.close());

const api = (path, { method = 'GET', body } = {}) =>
  fetch(`${ctx.url}/api/admin${path}`, {
    method,
    headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

const upload = (bytes, filename, type) => {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type }), filename);
  return fetch(`${ctx.url}/api/admin/upload`, { method: 'POST', headers: { Cookie: cookie }, body: form });
};

test('hashPassword gera hash que só confere com a senha certa', () => {
  const hash = hashPassword('abc12345');
  assert.notEqual(hash, 'abc12345');
  assert.equal(verifyPassword('abc12345', hash), true);
  assert.equal(verifyPassword('errada', hash), false);
  assert.equal(verifyPassword('abc12345', 'formato-invalido'), false);
});

test('rotas admin sem cookie respondem 401', async () => {
  for (const path of ['/me', '/products', '/leads', '/settings', '/stats', '/leads.csv']) {
    const res = await fetch(`${ctx.url}/api/admin${path}`);
    assert.equal(res.status, 401, path);
  }
  const up = await fetch(`${ctx.url}/api/admin/upload`, { method: 'POST' });
  assert.equal(up.status, 401);
});

test('login com senha errada ou usuário inexistente responde 401 sem cookie', async () => {
  for (const body of [
    { username: USER, password: 'errada' },
    { username: 'ninguem', password: PASS },
    { username: USER },
    {},
  ]) {
    const res = await postJson(`${ctx.url}/api/admin/login`, body);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
  }
});

test('login certo devolve cookie httpOnly SameSite=Strict e /me responde 200', async () => {
  const res = await postJson(`${ctx.url}/api/admin/login`, { username: USER, password: PASS });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /^edy_sid=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const me = await api('/me');
  assert.equal(me.status, 200);
  assert.equal((await me.json()).username, USER);
});

test('sessão expirada responde 401', async () => {
  const res = await postJson(`${ctx.url}/api/admin/login`, { username: USER, password: PASS });
  const expiredCookie = res.headers.get('set-cookie').split(';')[0];
  ctx.db.prepare('UPDATE sessions SET expires_at = ? WHERE expires_at = (SELECT MAX(expires_at) FROM sessions)').run(Date.now() - 1000);
  const me = await fetch(`${ctx.url}/api/admin/me`, { headers: { Cookie: expiredCookie } });
  assert.equal(me.status, 401);
});

test('logout invalida a sessão', async () => {
  const res = await postJson(`${ctx.url}/api/admin/login`, { username: USER, password: PASS });
  const c = res.headers.get('set-cookie').split(';')[0];
  const out = await fetch(`${ctx.url}/api/admin/logout`, { method: 'POST', headers: { Cookie: c } });
  assert.equal(out.status, 204);
  const me = await fetch(`${ctx.url}/api/admin/me`, { headers: { Cookie: c } });
  assert.equal(me.status, 401);
});

test('requisição admin vinda de outra origem é recusada', async () => {
  const res = await fetch(`${ctx.url}/api/admin/products`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: 'https://site-malicioso.example' },
    body: JSON.stringify({ name: 'X' }),
  });
  assert.equal(res.status, 403);
});

test('criar, editar e apagar produto reflete na API pública', async () => {
  const cat = ctx.db.prepare("SELECT id FROM categories WHERE slug = 'calcados'").get();
  const created = await api('/products', {
    method: 'POST',
    body: { name: 'Tênis branco', description: 'Casual', price_cents: 19990, sizes: '34 ao 39', category_id: cat.id, featured: true, active: true },
  });
  assert.equal(created.status, 201);
  const prod = await created.json();
  assert.equal(prod.name, 'Tênis branco');
  assert.equal(prod.is_demo, 0);

  let pub = await (await fetch(`${ctx.url}/api/products?category=calcados`)).json();
  assert.equal(pub.length, 1);
  assert.equal(pub[0].price_cents, 19990);

  const edited = await api(`/products/${prod.id}`, { method: 'PUT', body: { ...prod, name: 'Tênis off-white', price_cents: null } });
  assert.equal(edited.status, 200);
  pub = await (await fetch(`${ctx.url}/api/products?category=calcados`)).json();
  assert.equal(pub[0].name, 'Tênis off-white');
  assert.equal(pub[0].price_cents, null);

  const removed = await api(`/products/${prod.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);
  pub = await (await fetch(`${ctx.url}/api/products?category=calcados`)).json();
  assert.equal(pub.length, 0);
});

test('produto inválido responde 400 e id inexistente responde 404', async () => {
  for (const body of [
    { name: '' },
    { name: 'Ok', price_cents: -5 },
    { name: 'Ok', price_cents: 'dez' },
    { name: 'Ok', category_id: 99999 },
    { name: 'Ok', image: 'https://externo.example/foto.jpg' },
  ]) {
    const res = await api('/products', { method: 'POST', body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal((await api('/products/99999', { method: 'PUT', body: { name: 'Ok' } })).status, 404);
  assert.equal((await api('/products/99999', { method: 'DELETE' })).status, 404);
  assert.equal((await api('/products/abc', { method: 'DELETE' })).status, 404);
});

test('promoção criada no painel aparece no site só dentro do período', async () => {
  const day = 86400000;
  const bad = await api('/promotions', {
    method: 'POST',
    body: { title: 'Invertida', starts_at: new Date(Date.now() + day).toISOString(), ends_at: new Date(Date.now() - day).toISOString() },
  });
  assert.equal(bad.status, 400);

  const ok = await api('/promotions', {
    method: 'POST',
    body: { title: 'Semana do Natal', text: 'Especiais', starts_at: new Date(Date.now() - day).toISOString(), ends_at: new Date(Date.now() + day).toISOString(), active: true },
  });
  assert.equal(ok.status, 201);
  const site = await (await fetch(`${ctx.url}/api/site`)).json();
  assert.equal(site.promotion.title, 'Semana do Natal');
});

test('depoimento cadastrado aparece no site; nota fora de 1–5 é recusada', async () => {
  assert.equal((await api('/testimonials', { method: 'POST', body: { name: 'Ana', text: 'Amei', rating: 9 } })).status, 400);
  const ok = await api('/testimonials', { method: 'POST', body: { name: 'Ana', text: 'Atendimento maravilhoso', rating: 5, active: true } });
  assert.equal(ok.status, 201);
  const site = await (await fetch(`${ctx.url}/api/site`)).json();
  assert.equal(site.testimonials.length, 1);
  assert.equal(site.testimonials[0].name, 'Ana');
});

test('categoria ganha slug automático a partir do nome', async () => {
  const res = await api('/categories', { method: 'POST', body: { name: 'Moda Praia & Verão' } });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).slug, 'moda-praia-verao');
  const dup = await api('/categories', { method: 'POST', body: { name: 'Moda Praia & Verão' } });
  assert.equal(dup.status, 400);
});

test('PUT settings altera o site e recusa valores inválidos', async () => {
  const ok = await api('/settings', { method: 'PUT', body: { address: 'Av. Principal, 100', whatsapp: '5554992002830', chave_estranha: 'x' } });
  assert.equal(ok.status, 200);
  const site = await (await fetch(`${ctx.url}/api/site`)).json();
  assert.equal(site.settings.address, 'Av. Principal, 100');
  assert.equal(site.settings.whatsapp, '5554992002830');
  assert.equal('chave_estranha' in site.settings, false);

  for (const body of [
    { whatsapp: 'abc' },
    { instagram_url: 'javascript:alert(1)' },
    { hours: [[]] },
    { hours: [[['25:00', '26:00']], [], [], [], [], [], []] },
    { marquee: 'texto' },
    { stats: [{ value: 'muitos', label: 'x' }] },
  ]) {
    const res = await api('/settings', { method: 'PUT', body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('upload recusa arquivo que não é imagem mesmo com extensão .jpg', async () => {
  const res = await upload(Buffer.from('isto é um texto, não uma imagem'), 'foto.jpg', 'image/jpeg');
  assert.equal(res.status, 400);
});

test('upload aceita PNG válido e devolve URL servida pelo site', async () => {
  const res = await upload(PNG_1PX, 'pixel.png', 'image/png');
  assert.equal(res.status, 200);
  const { url } = await res.json();
  assert.match(url, /^\/uploads\/[a-f0-9]+\.webp$/);
  const img = await fetch(`${ctx.url}${url}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/webp');
});

test('upload sem arquivo responde 400', async () => {
  const res = await fetch(`${ctx.url}/api/admin/upload`, { method: 'POST', headers: { Cookie: cookie }, body: new FormData() });
  assert.equal(res.status, 400);
});

test('contatos aparecem na lista e no CSV, com proteção contra fórmulas', async () => {
  await postJson(`${ctx.url}/api/leads`, { ...validLead, name: '=CMD()', message: 'linha; com "aspas"' });
  const list = await (await api('/leads')).json();
  assert.equal(list[0].name, '=CMD()');

  const res = await api('/leads.csv');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const csv = await res.text();
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lines[0], 'data;nome;whatsapp;interesse;mensagem;origem');
  assert.ok(lines.some((l) => l.includes("'=CMD()") && l.includes('"linha; com ""aspas"""')));

  const del = await api(`/leads/${list[0].id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);
});

test('stats soma visitas, cliques e contatos do período', async () => {
  ctx.db.exec('DELETE FROM events; DELETE FROM leads;');
  await postJson(`${ctx.url}/api/events`, { type: 'visit' });
  await postJson(`${ctx.url}/api/events`, { type: 'visit' });
  await postJson(`${ctx.url}/api/events`, { type: 'click_whatsapp', detail: 'hero' });
  await postJson(`${ctx.url}/api/events`, { type: 'click_instagram', detail: 'rodape' });
  await postJson(`${ctx.url}/api/events`, { type: 'click_maps', detail: 'visite' });
  await postJson(`${ctx.url}/api/leads`, validLead);
  const stats = await (await api('/stats?days=7')).json();
  assert.deepEqual(stats.totals, { visits: 2, whatsapp: 1, instagram: 1, facebook: 0, products: 0, maps: 1, leads: 1 });
  assert.equal(stats.byDay.length, 7);
  const today = stats.byDay.at(-1);
  assert.deepEqual({ visits: today.visits, clicks: today.clicks, leads: today.leads }, { visits: 2, clicks: 3, leads: 1 });
});

test('ensureAdmin atualiza a senha quando ela muda no .env', () => {
  ensureAdmin(ctx.db, 'outro', 'primeira-senha');
  ensureAdmin(ctx.db, 'outro', 'segunda-senha');
  const row = ctx.db.prepare("SELECT password_hash FROM admin_users WHERE username = 'outro'").get();
  assert.equal(verifyPassword('segunda-senha', row.password_hash), true);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM admin_users WHERE username = 'outro'").get().n, 1);
});

test('senha trocada no painel continua valendo ao reiniciar com o mesmo .env', () => {
  ensureAdmin(ctx.db, 'reinicio', 'senha-do-env-1');
  // a loja troca a senha pelo painel
  ctx.db.prepare("UPDATE admin_users SET password_hash = ? WHERE username = 'reinicio'").run(hashPassword('senha-do-painel'));
  // o servidor reinicia com o mesmo .env
  ensureAdmin(ctx.db, 'reinicio', 'senha-do-env-1');
  const row = ctx.db.prepare("SELECT password_hash FROM admin_users WHERE username = 'reinicio'").get();
  assert.equal(verifyPassword('senha-do-painel', row.password_hash), true);
  assert.equal(verifyPassword('senha-do-env-1', row.password_hash), false);
});

test('senha nova no .env passa a valer ao reiniciar', () => {
  ensureAdmin(ctx.db, 'reinicio2', 'senha-do-env-1');
  ctx.db.prepare("UPDATE admin_users SET password_hash = ? WHERE username = 'reinicio2'").run(hashPassword('senha-do-painel'));
  ensureAdmin(ctx.db, 'reinicio2', 'senha-do-env-2');
  const row = ctx.db.prepare("SELECT password_hash FROM admin_users WHERE username = 'reinicio2'").get();
  assert.equal(verifyPassword('senha-do-env-2', row.password_hash), true);
});

test('configuração do painel com valores de exemplo ou senha curta é recusada', () => {
  assert.match(adminConfigProblem('', 'uma-senha-boa-123'), /ADMIN_USER/);
  assert.match(adminConfigProblem('loja', 'curta'), /10/);
  assert.match(adminConfigProblem('loja', 'troque-esta-senha'), /exemplo/);
  assert.match(adminConfigProblem('escolha-um-usuario', 'escolha-uma-senha-forte'), /exemplo/);
  assert.equal(adminConfigProblem('loja', 'uma-senha-boa-123'), null);
});

test('dados internos não aparecem na API pública', async () => {
  ensureAdmin(ctx.db, 'interno', 'senha-interna-123');
  const site = await (await fetch(`${ctx.url}/api/site`)).json();
  const keys = Object.keys(site.settings);
  assert.ok(!keys.some((k) => /seeded|admin|password|hash/i.test(k)), keys.join(','));
});

test('stats ignora eventos fora do período', async () => {
  ctx.db.exec("DELETE FROM events");
  ctx.db.prepare("INSERT INTO events (type, detail, created_at) VALUES ('visit', '', datetime('now', '-40 days'))").run();
  ctx.db.prepare("INSERT INTO events (type, detail) VALUES ('visit', '')").run();
  const stats = await (await api('/stats?days=30')).json();
  assert.equal(stats.totals.visits, 1);
});

test('foto grande enviada pelo painel é reduzida para até 1600px, vira WebP e perde os dados de GPS', async () => {
  const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#e24d7f' } })
    .withExif({ IFD0: { Artist: 'celular-da-loja' } })
    .jpeg({ quality: 95 })
    .toBuffer();
  assert.ok((await sharp(big).metadata()).exif, 'a foto de teste precisa ter metadados');
  const res = await upload(big, 'foto-do-celular.jpg', 'image/jpeg');
  assert.equal(res.status, 200);
  const { url } = await res.json();
  assert.match(url, /\.webp$/);
  const saved = Buffer.from(await (await fetch(`${ctx.url}${url}`)).arrayBuffer());
  const meta = await sharp(saved).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(Math.max(meta.width, meta.height), 1600);
  assert.equal(meta.exif, undefined);
});

test('foto pequena não é ampliada', async () => {
  const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#0a0a0a' } }).png().toBuffer();
  const res = await upload(small, 'pequena.png', 'image/png');
  const { url } = await res.json();
  const meta = await sharp(Buffer.from(await (await fetch(`${ctx.url}${url}`)).arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height], [800, 600]);
});
