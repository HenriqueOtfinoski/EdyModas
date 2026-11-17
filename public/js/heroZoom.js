// Transição do hero para a segunda seção, dirigida pela rolagem.
// Enquanto a página rola, o hero fica preso na tela e:
//   1. textos, cartões e menu saem de cena e a foto dá um zoom leve;
//   2. o "EDY MODAS" sobe para o centro e CRESCE, ganhando o branco da próxima seção;
//   3. quando uma letra cobre a tela inteira, o branco se dissolve e a segunda seção aparece no lugar.
// O texto é desenhado num canvas a cada quadro: cresce nítido em qualquer tamanho e sem atraso.
import { reducedMotion, onReady, clamp } from './core.js';

const WIDE = matchMedia('(min-width: 1024px)');
const BASE_ALPHA = 0.26; // opacidade do texto em repouso (igual ao CSS)
const FONT = (px) => `700 ${px}px Onest, sans-serif`;
const smooth = (x) => x * x * (3 - 2 * x);

export function initHeroZoom() {
  const root = document.documentElement;
  const pin = document.getElementById('heroPin');
  const hero = document.getElementById('inicio');
  const header = document.querySelector('.header');
  const fab = document.getElementById('fab');
  if (!pin || !hero || reducedMotion) return;
  const wm = hero.querySelector('.hero__watermark');
  const photo = hero.querySelector('.liquid');
  const flash = hero.querySelector('.hero__flash');
  const fading = [hero.querySelector('.hero__left'), hero.querySelector('.hero__right'), hero.querySelector('.hero__vignette')];

  const canvas = document.createElement('canvas');
  canvas.className = 'hero__zoomtext';
  canvas.setAttribute('aria-hidden', 'true');
  hero.append(canvas);
  const ctx = canvas.getContext('2d');

  let enabled = false;
  let active = false;
  let lastT = -1;
  let g = null; // geometria medida: texto, haste do "M", tamanhos

  /** Mede o texto em repouso e acha, dentro do "M", a haste vertical em que o zoom mira. */
  function measureText() {
    const node = [...wm.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
    if (!node) return null;
    const text = node.textContent;
    const size = parseFloat(getComputedStyle(wm).fontSize);
    const heroBox = hero.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    probe.canvas.width = 320;
    probe.canvas.height = 320;
    const F = 200, pad = 50;
    probe.font = FONT(F);
    const m = probe.measureText('M');
    const ascent = ((m.fontBoundingBoxAscent || F * 0.93) / F) * size;
    const cap = (m.actualBoundingBoxAscent / F) * size;

    // posição do "M" dentro do texto e da haste dentro do "M"
    const before = text.slice(0, text.indexOf('M'));
    probe.font = FONT(size);
    const mOffset = probe.measureText(before).width;
    probe.font = FONT(F);
    probe.clearRect(0, 0, 320, 320);
    probe.fillText('M', pad, 240);
    const row = probe.getImageData(0, Math.round(240 - m.actualBoundingBoxAscent / 2), 320, 1).data;
    let a = -1, b = -1;
    for (let x = 0; x < 320; x++) {
      const on = row[x * 4 + 3] > 128;
      if (on && a < 0) a = x;
      if (!on && a >= 0) { b = x; break; }
    }
    if (a < 0 || b < 0) return null;
    const k = size / F;
    const originX = box.left - heroBox.left; // início do texto
    const baseline = box.top - heroBox.top + ascent; // linha de base
    const stemDX = mOffset + ((a + b) / 2 - pad) * k; // do início do texto ao centro da haste
    const stemDY = -cap / 2; // da linha de base ao meio da haste
    const half = ((b - a) / 2) * k;
    const w = heroBox.width, h = heroBox.height;
    return {
      text, size, w, h, stemDX, stemDY,
      from: { x: originX + stemDX, y: baseline + stemDY }, // haste em repouso
      to: { x: w / 2, y: h / 2 }, // haste no centro da tela
      // escala em que a haste, já no centro, cobre a tela inteira (com folga)
      maxScale: clamp(((Math.hypot(w, h) / 2) / Math.max(half, 1)) * 1.25, 40, 600),
    };
  }

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(g.w * dpr);
    canvas.height = Math.round(g.h * dpr);
    canvas._dpr = dpr;
  }

  function drawText(z, alpha) {
    const dpr = canvas._dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (z <= 0) return;
    const scale = Math.pow(g.maxScale, z); // zoom exponencial = velocidade constante aos olhos
    const move = smooth(clamp(z / 0.5, 0, 1)); // a palavra sobe para o centro enquanto cresce
    const ax = g.from.x + (g.to.x - g.from.x) * move;
    const ay = g.from.y + (g.to.y - g.from.y) * move;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ax - g.stemDX * scale), dpr * (ay - g.stemDY * scale));
    ctx.font = FONT(g.size);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillText(g.text, 0, 0);
  }

  function clearStyles() {
    for (const el of fading) if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
    header.style.opacity = '';
    header.style.pointerEvents = '';
    photo.style.transform = '';
    wm.style.visibility = '';
    flash.style.opacity = '';
    hero.style.opacity = '';
    hero.style.visibility = '';
    hero.style.borderRadius = '';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function measure() {
    // mede sempre no estado "solto", sem nenhuma transformação aplicada
    root.classList.remove('zoom-on');
    clearStyles();
    const fits = hero.scrollHeight <= window.innerHeight + 2;
    g = WIDE.matches && fits ? measureText() : null;
    enabled = Boolean(g);
    lastT = -1;
    if (!enabled) return;
    root.classList.add('zoom-on');
    sizeCanvas();
    update();
  }

  function update() {
    if (!enabled) return;
    const total = pin.offsetHeight - window.innerHeight;
    const t = total > 0 ? clamp(-pin.getBoundingClientRect().top / total, 0, 1) : 0;
    // o botão do WhatsApp aparece junto com a segunda seção
    fab?.classList.toggle('is-visible', t > 0.92);
    if (Math.abs(t - lastT) < 0.0004) return;
    lastT = t;

    // 1) textos, cartões e menu saem de cena logo no começo
    const out = 1 - clamp(t / 0.16, 0, 1);
    for (const el of fading) if (el) { el.style.opacity = out; el.style.pointerEvents = out < 0.05 ? 'none' : ''; }
    header.style.opacity = out;
    header.style.pointerEvents = out < 0.05 ? 'none' : '';

    // 2) a foto dá um zoom leve
    photo.style.transform = `scale(${1 + 0.18 * t})`;

    // 3) o "EDY MODAS" cresce e ganha o branco da próxima seção
    const z = clamp((t - 0.015) / 0.78, 0, 1);
    wm.style.visibility = z > 0 ? 'hidden' : ''; // o canvas assume o desenho do texto
    drawText(z, BASE_ALPHA + (1 - BASE_ALPHA) * clamp(z / 0.38, 0, 1));

    // 4) tela toda branca e, em seguida, o branco se dissolve: a segunda seção já está no lugar, por baixo
    flash.style.opacity = clamp((t - 0.76) / 0.05, 0, 1);
    hero.style.borderRadius = t > 0.7 ? '0' : '';
    const visible = 1 - clamp((t - 0.84) / 0.16, 0, 1);
    hero.style.opacity = visible;
    hero.style.visibility = visible <= 0.001 ? 'hidden' : '';
  }

  function loop() {
    if (!active) return;
    update();
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(([entry]) => {
    const was = active;
    active = entry.isIntersecting;
    if (active && !was) requestAnimationFrame(loop);
  }).observe(pin);

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  });
  WIDE.addEventListener('change', measure);

  // mede depois que a fonte carregou e as animações de entrada terminaram
  onReady(() => {
    const fontReady = document.fonts?.load ? document.fonts.load(FONT(100), 'EDY MODAS').catch(() => {}) : Promise.resolve();
    fontReady.then(() => {
      measure();
      setTimeout(() => {
        header.style.transition = 'none'; // daqui em diante a opacidade do menu segue a rolagem, sem atraso
        measure();
      }, 1400);
    });
  });
}
