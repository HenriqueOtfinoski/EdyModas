// Painel da loja Edy Modas.
// Tudo que vem do banco entra na tela por textContent (nunca innerHTML).

const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------- utilidades
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key.startsWith('data-') || key.startsWith('aria-') || ['role', 'for', 'type', 'name', 'value', 'href', 'target', 'rel', 'title', 'placeholder', 'min', 'max', 'step', 'accept', 'rows', 'maxlength', 'inputmode', 'autocomplete', 'style'].includes(key)) el.setAttribute(key, value);
    else el[key] = value;
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}
function icon(id) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}
const money = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** "129,90" / "R$ 1.299,90" / "" → centavos (ou null) */
function parseMoney(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null; // vazio = "Consulte o valor"
  const t = raw.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(t) || /[^\d\s,.R$-]/i.test(raw)) return NaN; // tem texto que não é preço (ex.: "abc")
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
const centsToInput = (c) => (Number.isInteger(c) ? (c / 100).toFixed(2).replace('.', ',') : '');
/** Datas do SQLite ("2026-11-17 13:05:00", em UTC) → data local legível */
function fmtDate(sqlOrIso, withTime = true) {
  const iso = /T/.test(sqlOrIso) ? sqlOrIso : `${String(sqlOrIso).replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', withTime ? { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}
/** ISO → valor do <input type="datetime-local"> no fuso local */
function isoToLocalInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtPhone(digits) {
  const d = String(digits).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}
const waNumber = (digits) => {
  const d = String(digits).replace(/\D/g, '');
  return d.length <= 11 ? `55${d}` : d;
};

function toast(message, type = 'ok') {
  const el = h('div', { class: `toast${type === 'error' ? ' toast--error' : ''}`, text: message });
  $('toasts').append(el);
  setTimeout(() => el.remove(), 3800);
}

// ---------------------------------------------------------------- API
class AuthError extends Error {}
async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : form,
  });
  if (res.status === 401 && path !== '/login') {
    showLogin();
    throw new AuthError('Sessão expirada. Entre novamente.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.errors || [data.error || 'Algo deu errado. Tente de novo.']).join(' '));
  return data;
}
async function publicApi(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error('Não foi possível carregar.');
  return res.json();
}
function handle(err) {
  if (err instanceof AuthError) return;
  toast(err.message || 'Algo deu errado.', 'error');
}

// ---------------------------------------------------------------- login
function showLogin() {
  $('app').hidden = true;
  $('login').hidden = false;
  setTimeout(() => $('loginForm').elements.username.focus(), 50);
}
function showApp(user) {
  $('login').hidden = true;
  $('app').hidden = false;
  $('whoami').textContent = user.username;
  route();
}
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget.elements;
  const err = $('loginError');
  err.hidden = true;
  $('loginBtn').disabled = true;
  try {
    const user = await api('/login', { method: 'POST', body: { username: f.username.value.trim(), password: f.password.value } });
    f.password.value = '';
    showApp(user);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    $('loginBtn').disabled = false;
  }
});
$('logout').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

// ---------------------------------------------------------------- rotas
const VIEWS = {
  resumo: { title: 'Resumo', eyebrow: 'Como o site está indo', render: renderResumo },
  produtos: { title: 'Produtos', eyebrow: 'Peças que aparecem em "Novidades"', render: renderProdutos },
  colecoes: { title: 'Coleções', eyebrow: 'Cartões da faixa escura e filtros das novidades', render: renderColecoes },
  promocoes: { title: 'Promoções', eyebrow: 'O banner com contagem regressiva aparece só durante a promoção', render: renderPromocoes },
  depoimentos: { title: 'Depoimentos', eyebrow: 'Só aparecem no site quando houver ao menos um ativo', render: renderDepoimentos },
  contatos: { title: 'Contatos', eyebrow: 'Pessoas que deixaram nome e WhatsApp no site', render: renderContatos },
  config: { title: 'Configurações', eyebrow: 'Dados da loja que aparecem no site', render: renderConfig },
};
function route() {
  if ($('app').hidden) return;
  const key = location.hash.slice(1) in VIEWS ? location.hash.slice(1) : 'resumo';
  const view = VIEWS[key];
  document.querySelectorAll('.side__nav a').forEach((a) => (a.dataset.view === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  $('viewTitle').textContent = view.title;
  $('viewEyebrow').textContent = view.eyebrow;
  $('viewActions').replaceChildren();
  $('view').replaceChildren(h('div', { class: 'loading', text: 'Carregando…' }));
  document.title = `${view.title} — Painel Edy Modas`;
  view.render().catch(handle);
}
addEventListener('hashchange', route);
function setActions(...buttons) {
  $('viewActions').replaceChildren(...buttons);
}

// ---------------------------------------------------------------- confirmação
function confirmDialog(text, okLabel = 'Excluir') {
  return new Promise((resolve) => {
    const d = $('confirm');
    $('confirmText').textContent = text;
    $('confirmOk').textContent = okLabel;
    d.returnValue = '';
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

// ---------------------------------------------------------------- formulário genérico
/**
 * Abre o editor com os campos descritos e chama onSave(valores).
 * Tipos: text, textarea, money, select, checkbox, image, datetime, rating, number.
 */
function openEditor({ title, fields, values = {}, onSave }) {
  const dialog = $('editor');
  const box = $('editorFields');
  const error = $('editorError');
  error.hidden = true;
  $('editorTitle').textContent = title;
  const getters = {};

  const rows = [];
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'checkbox') {
      const input = h('input', { type: 'checkbox', name: f.name });
      input.checked = v === undefined ? !!f.default : !!v;
      getters[f.name] = () => input.checked;
      rows.push(h('label', { class: 'check' }, input, document.createTextNode(f.label)));
      continue;
    }
    if (f.type === 'image') {
      let url = v || null;
      const preview = h('div', { class: 'uploader__preview' });
      const paint = () => preview.replaceChildren(url ? h('img', { src: url, alt: '' }) : icon('i-upload'));
      paint();
      const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
      const status = h('small', { text: 'JPG, PNG ou WebP de até 5 MB.' });
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        const form = new FormData();
        form.append('image', file.files[0]);
        status.textContent = 'Enviando…';
        try {
          const res = await api('/upload', { method: 'POST', form });
          url = res.url;
          paint();
          status.textContent = 'Foto enviada.';
        } catch (ex) {
          status.textContent = ex.message;
          handle(ex);
        } finally {
          file.value = '';
        }
      });
      const remove = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { url = null; paint(); status.textContent = 'Sem foto.'; } }, 'Remover');
      getters[f.name] = () => url;
      rows.push(h('div', { class: 'field' }, h('span', { text: f.label }),
        h('div', { class: 'uploader' }, preview,
          h('div', { class: 'stack', style: 'gap:.5rem' },
            h('div', { class: 'uploader__btns' }, h('label', { class: 'btn btn--dark' }, icon('i-upload'), document.createTextNode('Escolher foto'), file), remove),
            status))));
      continue;
    }
    if (f.type === 'rating') {
      let rating = Number(v) || 5;
      const stars = [1, 2, 3, 4, 5].map((n) => h('button', { type: 'button', 'aria-label': `${n} estrela${n > 1 ? 's' : ''}`, onclick: () => { rating = n; paint(); } }, icon('i-star')));
      const paint = () => stars.forEach((s, i) => s.classList.toggle('is-on', i < rating));
      paint();
      getters[f.name] = () => rating;
      rows.push(h('div', { class: 'field' }, h('span', { text: f.label }), h('div', { class: 'rating-input' }, stars)));
      continue;
    }
    let input;
    if (f.type === 'textarea') input = h('textarea', { name: f.name, rows: f.rows || 4, maxlength: f.max });
    else if (f.type === 'select') {
      input = h('select', { name: f.name }, ...(f.options || []).map((o) => h('option', { value: o.value, text: o.label })));
    } else if (f.type === 'datetime') input = h('input', { type: 'datetime-local', name: f.name });
    else if (f.type === 'number') input = h('input', { type: 'number', name: f.name, step: '1' });
    else input = h('input', { type: 'text', name: f.name, maxlength: f.max, placeholder: f.placeholder, inputmode: f.type === 'money' ? 'decimal' : undefined });
    if (f.type === 'money') input.value = centsToInput(v);
    else if (f.type === 'datetime') input.value = v ? isoToLocalInput(v) : f.default ? isoToLocalInput(f.default) : '';
    else if (f.type === 'select') input.value = v === null || v === undefined ? '' : String(v);
    else input.value = v ?? f.default ?? '';
    getters[f.name] = () => {
      if (f.type === 'money') return parseMoney(input.value);
      if (f.type === 'datetime') return input.value ? new Date(input.value).toISOString() : '';
      if (f.type === 'number') return input.value === '' ? 0 : Number(input.value);
      if (f.type === 'select') return f.cast ? f.cast(input.value) : input.value;
      return input.value.trim();
    };
    rows.push(h('label', { class: 'field' }, h('span', { text: f.label }), input, f.hint ? h('small', { text: f.hint }) : null));
  }
  box.replaceChildren(...rows);

  const form = $('editorForm');
  const save = $('editorSave');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const out = {};
    for (const [k, get] of Object.entries(getters)) out[k] = get();
    error.hidden = true;
    save.disabled = true;
    try {
      await onSave(out);
      dialog.close();
    } catch (ex) {
      if (!(ex instanceof AuthError)) {
        error.textContent = ex.message;
        error.hidden = false;
      }
    } finally {
      save.disabled = false;
    }
  };
  dialog.showModal();
  setTimeout(() => box.querySelector('input:not([type=checkbox]):not([type=file]), textarea')?.focus(), 30);
}
document.querySelectorAll('#editor [data-close]').forEach((b) => b.addEventListener('click', () => $('editor').close()));

// ================================================================ RESUMO
let period = 30;
async function renderResumo() {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Período' },
    ...[7, 30, 90].map((d) => h('button', { type: 'button', 'aria-pressed': String(d === period), text: `${d} dias`, onclick: () => { period = d; route(); } })));
  setActions(seg);
  const [stats, leads] = await Promise.all([api(`/stats?days=${period}`), api('/leads')]);
  const t = stats.totals;
  const clicks = t.whatsapp + t.instagram + t.facebook + t.maps + t.products;
  const kpi = (label, value, ic, accent) => h('div', { class: `kpi${accent ? ' kpi--accent' : ''}` }, h('span', { class: 'kpi__label' }, ic ? icon(ic) : null, document.createTextNode(label)), h('span', { class: 'kpi__value', text: value.toLocaleString('pt-BR') }));
  const kpis = h('div', { class: 'kpis' },
    kpi('Visitas', t.visits, 'i-chart', true),
    kpi('Cliques no WhatsApp', t.whatsapp, 'i-whatsapp'),
    kpi('Cliques no Instagram', t.instagram),
    kpi('Cliques no Facebook', t.facebook),
    kpi('"Quero esse" em produtos', t.products, 'i-box'),
    kpi('"Como chegar"', t.maps),
    kpi('Contatos deixados', t.leads, 'i-users'));

  const chartCard = h('div', { class: 'card' },
    h('div', { class: 'card__title' }, h('span', { text: `Últimos ${period} dias` }), h('small', { class: 'chip', text: `${clicks.toLocaleString('pt-BR')} cliques de contato` })),
    chart(stats.byDay),
    h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:#d9d7d3' }), document.createTextNode('Visitas')), h('span', {}, h('i', { style: 'background:#e24d7f' }), document.createTextNode('Cliques de contato')), h('span', {}, h('i', { style: 'background:#0a0a0a;border-radius:50%' }), document.createTextNode('Contatos deixados'))));

  const recent = leads.slice(0, 6);
  const leadsCard = h('div', { class: 'card' },
    h('div', { class: 'card__title' }, h('span', { text: 'Contatos recentes' }), h('a', { class: 'chip', href: '#contatos', text: 'Ver todos' })),
    recent.length
      ? h('ul', { class: 'mini-list' }, ...recent.map((l) => h('li', {},
          h('span', {}, h('strong', { text: l.name }), h('br'), h('small', { text: `${l.interest || 'Geral'} · ${fmtDate(l.created_at)}` })),
          h('a', { class: 'wa-link', href: `https://wa.me/${waNumber(l.whatsapp)}`, target: '_blank', rel: 'noopener' }, icon('i-whatsapp'), document.createTextNode('Responder')))))
      : h('p', { class: 'row__sub', text: 'Ainda ninguém deixou contato pelo site.' }));

  $('view').replaceChildren(h('div', { class: 'stack' }, kpis, h('div', { class: 'two-cols' }, chartCard, leadsCard)));
}

