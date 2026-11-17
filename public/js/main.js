// Ponto de entrada do site.
import './boot.js';
import { runLoader } from './loader.js';
import { initReveals, initScrollText } from './reveal.js';
import { initHeroZoom } from './heroZoom.js';
import { initCompactHeader, initHorizontalCollections, initShowcase, initManifesto } from './scrollfx.js';
import { initLiquidReveal } from './liquid.js';
import { initTilt } from './tilt.js';
import { initTracking } from './track.js';
import { openStatus } from './hours.js';
import { site, loadSite, applySettings, renderMarquee, renderManifestoStats, renderVisit, applyVisitStatus, renderCollections, renderProducts, renderPromotion, renderTestimonials } from './data.js';
import { initHeader, applyOpenStatus, initNavMenu, initModal, initActions, initCarousel, initHeroParallax, initFab, initVip } from './ui.js';

const $ = (id) => document.getElementById(id);

runLoader();
initReveals();
initHeader();
initNavMenu();
initModal();
initActions();
initCarousel();
initHeroParallax();
initFab();
initVip();
initTilt();
initTracking();
initLiquidReveal($('liquid'), { brushRadius: 143, decay: 0.016 });
initHeroZoom();
initScrollText();
initCompactHeader();
initShowcase();
initManifesto();
const refreshCollections = initHorizontalCollections();

// Aberto/fechado é recalculado no navegador: com a página aberta, o status muda na hora certa
// (ex.: às 18h passa para "Fechado"), sem depender do horário em que a página foi carregada.
function refreshOpenStatus() {
  const live = openStatus(site.settings.hours);
  if (live.label) site.open = live;
  applyOpenStatus();
  applyVisitStatus();
}
setInterval(refreshOpenStatus, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshOpenStatus(); });

// Conteúdo padrão primeiro (a página nunca fica vazia); a API atualiza em seguida.
function renderAll() {
  applySettings();
  refreshOpenStatus();
  renderMarquee($('marquee'));
  renderManifestoStats($('manifestoStats'));
  renderVisit();
  renderCollections($('collections'));
  refreshCollections?.();
}
renderAll();
loadSite().then(() => {
  renderAll();
  renderProducts();
  renderPromotion();
  renderTestimonials();
});
