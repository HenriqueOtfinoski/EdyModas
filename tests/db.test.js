import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getSettings, setSettings } from '../server/db.js';
import { seed } from '../server/seed.js';

test('seed é idempotente e cria categorias, produtos demo e nenhum depoimento', () => {
  const db = openDb(':memory:');
  seed(db);
  seed(db);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM categories').get().n, 5);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n, 8);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM products WHERE is_demo = 1').get().n, 8);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM testimonials').get().n, 0);
});

test('settings padrão trazem o WhatsApp da loja e horários dos 7 dias', () => {
  const db = openDb(':memory:');
  seed(db);
  const s = getSettings(db);
  assert.equal(s.whatsapp, '5554994720227');
  assert.equal(s.instagram_url, 'https://www.instagram.com/loja_edy_modas/');
  assert.ok(Array.isArray(s.hours));
  assert.equal(s.hours.length, 7);
  assert.ok(Array.isArray(s.marquee));
  assert.ok(Array.isArray(s.stats));
});

test('setSettings grava e getSettings devolve valores com JSON convertido', () => {
  const db = openDb(':memory:');
  seed(db);
  setSettings(db, { address: 'Rua Nova, 10', marquee: ['a', 'b'] });
  const s = getSettings(db);
  assert.equal(s.address, 'Rua Nova, 10');
  assert.deepEqual(s.marquee, ['a', 'b']);
  assert.equal(s.whatsapp, '5554994720227');
});

test('seed não sobrescreve configuração já alterada pela loja', () => {
  const db = openDb(':memory:');
  seed(db);
  setSettings(db, { whatsapp: '5554992002830' });
  seed(db);
  assert.equal(getSettings(db).whatsapp, '5554992002830');
});
