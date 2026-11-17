// Ponto de entrada do site.
import './boot.js';
import { runLoader } from './loader.js';
import { initReveals, initScrollText } from './reveal.js';
import { initHeroZoom } from './heroZoom.js';
import { initCompactHeader, initHorizontalCollections, initShowcase, initManifesto } from './scrollfx.js';
import { initLiquidReveal } from './liquid.js';
import { initTilt } from './tilt.js';
import { initTracking } from './track.js';
import { loadSite, applySettings, renderMarquee, renderManifestoStats, renderVisit, renderCollections, renderProducts, renderPromotion, renderTestimonials } from './data.js';
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

// Conteúdo padrão primeiro (a página nunca fica vazia); a API atualiza em seguida.
function renderAll() {
  applySettings();
  applyOpenStatus();
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
