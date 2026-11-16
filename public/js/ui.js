// Interface: cabeçalho, menu em tela cheia, modal de contato, carrossel do hero, botão flutuante e convite VIP.
import { stopScroll, startScroll, scrollToId, canHover, reducedMotion, clamp } from './core.js';
import { site, setFilter } from './data.js';

const $ = (id) => document.getElementById(id);
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([tabindex="-1"]), select, textarea';

// ---------- Cabeçalho: relógio e status de aberto/fechado ----------
export function initHeader() {
  const clock = $('clock');
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  };
  tick();
  setInterval(tick, 1000);
  $('year').textContent = String(new Date().getFullYear());
}

export function applyOpenStatus() {
  const { isOpen, label } = site.open || {};
  if (!label) return;
  $('openLabel').textContent = label;
  $('openDot').className = `status-dot ${isOpen ? 'is-open' : 'is-closed'}`;
  $('menuStatus').textContent = label;
}

// ---------- Camadas (menu e modal) com foco preso e Esc ----------
function trapFocus(layer, e) {
  if (e.key !== 'Tab') return;
  const items = [...layer.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function makeLayer(layer, { onClosed } = {}) {
  let opener = null;
  let open = false;
  const onKey = (e) => {
    if (e.key === 'Escape') api.close();
    else trapFocus(layer, e);
  };
  const api = {
    get isOpen() {
      return open;
    },
    open(focusTarget) {
      if (open) return;
      open = true;
      opener = document.activeElement;
      layer.hidden = false;
      stopScroll(layer.id);
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('is-open')));
      document.addEventListener('keydown', onKey);
      setTimeout(() => (focusTarget?.() ?? layer.querySelector(FOCUSABLE))?.focus({ preventScroll: true }), 60);
    },
    close({ restoreFocus = true } = {}) {
      if (!open) return;
      open = false;
      layer.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
      startScroll(layer.id);
      setTimeout(() => {
        if (open) return;
        layer.hidden = true;
        onClosed?.();
      }, reducedMotion ? 0 : 350);
      if (restoreFocus) opener?.focus?.({ preventScroll: true });
    },
  };
  return api;
}

// ---------- Menu ----------
let menu;
export function initNavMenu() {
  const layer = $('navMenu');
  menu = makeLayer(layer);
  layer.querySelectorAll('.navmenu__nav button').forEach((b, i) => (b.style.transitionDelay = `${i * 45 + 80}ms`));
  $('menuOpen').addEventListener('click', () => menu.open(() => $('menuClose')));
  $('menuClose').addEventListener('click', () => menu.close());
}

// ---------- Modal de contato ----------
let modal;
let leadSource = 'modal';
const COPY = {
  default: ['Fale com a gente', 'Como podemos te ajudar?'],
  vip: ['Lista VIP', 'Receba as novidades primeiro.'],
};

function showModalView(view) {
  $('modalForm').hidden = view !== 'form';
  $('modalSuccess').hidden = view !== 'success';
  $('modalPrivacy').hidden = view !== 'privacy';
}

export function openModal(source = 'modal', view = 'form') {
  leadSource = source;
  const [eyebrow, title] = source === 'vip' ? COPY.vip : COPY.default;
  $('modalEyebrow').textContent = eyebrow;
  $('modalTitle').textContent = title;
  showModalView(view);
  modal.open(() => (view === 'form' ? $('leadForm').elements.name : $('modalClose')));
}

function setError(message) {
  const box = $('formError');
  box.textContent = message || '';
  box.hidden = !message;
}

async function submitLead(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const f = form.elements;
  const data = {
    name: f.name.value.trim(),
    whatsapp: f.whatsapp.value.trim(),
    interest: f.interest.value,
    message: f.message.value.trim(),
    consent: f.consent.checked,
    website: f.website.value,
    source: leadSource,
  };
  const digits = data.whatsapp.replace(/\D/g, '');
  f.name.classList.toggle('is-invalid', data.name.length < 2);
  f.whatsapp.classList.toggle('is-invalid', digits.length < 10 || digits.length > 13);
  if (data.name.length < 2) return setError('Informe seu nome.'), f.name.focus();
  if (digits.length < 10 || digits.length > 13) return setError('Informe um WhatsApp válido com DDD.'), f.whatsapp.focus();
  if (!data.consent) return setError('Marque a autorização para a gente poder te responder.'), f.consent.focus();
  setError('');

  const button = $('leadSubmit');
  const label = $('leadSubmitLabel');
  button.disabled = true;
  label.textContent = 'Enviando…';
  try {
    const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.errors?.join(' ') || 'Não foi possível enviar agora.');
    if (body.whatsappUrl) $('successWa').href = body.whatsappUrl;
    try {
      localStorage.setItem('edy_lead', '1');
    } catch { /* armazenamento indisponível */ }
    showModalView('success');
    $('successWa').focus({ preventScroll: true });
  } catch (err) {
    const offline = err instanceof TypeError;
    setError(offline ? 'Sem conexão com o servidor. Tente de novo ou chame direto no WhatsApp.' : err.message);
  } finally {
    button.disabled = false;
    label.textContent = 'Enviar';
  }
}

