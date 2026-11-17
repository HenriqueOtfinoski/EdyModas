// Transição do topo para a seção "A Loja", dirigida pela rolagem (no estilo do "horizonte de luz" da referência):
// 1) textos, cartões e menu saem; 2) uma faixa de luz rosa atravessa a foto e revela o look rosa com óculos;
// 3) a luz sobe da base como um horizonte até a tela ficar branca; 4) a seção seguinte aparece por baixo.
// O "EDY MODAS" fica parado ao fundo o tempo todo.
import { reducedMotion, onReady, clamp } from './core.js';

const WIDE = matchMedia('(min-width: 1024px)');
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

export function initHeroZoom() {
  const root = document.documentElement;
  const pin = document.getElementById('heroPin');
  const hero = document.getElementById('inicio');
  const header = document.querySelector('.header');
  if (!pin || !hero || reducedMotion) return;
  const photo = hero.querySelector('.liquid');
  const flash = hero.querySelector('.hero__flash');
  const fading = [hero.querySelector('.hero__left'), hero.querySelector('.hero__right'), hero.querySelector('.hero__vignette')];

  let enabled = false;
  let active = false;
  let lastT = -1;

  function measure() {
    // mede sempre no estado "solto", com o hero no topo
    root.classList.remove('zoom-on');
    photo.style.transform = '';
    // liga quando o texto e os cartões cabem na tela (sobras de poucos pixels de enfeites não contam)
    const content = [hero.querySelector('.hero__left'), hero.querySelector('.hero__right')].filter(Boolean);
    const bottom = Math.max(0, ...content.map((el) => el.getBoundingClientRect().bottom + window.scrollY));
    const fits = bottom <= window.innerHeight - 16;
    enabled = WIDE.matches && fits;
    if (!enabled) return reset();
    root.classList.add('zoom-on');
    lastT = -1;
    update();
  }

  function reset() {
    root.classList.remove('zoom-on');
    for (const el of fading) if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
    header.style.opacity = '';
    header.style.pointerEvents = '';
    photo.style.transform = '';
    flash.style.opacity = '';
    hero.style.borderRadius = '';
    for (const prop of ['--sweep', '--band', '--glow']) hero.style.removeProperty(prop);
  }

  function update() {
    if (!enabled) return;
    const total = pin.offsetHeight - window.innerHeight;
    const t = total > 0 ? clamp(-pin.getBoundingClientRect().top / total, 0, 1) : 0;
    if (Math.abs(t - lastT) < 0.0005) return;
    lastT = t;

    // 1) textos, cartões e menu saem de cena logo no começo
    const out = 1 - clamp(t / 0.12, 0, 1);
    for (const el of fading) if (el) { el.style.opacity = out; el.style.pointerEvents = out < 0.05 ? 'none' : ''; }
    header.style.opacity = out;
    header.style.pointerEvents = out < 0.05 ? 'none' : '';

    // a câmera se aproxima devagar durante toda a cena
    photo.style.transform = `scale(${1 + 0.09 * easeInOut(t)})`;

    // 2) faixa de luz rosa atravessando a foto (da esquerda para a direita) e revelando o look rosa
    const s = easeInOut(clamp((t - 0.06) / 0.5, 0, 1));
    hero.style.setProperty('--sweep', (-25 + 150 * s).toFixed(2)); // posição da borda, em % da largura
    hero.style.setProperty('--band', Math.sin(Math.PI * s).toFixed(3)); // a faixa brilha no meio do caminho

    // 3) horizonte de luz subindo da base até cobrir a tela
    hero.style.setProperty('--glow', easeOut(clamp((t - 0.54) / 0.4, 0, 1)).toFixed(3));

    // 4) garantia: no fim a tela fica 100% branca antes de a seção seguinte entrar
    flash.style.opacity = clamp((t - 0.9) / 0.08, 0, 1);
    hero.style.borderRadius = t > 0.85 ? '0' : '';
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
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      measure();
      setTimeout(() => {
        header.style.transition = 'none'; // daqui em diante a opacidade do menu segue a rolagem, sem atraso
        measure();
      }, 1400);
    });
  });
}