function chart(days) {
  const W = 720, H = 220, PAD = { l: 30, r: 8, t: 10, b: 26 };
  const max = Math.max(4, ...days.map((d) => Math.max(d.visits, d.clicks, d.leads)));
  const step = (W - PAD.l - PAD.r) / days.length;
  const y = (v) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Gráfico de visitas, cliques e contatos por dia');
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    svg.append(n);
    return n;
  };
  for (const v of [0, Math.round(max / 2), max]) {
    el('line', { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), stroke: '#ecebe8', 'stroke-width': 1 });
    el('text', { x: PAD.l - 6, y: y(v) + 3, 'text-anchor': 'end' }, String(v));
  }
  const bw = Math.max(2, step * 0.62);
  days.forEach((d, i) => {
    const x = PAD.l + i * step + (step - bw) / 2;
    const g = document.createElementNS(SVG_NS, 'g');
    const tip = document.createElementNS(SVG_NS, 'title');
    tip.textContent = `${d.day.split('-').reverse().join('/')}: ${d.visits} visitas, ${d.clicks} cliques, ${d.leads} contatos`;
    g.append(tip);
    const rect = (yy, hh, fill, w = bw, xx = x) => { const r = document.createElementNS(SVG_NS, 'rect'); Object.entries({ x: xx, y: yy, width: w, height: Math.max(0, hh), rx: Math.min(3, w / 2), fill }).forEach(([k, v]) => r.setAttribute(k, v)); g.append(r); };
    rect(y(d.visits), H - PAD.b - y(d.visits), '#d9d7d3');
    rect(y(d.clicks), H - PAD.b - y(d.clicks), '#e24d7f', bw * 0.5, x + bw * 0.25);
    if (d.leads) { const c = document.createElementNS(SVG_NS, 'circle'); Object.entries({ cx: x + bw / 2, cy: y(d.leads) - 5, r: 3.5, fill: '#0a0a0a' }).forEach(([k, v]) => c.setAttribute(k, v)); g.append(c); }
    svg.append(g);
    const every = days.length > 31 ? 14 : days.length > 10 ? 5 : 1;
    if (i % every === 0 || i === days.length - 1) el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, d.day.slice(8, 10) + '/' + d.day.slice(5, 7));
  });
  return svg;
}

