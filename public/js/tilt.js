// Inclinação 3D com brilho que segue o cursor, para qualquer elemento .tilt (inclusive os criados depois).
import { canHover, reducedMotion } from './core.js';

const MAX_DEG = 7;

export function initTilt() {
  if (!canHover || reducedMotion) return;
  let current = null;
  let frame = 0;
  let lastEvent = null;

  const reset = (el) => {
    el.classList.remove('is-tilting');
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  };

  const apply = () => {
    frame = 0;
    if (!current || !lastEvent) return;
    const rect = current.getBoundingClientRect();
    const x = (lastEvent.clientX - rect.left) / rect.width;
    const y = (lastEvent.clientY - rect.top) / rect.height;
    current.style.setProperty('--ry', `${(x - 0.5) * 2 * MAX_DEG}deg`);
    current.style.setProperty('--rx', `${(0.5 - y) * 2 * MAX_DEG}deg`);
    current.style.setProperty('--gx', `${x * 100}%`);
    current.style.setProperty('--gy', `${y * 100}%`);
  };

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest?.('.tilt') ?? null;
    if (el !== current) {
      if (current) reset(current);
      current = el;
      // primeiro quadro com transição longa (entrada suave); depois acompanha o cursor de perto
      if (current) requestAnimationFrame(() => requestAnimationFrame(() => current?.classList.add('is-tilting')));
    }
    if (!current) return;
    lastEvent = e;
    if (!frame) frame = requestAnimationFrame(apply);
  }, { passive: true });

  document.addEventListener('pointerleave', () => {
    if (current) reset(current);
    current = null;
  });
}
