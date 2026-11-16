// Ponto de entrada do site.
import './boot.js';
import { runLoader } from './loader.js';
import { initReveals } from './reveal.js';
import { initLiquidReveal } from './liquid.js';
import { initTilt } from './tilt.js';
import { initTracking } from './track.js';
import { loadSite, applySettings, renderMarquee, renderStats, renderCollections, renderProducts, renderPromotion, renderTestimonials } from './data.js';
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

// Conteúdo padrão primeiro (a página nunca fica vazia); a API atualiza em seguida.
function renderAll() {
  applySettings();
  applyOpenStatus();
  renderMarquee($('marquee'));
  renderStats($('stats'));
  renderCollections($('collections'));
}
renderAll();
loadSite().then(() => {
  renderAll();
  renderProducts();
  renderPromotion();
  renderTestimonials();
});

// A flor 3D só é baixada quando a seção se aproxima da tela.
const flowerWrap = $('flowerWrap');
const flowerObserver = new IntersectionObserver(
  ([entry]) => {
    if (!entry.isIntersecting) return;
    flowerObserver.disconnect();
    import('./flower3d.js')
      .then((m) => m.initFlower($('flower'), flowerWrap.querySelector('.flower__fallback')))
      .catch(() => {
        $('flower').hidden = true;
        flowerWrap.querySelector('.flower__fallback').hidden = false;
      });
  },
  { rootMargin: '60% 0px' }
);
flowerObserver.observe(flowerWrap);
