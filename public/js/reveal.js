// Revelações ao entrar na tela (uma vez) e contagem dos números conforme a rolagem.
import { onReady, reducedMotion, clamp } from './core.js';

const WORD_STAGGER = 35;

function splitWords(el) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  let index = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.append(' ');
          else {
            const span = document.createElement('span');
            span.className = 'w';
            span.textContent = part;
            span.style.setProperty('--d', `${index++ * WORD_STAGGER}ms`);
            frag.append(span);
          }
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    }
  };
  walk(el);
}

function prepare(el) {
  const delay = Number(el.dataset.delay || 0);
  el.style.setProperty('--d', `${delay}ms`);
  if (el.dataset.reveal === 'lines') {
    const stagger = Number(el.dataset.stagger || 0);
    el.querySelectorAll('.line > span').forEach((span, i) => span.style.setProperty('--d', `${delay + i * stagger}ms`));
  }
  if (el.dataset.reveal === 'words') splitWords(el);
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  },
  { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
);

/** Prepara e observa todos os [data-reveal] dentro de `root`. Pode ser chamado de novo após renderizações. */
export function initReveals(root = document) {
  const els = [...root.querySelectorAll('[data-reveal]:not([data-reveal-ready])')];
  if (root !== document && root.matches?.('[data-reveal]:not([data-reveal-ready])')) els.unshift(root);
  for (const el of els) {
    el.dataset.revealReady = '1';
    prepare(el);
    if (reducedMotion) {
      el.classList.add('is-in');
      continue;
    }
    if (el.dataset.gate === 'ready') onReady(() => requestAnimationFrame(() => el.classList.add('is-in')));
    else onReady(() => observer.observe(el));
  }
}

// ---- Contagem dirigida pela rolagem: 0 quando o topo toca a base da tela, 1 quando o centro chega ao centro ----
const counters = new Set();
let ticking = false;
let lastRun = 0;

function updateCounters() {
  ticking = false;
  lastRun = performance.now();
  const vh = window.innerHeight;
  for (const c of counters) {
    const rect = c.el.getBoundingClientRect();
    const start = vh; // topo do elemento na base da tela
    const end = vh / 2 - rect.height / 2; // centro no centro
    const progress = clamp((start - rect.top) / (start - end), 0, 1);
    const value = Math.round(progress * c.value);
    if (value !== c.shown) {
      c.shown = value;
      c.el.textContent = c.format(value);
    }
  }
}
function requestUpdate() {
  if (ticking) return;
  ticking = true;
  const wait = Math.max(0, 30 - (performance.now() - lastRun)); // ~30 ms de intervalo
  setTimeout(() => requestAnimationFrame(updateCounters), wait);
}
addEventListener('scroll', requestUpdate, { passive: true });
addEventListener('resize', requestUpdate);

export function countUpOnScroll(el, value, format = (n) => n.toLocaleString('pt-BR')) {
  if (reducedMotion) {
    el.textContent = format(value);
    return;
  }
  counters.add({ el, value, format, shown: -1 });
  requestUpdate();
}
export function resetCounters() {
  counters.clear();
}

// ---- Texto que escurece palavra por palavra conforme a rolagem ----
const DIM = 0.16; // opacidade das palavras ainda "apagadas" (igual ao CSS)
const SOFT = 5; // quantas palavras ficam em transição ao mesmo tempo

export function initScrollText() {
  const blocks = [...document.querySelectorAll('[data-scroll-text]')].map((el) => {
    const words = [];
    const frag = document.createDocumentFragment();
    for (const part of el.textContent.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) frag.append(' ');
      else {
        const span = document.createElement('span');
        span.className = 'sw';
        span.textContent = part;
        words.push(span);
        frag.append(span);
      }
    }
    el.setAttribute('aria-label', el.textContent.trim());
    el.replaceChildren(frag);
    return { el, words, last: -1 };
  });
  if (!blocks.length || reducedMotion) return;

  let queued = false;
  const update = () => {
    queued = false;
    const vh = window.innerHeight;
    for (const b of blocks) {
      const rect = b.el.getBoundingClientRect();
      // começa quando o texto entra pela base da tela e termina com ele um pouco acima do centro
      const start = vh * 0.9;
      const end = vh * 0.42 - rect.height / 2;
      const progress = clamp((start - rect.top) / Math.max(1, start - end), 0, 1);
      if (Math.abs(progress - b.last) < 0.002) continue;
      b.last = progress;
      const head = progress * (b.words.length + SOFT);
      b.words.forEach((w, i) => {
        const p = clamp((head - i) / SOFT, 0, 1);
        w.style.opacity = (DIM + (1 - DIM) * p).toFixed(3);
      });
    }
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);
  update();
}