export function initModal() {
  const layer = $('modal');
  modal = makeLayer(layer, {
    onClosed() {
      $('leadForm').reset();
      setError('');
      layer.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
      showModalView('form');
    },
  });
  layer.addEventListener('pointerdown', (e) => e.target === layer && modal.close());
  $('modalClose').addEventListener('click', () => modal.close());
  $('successClose').addEventListener('click', () => modal.close());
  $('leadForm').addEventListener('submit', submitLead);
  $('privacyOpen').addEventListener('click', () => openModal('privacidade', 'privacy'));
}

// ---------- Cliques globais: rolar, abrir modal, filtrar ----------
export function initActions() {
  document.addEventListener('click', (e) => {
    const scroller = e.target.closest?.('[data-scroll]');
    const opener = e.target.closest?.('[data-modal]');
    const filter = e.target.closest?.('[data-filter]');
    if (!scroller && !opener && !filter) return;
    e.preventDefault();
    const wasMenu = menu?.isOpen;
    if (wasMenu) menu.close({ restoreFocus: false });
    if (opener) {
      if (opener.closest('#vip')) hideVip();
      setTimeout(() => openModal(opener.dataset.modal), wasMenu ? 120 : 0);
    } else if (filter) {
      setFilter(filter.dataset.filter);
      scrollToId('novidades');
    } else {
      scrollToId(scroller.dataset.scroll);
    }
  });
}

// ---------- Carrossel do cartão do hero ----------
const HERO_ITEMS = [
  { caption: 'Feminino', title: 'Looks para todo dia.' },
  { caption: 'Masculino', title: 'Caimento certo.' },
  { caption: 'Infantil', title: 'Conforto para brincar.' },
  { caption: 'Para a casa', title: 'Cama, mesa e banho.' },
];

export function initCarousel() {
  const slot = $('heroCardSlot');
  const dots = $('heroCardDots');
  let index = 0;
  let current = null;
  let timer = 0;

  const makeItem = (item) => {
    const el = document.createElement('div');
    el.className = 'hero-card__item';
    const cap = document.createElement('p');
    cap.className = 'hero-card__cap';
    cap.textContent = item.caption;
    const title = document.createElement('p');
    title.className = 'hero-card__title';
    title.textContent = item.title;
    el.append(cap, title);
    return el;
  };
  dots.replaceChildren(...HERO_ITEMS.map(() => document.createElement('i')));
  const paintDots = () => [...dots.children].forEach((d, i) => d.classList.toggle('is-active', i === index));

  const go = (step) => {
    index = (index + step + HERO_ITEMS.length) % HERO_ITEMS.length;
    const next = makeItem(HERO_ITEMS[index]);
    const outgoing = current;
    if (outgoing) {
      next.classList.add(step > 0 ? 'is-out-down' : 'is-out-up');
      slot.append(next);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        next.classList.remove('is-out-down', 'is-out-up');
        outgoing.classList.add(step > 0 ? 'is-out-up' : 'is-out-down');
      }));
      setTimeout(() => outgoing.remove(), 500);
    } else slot.append(next);
    current = next;
    paintDots();
  };
  const restart = () => {
    clearInterval(timer);
    if (!reducedMotion) timer = setInterval(() => go(1), 3600);
  };

  go(0);
  restart();
  $('heroNext').addEventListener('click', (e) => (e.stopPropagation(), go(1), restart()));
  $('heroPrev').addEventListener('click', (e) => (e.stopPropagation(), go(-1), restart()));
  $('heroCardRow').addEventListener('click', () => (go(1), restart()));
}

// ---------- Profundidade no hero: camadas se deslocam levemente com o cursor ----------
export function initHeroParallax() {
  if (!canHover || reducedMotion) return;
  const hero = $('inicio');
  let frame = 0;
  hero.addEventListener('pointermove', (e) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--px', clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1).toFixed(3));
      hero.style.setProperty('--py', clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1).toFixed(3));
    });
  }, { passive: true });
}

// ---------- Botão flutuante do WhatsApp (aparece depois do hero) ----------
export function initFab() {
  const fab = $('fab');
  new IntersectionObserver(([entry]) => fab.classList.toggle('is-visible', !entry.isIntersecting), { threshold: 0.15 }).observe($('inicio'));
}

// ---------- Convite Lista VIP: uma vez por sessão, a ~60% da página ----------
function hideVip() {
  const vip = $('vip');
  vip.classList.remove('is-visible');
  setTimeout(() => (vip.hidden = true), 600);
}
export function initVip() {
  const vip = $('vip');
  const seen = () => {
    try {
      return sessionStorage.getItem('edy_vip') || localStorage.getItem('edy_lead');
    } catch {
      return false;
    }
  };
  if (seen()) return;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0 || window.scrollY / max < 0.6 || modal?.isOpen || menu?.isOpen) return;
    removeEventListener('scroll', onScroll);
    try {
      sessionStorage.setItem('edy_vip', '1');
    } catch { /* segue sem lembrar */ }
    vip.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => vip.classList.add('is-visible')));
  };
  addEventListener('scroll', onScroll, { passive: true });
  $('vipClose').addEventListener('click', hideVip);
}
