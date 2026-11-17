// Efeitos dirigidos pela rolagem, no estilo da referência (unitedcarriers.com):
// cabeçalho compacto depois do topo, coleções com rolagem horizontal presa numa faixa escura,
// palavra gigante deslizando ao fundo e uma imagem em tela cheia que "abre" enquanto o título preenche.
import { reducedMotion, clamp } from './core.js';

const WIDE = matchMedia('(min-width: 1024px)');

/** 0 quando o contêiner encosta no topo da tela, 1 quando termina o percurso preso. */
export function pinProgress(pin) {
  const total = pin.offsetHeight - window.innerHeight;
  return total > 0 ? clamp(-pin.getBoundingClientRect().top / total, 0, 1) : 0;
}

// Tudo que depende da rolagem é atualizado num único quadro por evento de rolagem.
const updaters = new Set();
let queued = false;
function run() {
  queued = false;
  for (const fn of updaters) fn();
}
function request() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(run);
}
addEventListener('scroll', request, { passive: true });
addEventListener('resize', request);

// ---------- Cabeçalho compacto (aparece depois do topo, como na referência) ----------
export function initCompactHeader() {
  const header = document.querySelector('.header');
  const heroPin = document.getElementById('heroPin');
  if (!header || !heroPin) return;
  updaters.add(() => {
    const end = heroPin.offsetTop + heroPin.offsetHeight - 40;
    header.classList.toggle('is-compact', window.scrollY > end);
  });
  request();
}

// ---------- Coleções: faixa escura presa, cartões andando na horizontal ----------
export function initHorizontalCollections() {
  const section = document.getElementById('colecoes');
  const pin = section?.querySelector('.collections__pin');
  const viewport = section?.querySelector('.collections__viewport');
  const track = document.getElementById('collections');
  const giant = section?.querySelector('.collections__giant');
  const bar = section?.querySelector('.collections__bar i');
  if (!section || !pin || !track) return () => {};

  let enabled = false;
  let distance = 0;

  function measure() {
    enabled = WIDE.matches && !reducedMotion;
    section.classList.toggle('hs-on', enabled);
    track.style.transform = '';
    if (!enabled) {
      pin.style.height = '';
      return;
    }
    distance = Math.max(0, track.scrollWidth - viewport.clientWidth);
    // percurso vertical = quanto os cartões andam na horizontal (mais um respiro no fim)
    pin.style.height = `${window.innerHeight + distance + window.innerHeight * 0.35}px`;
    request();
  }

  updaters.add(() => {
    if (!enabled) return;
    const p = pinProgress(pin);
    const move = clamp(p / 0.86, 0, 1); // termina um pouco antes de soltar, para ler o último cartão
    track.style.transform = `translate3d(${-move * distance}px, 0, 0)`;
    if (giant) giant.style.transform = `translate3d(${8 - p * 46}%, 0, 0)`;
    if (bar) bar.style.transform = `scaleX(${move})`;
  });

  let timer = 0;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(measure, 120);
  };
  addEventListener('resize', later);
  WIDE.addEventListener('change', later);
  new ResizeObserver(later).observe(track);
  (document.fonts?.ready ?? Promise.resolve()).then(measure);
  measure();
  return measure; // chamado de novo quando os cartões são redesenhados
}

// ---------- Imagem em tela cheia: abre (zoom out) e o título preenche ----------
export function initShowcase() {
  const pin = document.querySelector('.showcase__pin');
  if (!pin || reducedMotion) return;
  const img = pin.querySelector('.showcase__img');
  const shade = pin.querySelector('.showcase__shade');
  const frame = pin.querySelector('.showcase__frame');
  updaters.add(() => {
    const p = pinProgress(pin);
    const rect = pin.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const e = 1 - Math.pow(1 - clamp(p / 0.75, 0, 1), 3);
    img.style.transform = `scale(${1.32 - 0.32 * e})`;
    shade.style.opacity = (0.25 + 0.4 * clamp(p / 0.5, 0, 1)).toFixed(3);
    // a moldura arredondada "abre" até ocupar a tela inteira
    const inset = (1 - e) * 6;
    frame.style.clipPath = `inset(${inset}% ${inset * 1.4}% round ${(1 - e) * 2}rem)`;
  });
  request();
}

// ---------- Manifesto: fotos abrem dentro do título e as faixas gigantes andam com a rolagem ----------
export function initManifesto() {
  const section = document.getElementById('a-loja');
  if (!section || reducedMotion) return;
  const title = section.querySelector('.manifesto__title');
  const pics = [...section.querySelectorAll('.manifesto__pic')];
  const big = document.getElementById('mrowBig');
  const small = document.getElementById('marquee');
  const band = section.querySelector('.manifesto__band');
  updaters.add(() => {
    const vh = window.innerHeight;
    const s = section.getBoundingClientRect();
    if (s.bottom < -50 || s.top > vh + 50) return;
    // fotos: abrem enquanto o título sobe da base até o terço de cima da tela
    const t = title.getBoundingClientRect();
    pics.forEach((pic, i) => {
      const start = vh * (0.95 - i * 0.08);
      const end = vh * (0.35 - i * 0.05);
      const p = clamp((start - t.top) / (start - end), 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      pic.style.setProperty('--pw', `${(0.5 + 1.25 * e).toFixed(3)}em`);
      pic.style.setProperty('--ps', (1.35 - 0.35 * e).toFixed(3));
    });
    // faixas: andam em sentidos opostos durante a passagem pela tela
    const b = band.getBoundingClientRect();
    const p = clamp((vh - b.top) / (vh + b.height), 0, 1);
    big.style.transform = `translate3d(${(-4 - p * 30).toFixed(2)}%, 0, 0)`;
    small.style.transform = `translate3d(${(-36 + p * 26).toFixed(2)}%, 0, 0)`;
  });
  request();
}
