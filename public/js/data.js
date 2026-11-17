// Dados do site: busca na API e desenha coleções, produtos, promoção, depoimentos e números.
// Tudo que vem do banco entra por textContent (nunca innerHTML).
import { initReveals, countUpOnScroll, resetCounters } from './reveal.js';
import { scrollToId } from './core.js';

const FALLBACK = {
  settings: {
    whatsapp: '5554994720227',
    whatsapp_display: '(54) 99472-0227',
    instagram_url: 'https://www.instagram.com/loja_edy_modas/',
    instagram_handle: '@loja_edy_modas',
    facebook_url: 'https://www.facebook.com/edi.rossarola',
    address: 'R. Rio Branco, 54 — Mariano Moro, RS',
    hours: null,
    marquee: ['Novidades toda semana', 'Moda feminina, masculina e infantil', 'Calçados', 'Cama, mesa e banho', 'Atendimento pelo WhatsApp', 'Há 20 anos em Mariano Moro'],
    stats: [
      { value: 20, suffix: '', label: 'Anos vestindo Mariano Moro' },
      { value: 2200, suffix: '+', label: 'Seguidores no Instagram' },
      { value: 7, suffix: '', label: 'Departamentos em um só lugar' },
      { value: 3, suffix: '', label: 'Públicos: feminino, masculino e infantil' },
    ],
  },
  categories: [
    { name: 'Feminino', slug: 'feminino', description: 'Looks para o dia a dia, o trabalho e aquele compromisso à noite.', image: '/assets/img/col-feminino.jpg' },
    { name: 'Masculino', slug: 'masculino', description: 'Camisetas, polos, jeans e sarja com caimento certo.', image: '/assets/img/col-masculino.jpg' },
    { name: 'Infantil', slug: 'infantil', description: 'Conforto para brincar e estilo para passear.', image: '/assets/img/col-infantil.jpg' },
    { name: 'Calçados', slug: 'calcados', description: 'Do tênis ao salto, para completar o look.', image: '/assets/img/col-calcados.jpg' },
    { name: 'Cama, mesa e banho', slug: 'cama-mesa-banho', description: 'Renove a casa sem precisar reformar.', image: '/assets/img/col-casa.jpg' },
  ],
  promotion: null,
  testimonials: [],
  open: { isOpen: false, label: '' },
};

export let site = FALLBACK;
let products = null; // null = ainda não carregou; [] = vazio ou falhou
let activeFilter = '';

const SVG_NS = 'http://www.w3.org/2000/svg';
export function icon(id) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('data-') || key.startsWith('aria-') || key === 'role') el.setAttribute(key, value);
    else el[key] = value;
  }
  el.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