// ================================================================ PRODUTOS
let productFilter = { q: '', cat: '' };
async function renderProdutos() {
  const [products, categories] = await Promise.all([api('/products'), api('/categories')]);
  const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  setActions(h('button', { class: 'btn btn--dark', type: 'button', onclick: () => editProduct(null, categories) }, icon('i-plus'), document.createTextNode('Novo produto')));

  const search = h('input', { type: 'search', placeholder: 'Buscar pelo nome…', value: productFilter.q });
  const sel = h('select', {}, h('option', { value: '', text: 'Todas as coleções' }), ...categories.map((c) => h('option', { value: String(c.id), text: c.name })));
  sel.value = productFilter.cat;
  const grid = h('div', { class: 'products' });
  const draw = () => {
    const q = productFilter.q.toLowerCase();
    const list = products.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!productFilter.cat || String(p.category_id) === productFilter.cat));
    if (!list.length) {
      grid.replaceChildren(h('div', { class: 'empty', style: 'grid-column:1/-1' }, h('strong', { text: products.length ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado' }), document.createTextNode(products.length ? 'Tente outra busca ou coleção.' : 'Clique em "Novo produto" para cadastrar a primeira peça.')));
      return;
    }
    grid.replaceChildren(...list.map((p) => {
      const chips = h('div', { class: 'pcard__chips' },
        p.featured ? h('span', { class: 'chip chip--accent', text: 'Destaque' }) : null,
        !p.active ? h('span', { class: 'chip chip--off', text: 'Oculto' }) : null,
        p.is_demo ? h('span', { class: 'chip', text: 'Demonstração' }) : null);
      return h('article', { class: `pcard${p.active ? '' : ' is-off'}` },
        h('div', { class: 'pcard__img' }, p.image ? h('img', { src: p.image, alt: '', loading: 'lazy' }) : icon('i-box'), chips),
        h('div', { class: 'pcard__body' },
          h('span', { class: 'pcard__name', text: p.name }),
          h('span', { class: 'pcard__meta', text: [catName[p.category_id] || 'Sem coleção', p.sizes].filter(Boolean).join(' · ') }),
          h('span', { class: 'pcard__price', text: Number.isInteger(p.price_cents) ? money(p.price_cents) : 'Consulte o valor' })),
        h('div', { class: 'pcard__actions' },
          h('button', { class: 'icon-btn', type: 'button', title: p.active ? 'Ocultar do site' : 'Mostrar no site', 'aria-label': p.active ? 'Ocultar do site' : 'Mostrar no site', onclick: () => saveProduct(p, { ...p, active: !p.active }).then(route).catch(handle) }, icon(p.active ? 'i-eye' : 'i-eye-off')),
          h('button', { class: 'icon-btn', type: 'button', title: 'Editar', 'aria-label': `Editar ${p.name}`, onclick: () => editProduct(p, categories) }, icon('i-edit')),
          h('button', { class: 'icon-btn icon-btn--danger', type: 'button', title: 'Excluir', 'aria-label': `Excluir ${p.name}`, onclick: () => removeItem('products', p.id, `Excluir "${p.name}"? Essa ação não pode ser desfeita.`) }, icon('i-trash'))));
    }));
  };
  search.addEventListener('input', () => { productFilter.q = search.value; draw(); });
  sel.addEventListener('change', () => { productFilter.cat = sel.value; draw(); });
  draw();
  const demo = products.filter((p) => p.is_demo).length;
  $('view').replaceChildren(
    demo ? h('div', { class: 'card', style: 'margin-bottom:1rem;background:#fff6f9' }, h('strong', { text: `${demo} produto(s) de demonstração. ` }), document.createTextNode('Eles vieram com o site para mostrar o visual. Edite com as peças reais ou exclua.')) : '',
    h('div', { class: 'toolbar' }, h('label', { class: 'field' }, search), h('label', { class: 'field', style: 'max-width:16rem' }, sel)),
    grid);
}
function saveProduct(original, values) {
  const body = {
    name: values.name, description: values.description, price_cents: values.price_cents, sizes: values.sizes,
    category_id: values.category_id ?? null, image: values.image ?? null, featured: !!values.featured, active: !!values.active,
  };
  if (Number.isNaN(body.price_cents)) return Promise.reject(new Error('Preço inválido. Use, por exemplo, 129,90.'));
  return original ? api(`/products/${original.id}`, { method: 'PUT', body }) : api('/products', { method: 'POST', body });
}
function editProduct(p, categories) {
  openEditor({
    title: p ? 'Editar produto' : 'Novo produto',
    values: p || {},
    fields: [
      { name: 'image', label: 'Foto', type: 'image' },
      { name: 'name', label: 'Nome da peça', type: 'text', max: 120, placeholder: 'Ex.: Blusa de tricô rosa' },
      { name: 'description', label: 'Descrição curta', type: 'textarea', max: 500, rows: 3 },
      { name: 'price_cents', label: 'Preço (opcional)', type: 'money', placeholder: 'Ex.: 129,90', hint: 'Deixe vazio para mostrar "Consulte o valor".' },
      { name: 'sizes', label: 'Tamanhos', type: 'text', max: 80, placeholder: 'Ex.: P · M · G ou 36 ao 44' },
      { name: 'category_id', label: 'Coleção', type: 'select', options: [{ value: '', label: 'Sem coleção' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))], cast: (v) => (v ? Number(v) : null) },
      { name: 'featured', label: 'Destaque (aparece primeiro, com selo)', type: 'checkbox' },
      { name: 'active', label: 'Mostrar no site', type: 'checkbox', default: true },
    ],
    onSave: async (v) => {
      await saveProduct(p, v);
      toast(p ? 'Produto atualizado.' : 'Produto cadastrado.');
      route();
    },
  });
}
async function removeItem(table, id, text) {
  if (!(await confirmDialog(text))) return;
  try {
    await api(`/${table}/${id}`, { method: 'DELETE' });
    toast('Excluído.');
    route();
  } catch (ex) {
    handle(ex);
  }
}

// ================================================================ COLEÇÕES
async function renderColecoes() {
  const [categories, products] = await Promise.all([api('/categories'), api('/products')]);
  setActions(h('button', { class: 'btn btn--dark', type: 'button', onclick: () => editCategory(null, categories.length) }, icon('i-plus'), document.createTextNode('Nova coleção')));
  const count = (id) => products.filter((p) => p.category_id === id).length;
  $('view').replaceChildren(categories.length
    ? h('div', { class: 'rows' }, ...categories.map((c) => h('div', { class: 'row' },
        h('div', { class: 'row__thumb' }, c.image ? h('img', { src: c.image, alt: '', loading: 'lazy' }) : icon('i-grid')),
        h('div', { class: 'row__main' },
          h('span', { class: 'row__title' }, document.createTextNode(c.name), h('span', { class: 'chip', text: `${count(c.id)} produto(s)` }), h('span', { class: 'chip', text: `Ordem ${c.sort}` })),
          h('span', { class: 'row__sub', text: c.description || 'Sem descrição' })),
        h('div', { class: 'row__actions' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Editar ${c.name}`, onclick: () => editCategory(c) }, icon('i-edit')),
          h('button', { class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': `Excluir ${c.name}`, onclick: () => removeItem('categories', c.id, `Excluir a coleção "${c.name}"? Os ${count(c.id)} produto(s) dela continuam cadastrados, mas ficam sem coleção.`) }, icon('i-trash'))))))
    : h('div', { class: 'empty' }, h('strong', { text: 'Nenhuma coleção' }), document.createTextNode('Crie coleções como Feminino, Masculino e Infantil.')));
}
function editCategory(c, nextSort = 0) {
  openEditor({
    title: c ? 'Editar coleção' : 'Nova coleção',
    values: c || { sort: nextSort },
    fields: [
      { name: 'image', label: 'Foto do cartão', type: 'image' },
      { name: 'name', label: 'Nome', type: 'text', max: 60, placeholder: 'Ex.: Moda praia' },
      { name: 'description', label: 'Frase do cartão', type: 'textarea', max: 200, rows: 2 },
      { name: 'sort', label: 'Ordem (menor aparece primeiro)', type: 'number' },
    ],
    onSave: async (v) => {
      const body = { name: v.name, description: v.description, image: v.image, sort: Math.round(v.sort) || 0 };
      if (c) await api(`/categories/${c.id}`, { method: 'PUT', body: { ...body, slug: c.slug } });
      else await api('/categories', { method: 'POST', body });
      toast(c ? 'Coleção atualizada.' : 'Coleção criada.');
      route();
    },
  });
}

// ================================================================ PROMOÇÕES
function promoStatus(p) {
  const now = Date.now(), s = Date.parse(p.starts_at), e = Date.parse(p.ends_at);
  if (!p.active) return ['Desligada', 'chip--off'];
  if (now < s) return ['Agendada', 'chip--warn'];
  if (now >= e) return ['Encerrada', 'chip--off'];
  return ['No ar agora', 'chip--ok'];
}
async function renderPromocoes() {
  const promos = await api('/promotions');
  setActions(h('button', { class: 'btn btn--dark', type: 'button', onclick: () => editPromo(null) }, icon('i-plus'), document.createTextNode('Nova promoção')));
  $('view').replaceChildren(promos.length
    ? h('div', { class: 'rows' }, ...promos.map((p) => {
        const [label, cls] = promoStatus(p);
        return h('div', { class: 'row' },
          h('div', { class: 'row__thumb' }, p.image ? h('img', { src: p.image, alt: '', loading: 'lazy' }) : icon('i-tag')),
          h('div', { class: 'row__main' },
            h('span', { class: 'row__title' }, document.createTextNode(p.title), h('span', { class: `chip ${cls}`, text: label })),
            h('span', { class: 'row__sub', text: `${fmtDate(p.starts_at)} até ${fmtDate(p.ends_at)}${p.text ? ` · ${p.text}` : ''}` })),
          h('div', { class: 'row__actions' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Editar ${p.title}`, onclick: () => editPromo(p) }, icon('i-edit')),
            h('button', { class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': `Excluir ${p.title}`, onclick: () => removeItem('promotions', p.id, `Excluir a promoção "${p.title}"?`) }, icon('i-trash'))));
      }))
    : h('div', { class: 'empty' }, h('strong', { text: 'Nenhuma promoção' }), document.createTextNode('Crie uma promoção com data de início e fim: o site mostra o banner com contagem regressiva só nesse período.')));
}
function editPromo(p) {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86400000);
  openEditor({
    title: p ? 'Editar promoção' : 'Nova promoção',
    values: p || {},
    fields: [
      { name: 'title', label: 'Título', type: 'text', max: 120, placeholder: 'Ex.: Semana do jeans' },
      { name: 'text', label: 'Texto', type: 'textarea', max: 400, rows: 3, placeholder: 'Ex.: Calças e shorts com até 30% de desconto.' },
      { name: 'image', label: 'Imagem (opcional)', type: 'image' },
      { name: 'starts_at', label: 'Começa em', type: 'datetime', default: now.toISOString() },
      { name: 'ends_at', label: 'Termina em', type: 'datetime', default: week.toISOString() },
      { name: 'active', label: 'Promoção ligada', type: 'checkbox', default: true },
    ],
    onSave: async (v) => {
      if (!v.starts_at || !v.ends_at) throw new Error('Informe quando a promoção começa e termina.');
      await (p ? api(`/promotions/${p.id}`, { method: 'PUT', body: v }) : api('/promotions', { method: 'POST', body: v }));
      toast(p ? 'Promoção atualizada.' : 'Promoção criada.');
      route();
    },
  });
}

// ================================================================ DEPOIMENTOS
async function renderDepoimentos() {
  const list = await api('/testimonials');
  setActions(h('button', { class: 'btn btn--dark', type: 'button', onclick: () => editTestimonial(null) }, icon('i-plus'), document.createTextNode('Novo depoimento')));
  const stars = (n) => h('span', { class: 'stars', 'aria-label': `Nota ${n} de 5` }, ...[1, 2, 3, 4, 5].map((i) => { const s = icon('i-star'); if (i > n) s.classList.add('is-off'); return s; }));
  $('view').replaceChildren(list.length
    ? h('div', { class: 'rows' }, ...list.map((t) => h('div', { class: 'row' },
        h('div', { class: 'row__thumb' }, icon('i-star')),
        h('div', { class: 'row__main' },
          h('span', { class: 'row__title' }, document.createTextNode(t.name), stars(t.rating), t.active ? null : h('span', { class: 'chip chip--off', text: 'Oculto' })),
          h('span', { class: 'row__sub', text: `“${t.text}”` })),
        h('div', { class: 'row__actions' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Editar depoimento de ${t.name}`, onclick: () => editTestimonial(t) }, icon('i-edit')),
          h('button', { class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': `Excluir depoimento de ${t.name}`, onclick: () => removeItem('testimonials', t.id, `Excluir o depoimento de ${t.name}?`) }, icon('i-trash'))))))
    : h('div', { class: 'empty' }, h('strong', { text: 'Nenhum depoimento ainda' }), document.createTextNode('Cadastre depoimentos reais de clientes (por exemplo, dos Feedbacks do Instagram). A seção aparece no site quando houver pelo menos um.')));
}
function editTestimonial(t) {
  openEditor({
    title: t ? 'Editar depoimento' : 'Novo depoimento',
    values: t || {},
    fields: [
      { name: 'name', label: 'Nome do cliente', type: 'text', max: 80 },
      { name: 'text', label: 'Depoimento', type: 'textarea', max: 600, rows: 4 },
      { name: 'rating', label: 'Nota', type: 'rating' },
      { name: 'active', label: 'Mostrar no site', type: 'checkbox', default: true },
    ],
    onSave: async (v) => {
      await (t ? api(`/testimonials/${t.id}`, { method: 'PUT', body: v }) : api('/testimonials', { method: 'POST', body: v }));
      toast(t ? 'Depoimento atualizado.' : 'Depoimento cadastrado.');
      route();
    },
  });
}

// ================================================================ CONTATOS
async function renderContatos() {
  const leads = await api('/leads');
  setActions(h('a', { class: 'btn btn--ghost', href: '/api/admin/leads.csv' }, icon('i-download'), document.createTextNode('Baixar planilha (CSV)')));
  if (!leads.length) {
    $('view').replaceChildren(h('div', { class: 'empty' }, h('strong', { text: 'Nenhum contato ainda' }), document.createTextNode('Quando alguém preencher o formulário "Fale com a gente" ou a lista VIP, aparece aqui.')));
    return;
  }
  const search = h('input', { type: 'search', placeholder: 'Buscar por nome, WhatsApp ou interesse…' });
  const body = h('tbody');
  const draw = () => {
    const q = search.value.toLowerCase().trim();
    const list = leads.filter((l) => !q || [l.name, l.whatsapp, l.interest, l.message].join(' ').toLowerCase().includes(q));
    body.replaceChildren(...list.map((l) => h('tr', {},
      h('td', { text: fmtDate(l.created_at) }),
      h('td', {}, h('strong', { text: l.name })),
      h('td', {}, h('a', { class: 'wa-link', href: `https://wa.me/${waNumber(l.whatsapp)}`, target: '_blank', rel: 'noopener' }, icon('i-whatsapp'), document.createTextNode(fmtPhone(l.whatsapp)))),
      h('td', { text: l.interest || '—' }),
      h('td', { class: 'msg', text: l.message || '—' }),
      h('td', {}, h('span', { class: 'chip', text: l.source || 'site' })),
      h('td', {}, h('button', { class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': `Excluir contato de ${l.name}`, onclick: () => removeItem('leads', l.id, `Excluir o contato de ${l.name}? Use quando a pessoa pedir para remover os dados.`) }, icon('i-trash'))))));
  };
  search.addEventListener('input', draw);
  draw();
  $('view').replaceChildren(
    h('div', { class: 'toolbar' }, h('label', { class: 'field' }, search), h('span', { class: 'chip', style: 'align-self:center', text: `${leads.length} contato(s)` })),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ...['Data', 'Nome', 'WhatsApp', 'Interesse', 'Mensagem', 'Origem', ''].map((t) => h('th', { text: t })))),
      body)));
}

// ================================================================ CONFIGURAÇÕES
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
async function renderConfig() {
  setActions();
  const s = await api('/settings');
  const input = (name, value, attrs = {}) => h('input', { type: 'text', name, value: value ?? '', ...attrs });
  const saveBtn = (label, onclick) => h('div', { class: 'save-row' }, h('button', { class: 'btn btn--dark', type: 'button', onclick }, label));
  async function save(values, msg) {
    try {
      await api('/settings', { method: 'PUT', body: values });
      toast(msg);
    } catch (ex) {
      handle(ex);
    }
  }

  // Contatos e redes
  const f = {
    whatsapp: input('whatsapp', fmtPhone(s.whatsapp), { inputmode: 'tel' }),
    whatsapp_display: input('whatsapp_display', s.whatsapp_display),
    instagram_url: input('instagram_url', s.instagram_url),
    instagram_handle: input('instagram_handle', s.instagram_handle),
    facebook_url: input('facebook_url', s.facebook_url),
    address: input('address', s.address),
  };
  const contato = h('div', { class: 'card' },
    h('div', { class: 'card__title', text: 'Contato, redes e endereço' }),
    h('div', { class: 'grid-2' },
      h('label', { class: 'field' }, h('span', { text: 'WhatsApp (com DDD)' }), f.whatsapp, h('small', { text: 'Para onde vão todos os botões de WhatsApp do site.' })),
      h('label', { class: 'field' }, h('span', { text: 'WhatsApp como aparece no site' }), f.whatsapp_display),
      h('label', { class: 'field' }, h('span', { text: 'Link do Instagram' }), f.instagram_url),
      h('label', { class: 'field' }, h('span', { text: '@ do Instagram' }), f.instagram_handle),
      h('label', { class: 'field' }, h('span', { text: 'Link do Facebook' }), f.facebook_url),
      h('label', { class: 'field' }, h('span', { text: 'Endereço' }), f.address, h('small', { text: 'Usado também no botão "Como chegar".' }))),
    saveBtn('Salvar contato e endereço', () => {
      let digits = f.whatsapp.value.replace(/\D/g, '');
      if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
      save({ whatsapp: digits, whatsapp_display: f.whatsapp_display.value.trim(), instagram_url: f.instagram_url.value.trim(), instagram_handle: f.instagram_handle.value.trim(), facebook_url: f.facebook_url.value.trim(), address: f.address.value.trim() }, 'Contato e endereço salvos.');
    }));

  // Horários
  const hours = Array.isArray(s.hours) && s.hours.length === 7 ? s.hours : [[], [], [], [], [], [], []];
  const dayRows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const periods = hours[d] || [];
    const open = h('input', { type: 'checkbox' });
    open.checked = periods.length > 0;
    const t = (v) => h('input', { type: 'time', value: v || '' });
    const p1 = [t(periods[0]?.[0] || '08:00'), t(periods[0]?.[1] || '11:30')];
    const p2 = [t(periods[1]?.[0] || ''), t(periods[1]?.[1] || '')];
    const row = h('div', { class: `hours__row${open.checked ? '' : ' is-closed'}` },
      h('label', { class: 'check' }, open, document.createTextNode(DAYS[d])),
      h('div', { class: 'hours__periods' }, p1[0], document.createTextNode('às'), p1[1], document.createTextNode('e'), p2[0], document.createTextNode('às'), p2[1]));
    open.addEventListener('change', () => row.classList.toggle('is-closed', !open.checked));
    return { d, row, get: () => (open.checked ? [p1, p2].filter(([a, b]) => a.value && b.value).map(([a, b]) => [a.value, b.value]) : []) };
  });
  const horario = h('div', { class: 'card' },
    h('div', { class: 'card__title', text: 'Horário de funcionamento' }),
    h('p', { class: 'row__sub', style: 'margin-bottom:.75rem', text: 'O site mostra "Aberto agora" ou "Fechado" ao vivo com base nesses horários (horário de Brasília). O segundo período é opcional (ex.: tarde).' }),
    h('div', { class: 'hours' }, ...dayRows.map((r) => r.row)),
    saveBtn('Salvar horários', () => {
      const next = [[], [], [], [], [], [], []];
      for (const r of dayRows) next[r.d] = r.get();
      save({ hours: next }, 'Horários salvos.');
    }));

  // Letreiro
  const marquee = h('textarea', { rows: 6 });
  marquee.value = (s.marquee || []).join('\n');
  const letreiro = h('div', { class: 'card' },
    h('div', { class: 'card__title', text: 'Frases do letreiro' }),
    h('label', { class: 'field' }, h('span', { text: 'Uma frase por linha (até 12)' }), marquee, h('small', { text: 'Aparecem andando na seção A Loja, abaixo de "VISTA SEU ESTILO".' })),
    saveBtn('Salvar letreiro', () => save({ marquee: marquee.value.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12) }, 'Letreiro salvo.')));

  // Números
  const stats = (s.stats || []).slice(0, 6);
  while (stats.length < 3) stats.push({ value: 0, suffix: '', label: '' });
  const statRows = stats.map((st) => {
    const v = h('input', { type: 'number', min: '0', value: String(st.value ?? 0), 'aria-label': 'Número' });
    const suf = h('input', { type: 'text', maxlength: '4', value: st.suffix || '', placeholder: '+', 'aria-label': 'Sufixo' });
    const lab = h('input', { type: 'text', maxlength: '80', value: st.label || '', placeholder: 'Ex.: Anos vestindo Mariano Moro', 'aria-label': 'Legenda' });
    return { row: h('div', { class: 'stat-row' }, v, suf, lab), get: () => ({ value: Number(v.value) || 0, suffix: suf.value.trim(), label: lab.value.trim() }) };
  });
  const numeros = h('div', { class: 'card' },
    h('div', { class: 'card__title', text: 'Números da loja' }),
    h('p', { class: 'row__sub', style: 'margin-bottom:.75rem', text: 'Os três primeiros aparecem na seção A Loja, contando com a rolagem. Use só números verdadeiros.' }),
    h('div', { class: 'stat-rows' }, ...statRows.map((r) => r.row)),
    saveBtn('Salvar números', () => save({ stats: statRows.map((r) => r.get()).filter((x) => x.label) }, 'Números salvos.')));

  // Senha
  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const nw = h('input', { type: 'password', autocomplete: 'new-password' });
  const nw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const senha = h('div', { class: 'card' },
    h('div', { class: 'card__title', text: 'Senha do painel' }),
    h('div', { class: 'grid-2' },
      h('label', { class: 'field' }, h('span', { text: 'Senha atual' }), cur),
      h('span'),
      h('label', { class: 'field' }, h('span', { text: 'Nova senha' }), nw, h('small', { text: 'Pelo menos 10 caracteres.' })),
      h('label', { class: 'field' }, h('span', { text: 'Repita a nova senha' }), nw2)),
    saveBtn('Trocar senha', async () => {
      if (nw.value !== nw2.value) return toast('As senhas novas não são iguais.', 'error');
      try {
        await api('/password', { method: 'PUT', body: { current: cur.value, next: nw.value } });
        cur.value = nw.value = nw2.value = '';
        toast('Senha trocada.');
      } catch (ex) {
        handle(ex);
      }
    }));

  $('view').replaceChildren(h('div', { class: 'stack' }, contato, horario, letreiro, numeros, senha));
}

// ---------------------------------------------------------------- início
(async () => {
  try {
    const me = await api('/me');
    showApp(me);
  } catch {
    showLogin();
  }
})();
