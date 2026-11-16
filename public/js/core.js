// Núcleo: scroll suave (Lenis), trava de rolagem, grade adaptativa e sinal de "pronto".
import Lenis from '/vendor/lenis.mjs';

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---- Scroll suave ----
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
export const lenis = new Lenis({ smoothWheel: !reducedMotion });
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ---- Trava de rolagem (loader, menu e modal podem se sobrepor) ----
const locks = new Set();
export function stopScroll(owner) {
  locks.add(owner);
  lenis.stop();
  const html = document.documentElement;
  html.style.position = 'relative';
  html.style.overflow = 'hidden';
  html.style.height = '100%';
}
export function startScroll(owner) {
  locks.delete(owner);
  if (locks.size) return;
  lenis.start();
  const html = document.documentElement;
  html.style.removeProperty('position');
  html.style.removeProperty('overflow');
  html.style.removeProperty('height');
}

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // pequeno atraso: deixa menus/modais liberarem a rolagem antes
  setTimeout(() => lenis.scrollTo(el, { duration: reducedMotion ? 0 : 1.2, immediate: reducedMotion }), 50);
}

// ---- Sinal de "pronto" (o loader saiu) ----
let ready = false;
const waiting = [];
export function onReady(fn) {
  if (ready) fn();
  else waiting.push(fn);
}
export function setReady() {
  if (ready) return;
  ready = true;
  document.documentElement.classList.add('is-ready');
  waiting.splice(0).forEach((fn) => fn());
}

// ---- Grade adaptativa: acima de 1920px o layout continua crescendo ----
export function applyAdaptiveGrid() {
  const FONT_BASE = 16, baseWidth = 1920, coef = 0.6666;
  const w = window.innerWidth;
  const widthReduction = ((baseWidth - w) / baseWidth) * 100;
  const size = FONT_BASE - (FONT_BASE * (widthReduction * coef)) / 100;
  if (size > FONT_BASE) document.documentElement.style.fontSize = `${size}px`;
  else document.documentElement.style.removeProperty('font-size');
}
applyAdaptiveGrid();
addEventListener('resize', applyAdaptiveGrid);

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
