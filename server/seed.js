import { getSettings, setSettings } from './db.js';

// Endereço e horários informados pela loja (editáveis no painel).
const WEEKDAY = [['08:00', '11:30'], ['13:30', '18:00']];

export const DEFAULT_SETTINGS = {
  whatsapp: '5554994720227',
  whatsapp_display: '(54) 99472-0227',
  instagram_url: 'https://www.instagram.com/loja_edy_modas/',
  instagram_handle: '@loja_edy_modas',
  facebook_url: 'https://www.facebook.com/edi.rossarola',
  address: 'R. Rio Branco, 54 — Mariano Moro, RS',
  // índice 0 = domingo … 6 = sábado; cada dia é uma lista de [abre, fecha]
  hours: [[], WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY, [['08:00', '11:30']]],
  marquee: [
    'Novidades toda semana',
    'Moda feminina, masculina e infantil',
    'Calçados',
    'Cama, mesa e banho',
    'Atendimento pelo WhatsApp',
    'Há 20 anos em Mariano Moro',
  ],
  stats: [
    { value: 20, suffix: '', label: 'Anos vestindo Mariano Moro' },
    { value: 2200, suffix: '+', label: 'Seguidores no Instagram' },
    { value: 7, suffix: '', label: 'Departamentos em um só lugar' },
    { value: 3, suffix: '', label: 'Públicos: feminino, masculino e infantil' },
  ],
};

const CATEGORIES = [
  { name: 'Feminino', slug: 'feminino', description: 'Looks para o dia a dia, o trabalho e aquele compromisso à noite.', image: '/assets/img/col-feminino.jpg' },
  { name: 'Masculino', slug: 'masculino', description: 'Camisetas, polos, jeans e sarja com caimento certo.', image: '/assets/img/col-masculino.jpg' },
  { name: 'Infantil', slug: 'infantil', description: 'Conforto para brincar e estilo para passear.', image: '/assets/img/col-infantil.jpg' },
  { name: 'Calçados', slug: 'calcados', description: 'Do tênis ao salto, para completar o look.', image: '/assets/img/col-calcados.jpg' },
  { name: 'Cama, mesa e banho', slug: 'cama-mesa-banho', description: 'Renove a casa sem precisar reformar.', image: '/assets/img/col-casa.jpg' },
];

// Produtos de demonstração (is_demo = 1): sem preço, para a loja substituir pelo painel.
const PRODUCTS = [
  { name: 'Blusa peplum bordô', description: 'Manga longa com cintura marcada.', sizes: 'P · M · G', category: 'feminino', image: '/assets/img/prod-01.jpg', featured: 1 },
  { name: 'Calça jeans wide leg', description: 'Cintura alta e lavagem clara.', sizes: '36 ao 46', category: 'feminino', image: '/assets/img/prod-02.jpg', featured: 1 },
  { name: 'Short jeans', description: 'O queridinho do verão, em várias lavagens.', sizes: '36 ao 44', category: 'feminino', image: '/assets/img/prod-03.jpg', featured: 0 },
  { name: 'Camiseta básica', description: 'Algodão macio em tons terrosos.', sizes: 'P ao GG', category: 'masculino', image: '/assets/img/prod-04.jpg', featured: 1 },
  { name: 'Polo em malha', description: 'Do trabalho ao fim de semana.', sizes: 'P ao GG', category: 'masculino', image: '/assets/img/prod-05.jpg', featured: 0 },
  { name: 'Calça de sarja', description: 'Corte reto, combina com tudo.', sizes: '38 ao 48', category: 'masculino', image: '/assets/img/prod-06.jpg', featured: 0 },
  { name: 'Conjunto infantil', description: 'Confortável para brincar o dia todo.', sizes: '2 ao 12', category: 'infantil', image: '/assets/img/prod-07.jpg', featured: 1 },
  { name: 'Jogo de toalhas', description: 'Toque macio e cores que combinam.', sizes: 'Banho e rosto', category: 'cama-mesa-banho', image: '/assets/img/prod-08.jpg', featured: 0 },
];

/** Popula o banco na primeira execução. Idempotente: nunca sobrescreve o que a loja já alterou. */
export function seed(db) {
  const current = getSettings(db);
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in current)) missing[key] = value;
  }
  setSettings(db, missing);

  if (current.seeded) return;

  const insCat = db.prepare(
    'INSERT OR IGNORE INTO categories (name, slug, description, image, sort) VALUES (?, ?, ?, ?, ?)'
  );
  CATEGORIES.forEach((c, i) => insCat.run(c.name, c.slug, c.description, c.image, i));

  const catId = db.prepare('SELECT id FROM categories WHERE slug = ?');
  const insProd = db.prepare(
    `INSERT INTO products (name, description, price_cents, sizes, category_id, image, featured, active, is_demo)
     VALUES (?, ?, NULL, ?, ?, ?, ?, 1, 1)`
  );
  for (const p of PRODUCTS) {
    insProd.run(p.name, p.description, p.sizes, catId.get(p.category)?.id ?? null, p.image, p.featured);
  }
  setSettings(db, { seeded: true });
}
