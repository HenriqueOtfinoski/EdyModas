// Medição anônima: visitas e cliques nos botões de contato (sem cookies, sem dados pessoais).
export function track(type, detail = '') {
  try {
    const body = JSON.stringify({ type, detail: String(detail).slice(0, 120) });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/events', blob)) {
      fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* medição nunca pode quebrar o site */
  }
}

export function initTracking() {
  try {
    if (!sessionStorage.getItem('edy_visit')) {
      sessionStorage.setItem('edy_visit', '1');
      track('visit', document.referrer ? new URL(document.referrer).hostname : 'direto');
    }
  } catch {
    track('visit');
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-track]');
    if (!el) return;
    const [type, ...rest] = el.dataset.track.split(':');
    track(type, rest.join(':'));
  });
}
