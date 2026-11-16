// Revelação líquida: o cursor (ou o dedo) pinta um rastro macio do segundo look sobre a foto base.
import { reducedMotion, canHover, onReady } from './core.js';

const FADE_FRAMES = 120;
const MAX_POINTS = 60;

export function initLiquidReveal(container, { brushRadius = 143, decay = 0.016 } = {}) {
  const canvas = container?.querySelector('canvas');
  const base = container?.querySelector('img');
  if (!canvas || !base || reducedMotion) return;

  const ctx = canvas.getContext('2d');
  const cover = document.createElement('canvas');
  const brush = document.createElement('canvas');
  const coverCtx = cover.getContext('2d');
  const brushCtx = brush.getContext('2d');
  const after = new Image();
  after.decoding = 'async';

  let dpr = 1, radius = 0, diam = 0, rect = container.getBoundingClientRect();
  let points = [];
  let last = null;
  let idle = FADE_FRAMES + 1;
  let running = false;
  let visible = true;
  let userActive = false; // o usuário já mexeu o ponteiro sobre a foto
  let demoUntil = 0;

  // A foto base usa object-position; o segundo look precisa do mesmo enquadramento.
  function focalPoint() {
    const [x = '50%', y = '50%'] = getComputedStyle(base).objectPosition.split(' ');
    return [parseFloat(x) / 100, parseFloat(y) / 100];
  }

  function drawCover() {
    if (!after.naturalWidth || !canvas.width) return;
    const cw = cover.width, ch = cover.height;
    const scale = Math.max(cw / after.naturalWidth, ch / after.naturalHeight);
    const w = after.naturalWidth * scale, h = after.naturalHeight * scale;
    const [fx, fy] = focalPoint();
    coverCtx.clearRect(0, 0, cw, ch);
    coverCtx.drawImage(after, (cw - w) * fx, (ch - h) * fy, w, h);
  }

  function resize() {
    rect = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    cover.width = canvas.width;
    cover.height = canvas.height;
    // em telas estreitas o pincel acompanha a largura para não cobrir a foto inteira
    radius = Math.min(brushRadius, rect.width * 0.3) * dpr;
    diam = Math.ceil(radius * 2);
    brush.width = diam;
    brush.height = diam;
    drawCover();
    last = null;
  }

  function stamp(x, y) {
    const c = diam / 2;
    brushCtx.globalCompositeOperation = 'source-over';
    brushCtx.clearRect(0, 0, diam, diam);
    const g = brushCtx.createRadialGradient(c, c, 0, c, c, radius);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.82)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    brushCtx.fillStyle = g;
    brushCtx.fillRect(0, 0, diam, diam);
    brushCtx.globalCompositeOperation = 'source-in';
    brushCtx.drawImage(cover, x - c, y - c, diam, diam, 0, 0, diam, diam);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(brush, x - c, y - c);
  }

  function pushPoint(x, y) {
    if (x < -radius || y < -radius || x > canvas.width + radius || y > canvas.height + radius) {
      last = null;
      return;
    }
    if (last) {
      const dx = x - last.x, dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(radius * 0.3, 1);
      const n = Math.min(Math.ceil(dist / step), MAX_POINTS);
      for (let i = 1; i <= n; i++) points.push({ x: last.x + (dx * i) / n, y: last.y + (dy * i) / n });
    } else points.push({ x, y });
    last = { x, y };
    wake();
  }

  // Demonstração automática: um "oito" suave em volta da modelo (telas de toque e convite inicial).
  function demoPoint(now) {
    const t = now / 1000;
    const [fx] = focalPoint();
    const cx = canvas.width * (canHover ? 0.5 : 0.5 + (fx - 0.5) * 0.15);
    const cy = canvas.height * 0.46;
    const ax = canvas.width * (canHover ? 0.2 : 0.3);
    const ay = canvas.height * 0.26;
    return { x: cx + Math.sin(t * 0.9) * ax, y: cy + Math.sin(t * 1.8 + 0.6) * ay };
  }
  const demoOn = (now) => visible && !userActive && (!canHover || now < demoUntil);

  function tick(now) {
    if (!running) return;
    if (demoOn(now) && after.complete && after.naturalWidth) {
      const p = demoPoint(now);
      pushPoint(p.x, p.y);
    }
    const drawing = points.length > 0;
    if (drawing) idle = 0;
    else if (++idle > FADE_FRAMES) {
      running = false;
      return;
    }
    const fade = drawing ? decay : Math.min(decay + idle * 0.004, 0.5);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${fade})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (drawing) {
      for (const p of points) stamp(p.x, p.y);
      points = [];
    } else if (idle === FADE_FRAMES) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(tick);
  }
  function wake() {
    if (running || !visible) return;
    running = true;
    idle = 0;
    requestAnimationFrame(tick);
  }

  function onPointer(e) {
    if (!after.naturalWidth) return;
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') userActive = true;
    else {
      // toque: assume o controle enquanto o dedo desliza e devolve à demonstração depois
      userActive = true;
      clearTimeout(onPointer.timer);
      onPointer.timer = setTimeout(() => {
        userActive = false;
        last = null;
        wake();
      }, 1800);
    }
    pushPoint((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr);
  }

  after.onload = () => {
    resize();
    onReady(() => {
      demoUntil = performance.now() + 4200; // convite inicial também no desktop
      wake();
    });
  };
  after.src = canvas.dataset.after;

  new ResizeObserver(resize).observe(container);
  addEventListener('scroll', () => (rect = container.getBoundingClientRect()), { passive: true });
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('pointerdown', onPointer, { passive: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  }).observe(container);
}
