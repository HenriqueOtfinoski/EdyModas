// Loader de abertura: conta 000 → 100 e sobe; só então as revelações do topo começam.
import { stopScroll, startScroll, setReady, reducedMotion } from './core.js';

const FILL_MS = 1300;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function runLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return setReady();
  const fill = document.getElementById('loaderFill');
  const count = document.getElementById('loaderCount');
  stopScroll('loader');

  const finish = () => {
    loader.remove();
    document.body.classList.remove('is-loading');
    startScroll('loader');
    setReady();
  };

  const exit = () => {
    if (reducedMotion) return finish();
    loader.classList.add('is-leaving');
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      finish();
    };
    loader.addEventListener('transitionend', (e) => e.target === loader && once());
    setTimeout(once, 1100); // garantia caso o transitionend não dispare
  };

  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / FILL_MS);
    const progress = Math.round(easeInOutCubic(t) * 100);
    fill.style.width = `${progress}%`;
    count.textContent = String(progress).padStart(3, '0');
    if (t < 1) requestAnimationFrame(step);
    else exit();
  };
  requestAnimationFrame(step);
}