export function waLink(text) {
  const number = String(site.settings.whatsapp || FALLBACK.settings.whatsapp).replace(/\D/g, '');
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export async function loadSite() {
  try {
    const res = await fetch('/api/site', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    site = {
      ...FALLBACK,
      ...data,
      settings: { ...FALLBACK.settings, ...data.settings },
      categories: data.categories?.length ? data.categories : FALLBACK.categories,
    };
  } catch {
    site = FALLBACK; // API fora do ar: o site continua com o conteúdo padrão
  }
  return site;
}

// ---------- Configurações espalhadas pela página ----------
const DAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmtTime = (hhmm) => {
  const [hh, mm] = String(hhmm).split(':').map(Number);
  return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
};
/** Resume os horários agrupando dias seguidos iguais: "Seg a sex 8h–11h30 e 13h30–18h · Sáb 8h–11h30". */
export function hoursSummary(hours) {
  if (!Array.isArray(hours) || hours.length !== 7) return '';
  const text = (day) => (Array.isArray(day) ? day.map((p) => `${fmtTime(p[0])}–${fmtTime(p[1])}`).join(' e ') : '');
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups = [];
  for (const d of order) {
    const t = text(hours[d]);
    const prev = groups.at(-1);
    if (prev && prev.text === t) prev.end = d;
    else groups.push({ start: d, end: d, text: t });
  }
  return groups
    .filter((g) => g.text)
    .map((g) => {
      const label = g.start === g.end ? DAY[g.start] : `${DAY[g.start]} a ${DAY[g.end].toLowerCase()}`;
      return `${label} ${g.text}`;
    })
    .join(' · ');
}

export function applySettings() {
  const s = site.settings;
  document.querySelectorAll('[data-wa]').forEach((a) => (a.href = waLink(a.dataset.wa)));
  document.querySelectorAll('[data-link="instagram"]').forEach((a) => (a.href = s.instagram_url));
  document.querySelectorAll('[data-link="facebook"]').forEach((a) => (a.href = s.facebook_url));
  document.querySelectorAll('[data-text]').forEach((el) => {
    const value = s[el.dataset.text];
    if (typeof value === 'string' && value) el.textContent = value;
  });
  const hours = hoursSummary(s.hours);
  if (hours) document.getElementById('footerHours').textContent = hours;
}

export function renderMarquee(el) {
  const items = (site.settings.marquee?.length ? site.settings.marquee : FALLBACK.settings.marquee).slice(0, 12);
  const group = () =>
    h('div', { class: 'marquee__group' }, ...items.map((text) => h('span', { class: 'marquee__item' }, document.createTextNode(text), icon('i-flower'))));
  const first = group();
  const second = group();
  second.setAttribute('aria-hidden', 'true');
  el.replaceChildren(first, second);
}

export function renderManifestoStats(el) {
  if (!el) return;
  resetCounters();
  const stats = (site.settings.stats?.length ? site.settings.stats : FALLBACK.settings.stats).slice(0, 3);
  el.replaceChildren(
    ...stats.map((s, i) => {
      const number = h('span', { text: '0' });
      const li = h('li', { 'data-reveal': 'up', 'data-delay': String(i * 100) },
        h('span', { class: 'manifesto__n' }, number, document.createTextNode(s.suffix || '')),
        h('span', { class: 'manifesto__l', text: s.label })
      );
      countUpOnScroll(number, Number(s.value) || 0);
      return li;
    })
  );
  initReveals(el);
}

/** Status de aberto/fechado da seção "Visite a loja". */
export function applyVisitStatus() {
  const { isOpen, label } = site.open || {};
  const status = document.getElementById('visitStatus');
  const dot = document.getElementById('visitDot');
  if (status && label) {
    status.textContent = label;
    dot.className = `status-dot ${isOpen ? 'is-open' : 'is-closed'}`;
  }
}

/** Seção "Visite a loja": status ao vivo, horários da semana e link do mapa. */
export function renderVisit() {
  const s = site.settings;
  applyVisitStatus();
  const list = document.getElementById('visitHours');
  const summary = hoursSummary(s.hours);
  if (list && summary) {
    const lines = summary.split(' · ');
    if (Array.isArray(s.hours) && !(Array.isArray(s.hours[0]) && s.hours[0].length)) lines.push('Dom fechado');
    list.replaceChildren(...lines.map((line) => h('li', { text: line })));
  }
  const maps = document.getElementById('mapsLink');
  if (maps) {
    // Busca só pelo endereço: com o nome da loja junto, o Google lista outras "Edy Modas" do Brasil.
    const address = String(s.address || FALLBACK.settings.address).replace(/\s*[—–]\s*/g, ', ').trim();
    const where = /mariano moro/i.test(address) ? address : `${address}, Mariano Moro, RS`;
    maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`;
  }
}

// ---------- Coleções ----------
export function renderCollections(el) {
  const cards = site.categories.map((c, i) => {
    const card = h('button', { class: 'col-card tilt', type: 'button', 'aria-label': `Ver peças de ${c.name}` },
      c.image ? h('img', { class: 'col-card__img', src: c.image, alt: '', loading: 'lazy' }) : null,
      h('div', { class: 'col-card__meta' }, h('span', { text: `Coleção — ${String(i + 1).padStart(2, '0')}` }), h('span', { class: 'col-card__badge' }, icon('i-arrow-ur'))),
      h('div', { class: 'col-card__bottom' }, h('h3', { text: c.name }), h('p', { text: c.description || '' }), h('span', { class: 'col-card__chip', text: 'Ver peças' }))
    );
    card.addEventListener('click', () => {
      setFilter(c.slug);
      scrollToId('novidades');
    });
    return h('li', { 'data-reveal': 'rise', 'data-delay': String(i * 90) }, card);
  });

  const cta = h('a', { class: 'col-card col-card--cta tilt', href: waLink('Olá! Vim pelo site e não achei o que procuro. Pode me ajudar?'), target: '_blank', rel: 'noopener', 'data-track': 'click_whatsapp:colecoes-cta' },
    h('span', { class: 'col-card__mark' }, icon('i-flower')),
    h('div', { class: 'col-card__meta' }, h('span', { text: 'Atendimento' }), h('span', { class: 'col-card__badge' }, icon('i-arrow-ur'))),
    h('div', { class: 'col-card__bottom' }, h('h3', { text: 'Não achou o que procura?' }), h('p', { text: 'Conte pra gente o que você precisa. A gente separa, manda foto e reserva.' }), h('span', { class: 'col-card__chip', text: 'Chamar no WhatsApp' }))
  );
  cards.push(h('li', { 'data-reveal': 'rise', 'data-delay': String(cards.length * 90) }, cta));
  el.replaceChildren(...cards);
  initReveals(el);
}

// ---------- Novidades ----------
const money = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function productCard(p, i) {
  const media = p.image
    ? h('div', { class: 'product__media' }, h('img', { src: p.image, alt: p.name, loading: 'lazy' }))
    : h('div', { class: 'product__media product__media--empty' }, icon('i-flower'));
  if (p.category_name) media.append(h('span', { class: 'product__tag', text: p.category_name }));
  if (p.featured) media.append(h('span', { class: 'product__tag product__tag--new', text: 'Destaque' }));

  const price = Number.isInteger(p.price_cents)
    ? h('span', { class: 'product__price', text: money(p.price_cents) })
    : h('span', { class: 'product__price product__price--ask', text: 'Consulte o valor' });
  const btn = h('a', { class: 'product__btn', href: waLink(`Olá! Vi no site a peça "${p.name}" e quero saber mais.`), target: '_blank', rel: 'noopener', 'data-track': `click_product:${p.name}` },
    icon('i-whatsapp'), document.createTextNode('Quero esse'));

  return h('li', { 'data-reveal': 'rise', 'data-delay': String((i % 4) * 80) },
    h('article', { class: 'product tilt' },
      media,
      h('div', { class: 'product__body' },
        h('h3', { class: 'product__name', text: p.name }),
        p.description ? h('p', { class: 'product__desc', text: p.description }) : null,
        p.sizes ? h('p', { class: 'product__sizes', text: `Tamanhos: ${p.sizes}` }) : null,
        h('div', { class: 'product__foot' }, price, btn)
      )
    )
  );
}

function emptyState(message) {
  return h('li', { class: 'products__empty' },
    h('p', { text: message }),
    h('a', { class: 'pill pill--dark pill--arrow', href: waLink('Olá! Vim pelo site e quero ver as novidades.'), target: '_blank', rel: 'noopener', 'data-track': 'click_whatsapp:novidades-vazio' },
      h('span', { class: 'pill__in' }, document.createTextNode('Pedir as novidades no WhatsApp '), h('span', { class: 'pill__badge' }, icon('i-arrow'))))
  );
}

function drawProducts() {
  const el = document.getElementById('products');
  if (!el || products === null) return;
  const list = activeFilter ? products.filter((p) => p.category_slug === activeFilter) : products;
  if (!products.length) el.replaceChildren(emptyState('As novidades chegam toda semana — e a gente mostra tudo primeiro no WhatsApp e no Instagram.'));
  else if (!list.length) el.replaceChildren(emptyState('Ainda não cadastramos peças desta coleção no site, mas tem muita coisa na loja. Chama a gente!'));
  else el.replaceChildren(...list.map(productCard));
  initReveals(el);
}

export function setFilter(slug) {
  activeFilter = slug || '';
  document.querySelectorAll('#filters .filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.slug === activeFilter)));
  drawProducts();
}

export async function renderProducts() {
  const filters = document.getElementById('filters');
  const chips = [{ name: 'Tudo', slug: '' }, ...site.categories].map((c) => {
    const b = h('button', { class: 'filter', type: 'button', text: c.name, 'aria-pressed': String(c.slug === activeFilter) });
    b.dataset.slug = c.slug;
    b.addEventListener('click', () => setFilter(c.slug));
    return b;
  });
  filters.replaceChildren(...chips);

  try {
    const res = await fetch('/api/products', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    products = Array.isArray(data) ? data : [];
  } catch {
    products = [];
  }
  drawProducts();
}

// ---------- Promoção com contagem regressiva ----------
export function renderPromotion() {
  const section = document.getElementById('promo');
  const promo = site.promotion;
  const end = promo ? Date.parse(promo.ends_at) : NaN;
  if (!promo || Number.isNaN(end) || end <= Date.now()) return;

  document.getElementById('promoTitle').textContent = promo.title;
  document.getElementById('promoText').textContent = promo.text || '';
  document.getElementById('promoCta').href = waLink(`Olá! Vi no site a promoção "${promo.title}" e quero aproveitar.`);
  const units = Object.fromEntries([...section.querySelectorAll('[data-unit]')].map((b) => [b.dataset.unit, b]));
  const pad = (n) => String(n).padStart(2, '0');

  const tick = () => {
    const left = end - Date.now();
    if (left <= 0) {
      clearInterval(timer);
      section.hidden = true;
      return;
    }
    const s = Math.floor(left / 1000);
    units.d.textContent = pad(Math.floor(s / 86400));
    units.h.textContent = pad(Math.floor((s % 86400) / 3600));
    units.m.textContent = pad(Math.floor((s % 3600) / 60));
    units.s.textContent = pad(s % 60);
  };
  const timer = setInterval(tick, 1000);
  tick();
  section.hidden = false;
  initReveals(section);
}

// ---------- Depoimentos ----------
export function renderTestimonials() {
  const section = document.getElementById('depoimentos');
  const list = site.testimonials || [];
  if (!list.length) return;
  const el = document.getElementById('testimonials');
  el.replaceChildren(
    ...list.slice(0, 6).map((t, i) => {
      const stars = h('span', { class: 'testimonial__stars', role: 'img', 'aria-label': `Nota ${t.rating} de 5` });
      for (let n = 1; n <= 5; n++) {
        const star = icon('i-star');
        if (n > t.rating) star.classList.add('is-off');
        stars.append(star);
      }
      return h('li', { 'data-reveal': 'rise', 'data-delay': String(i * 90) },
        h('figure', { class: 'testimonial' }, stars, h('blockquote', { class: 'testimonial__text', text: `“${t.text}”` }), h('figcaption', { class: 'testimonial__name', text: t.name })));
    })
  );
  section.hidden = false;
  initReveals(section);
}
