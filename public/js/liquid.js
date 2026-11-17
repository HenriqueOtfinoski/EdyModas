// Revelação líquida (como na referência Lumora): a foto base fica sempre visível e o cursor
// pinta um rastro macio da segunda foto ("depois") por cima; o rastro se desfaz aos poucos.
// Sem movimento, o rastro começa a apagar na hora e some devagar, em fade suave, até a foto voltar ao normal.
import { reducedMotion, canHover, onReady } from './core.js';

const HOLD_MS = 120; // tolerância mínima entre um movimento e outro do mouse (evita piscar ao mover devagar)
const FADE_MS = 2200; // parou de mexer: começa a apagar na hora e some devagar ao longo deste tempo
const IDLE_DECAY = 0.004; // esvaimento leve por quadro enquanto está parado (60 qps)
const FRAME_MS = 1000 / 60;
// já começa a clarear no primeiro instante e desacelera no final, para sumir com suavidade
const fadeCurve = (x) => Math.pow(1 - x, 1.35);
const MAX_POINTS = 60;

export function initLiquidReveal(container, { brushRadius = 143, decay = 0.016 } = {}) {
  const canvas = container?.querySelector('canvas');
  const base = container?.querySelector('img');
  if (!canvas || !base || reducedMotion) return;

  const ctx = canvas.getContext('2d');
  const cover = document.createElement('canvas'); // o "depois" já no enquadramento da tela
  const brush = document.createElement('canvas');
  const coverCtx = cover.getContext('2d');
  const brushCtx = brush.getContext('2d');
  const after = new Image();
  after.decoding = 'async';

  let dpr = 1, radius = 0, diam = 0, rect = container.getBoundingClientRect();
  let points = [];
  let last = null;
  let running = false;
  let prev = 0; // instante do quadro anterior
  let lastDraw = 0; // instante da última pincelada
  let visible = true;
  const pointer = { inside: false }; // há um mouse em uso (cancela a passada automática)
  let demo = null; // passada automática de convite

  // O "depois" usa o mesmo enquadramento (object-fit: cover + object-position) da foto base.
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
    radius = Math.min(brushRadius, rect.width * 0.34) * dpr; // em telas estreitas o pincel acompanha a largura
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
  }

  // esvaimento independente da taxa de quadros do monitor (60, 120, 144 Hz...)
  function erase(perFrame, dt) {
    const alpha = 1 - Math.pow(1 - perFrame, dt / FRAME_MS);
    if (alpha < 0.002) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // se o mouse volta a mexer no meio do fade, "grava" a transparência atual no desenho para não piscar
  function bakeOpacity() {
    const op = parseFloat(canvas.style.opacity);
    if (Number.isNaN(op) || op >= 1) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${1 - op})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    canvas.style.opacity = '';
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(Math.max(now - prev, 0), 50);
    prev = now;
    if (demo) {
      const t = (now - demo.start) / demo.duration;
      if (t >= 1 || pointer.inside) demo = null;
      else {
        // um "S" suave que passa pelo rosto e pelos ombros
        const e = t * t * (3 - 2 * t);
        pushPoint(canvas.width * (0.3 + 0.4 * e), canvas.height * (0.34 + 0.2 * Math.sin(e * Math.PI * 2)));
      }
    }

    if (points.length) {
      // em movimento: o rastro antigo se desfaz no ritmo da referência e as pinceladas novas entram
      bakeOpacity();
      erase(decay, dt);
      for (const p of points) stamp(p.x, p.y);
      points = [];
      lastDraw = now;
    } else {
      // parado: segura um instante, depois apaga tudo devagar (opacidade com curva suave)
      erase(IDLE_DECAY, dt);
      const idle = now - lastDraw;
      if (idle > HOLD_MS) {
        const p = Math.min(1, (idle - HOLD_MS) / FADE_MS);
        canvas.style.opacity = fadeCurve(p).toFixed(4);
        if (p >= 1) {
          ctx.clearRect(0, 0, canvas.width, canvas.height); // limpeza final: não sobra resíduo
          canvas.style.opacity = '';
          running = false;
          return;
        }
      }
    }
    requestAnimationFrame(tick);
  }
  function wake() {
    if (running || !visible) return;
    running = true;
    prev = lastDraw = performance.now();
    requestAnimationFrame(tick);
  }

  function onMove(e) {
    if (!after.naturalWidth) return;
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      pointer.inside = true;
    }
    // usa a proporção dentro do contêiner: continua certo quando a foto está com zoom da transição
    rect = container.getBoundingClientRect();
    pushPoint(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
    wake();
  }
  function startDemo(duration = 2600) {
    if (!visible || pointer.inside || !after.naturalWidth) return;
    last = null;
    demo = { start: performance.now(), duration };
    wake();
  }

  after.onload = () => {
    resize();
    onReady(() => {
      setTimeout(() => startDemo(), 1200); // convite: uma passada sozinha logo após a abertura
      // em telas de toque não há cursor: repete a passada de tempos em tempos
      if (!canHover) setInterval(() => startDemo(3200), 6500);
    });
  };
  after.src = canvas.dataset.after;
  if (!base.complete) base.addEventListener('load', resize, { once: true });

  new ResizeObserver(resize).observe(container);
  addEventListener('scroll', () => (rect = container.getBoundingClientRect()), { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => (pointer.inside = false));
  addEventListener('blur', () => (pointer.inside = false));
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  }).observe(container);
}
