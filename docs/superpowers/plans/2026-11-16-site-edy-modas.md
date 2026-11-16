# Site Edy Modas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site-vitrine da Edy Modas (estilo Lumora, com 3D e marketing) que leva o visitante ao WhatsApp/Instagram, com catálogo, promoções e depoimentos geridos por painel admin.

**Architecture:** Um servidor Express serve o site estático (`public/`), o painel (`admin/`) e uma API REST sobre SQLite (`node:sqlite`). O frontend é HTML/CSS/JS em módulos ES, sem build; Lenis e Three.js são servidos localmente de `node_modules` em `/vendor`. `createApp(db)` é uma fábrica para os testes subirem a API com banco em memória.

**Tech Stack:** Node 26 (ESM, `node:sqlite`, `node:test`, `crypto.scrypt`), Express 5, helmet, express-rate-limit, multer, Lenis 1.3, Three.js.

**Spec:** `docs/superpowers/specs/2026-11-16-site-edy-modas-design.md`

## Global Constraints

- Paleta: `--background:#ffffff --foreground:#141821 --ink:#0c1626 --navy:#284b73 --accent:#e24d7f --accent-from:#f2668f --accent-to:#c2356a --cream:#f6efe2 --surface:#f5f2ec --surface-2:#e8e3da --line:#e6e2da --muted:#8d8d8d`.
- Fonte Onest 400/500/600/700; raios: pill 9999px, card 2rem, card-sm 1.25rem, control .875rem; shell 88rem.
- Grade adaptativa: `html{font-size}` 0.833333vw (≤1920), 1.111111vw (≤1440), 1.5625vw (≤1024), 4.444444vw (≤640); acima de 1920 escala por JS com coef 0.6666.
- Breakpoints sm 640 / md 768 / lg 1024. Tudo em rem.
- Loader 1300 ms easeInOutCubic, contador com 3 dígitos; revelações só após `ready`.
- Revelação líquida: raio 143, decaimento 0.016, dpr ≤ 2, 120 quadros de fade, passo `max(r*0.3,1)`, máx. 60 pontos.
- `prefers-reduced-motion` e ausência de WebGL: alternativa estática.
- WhatsApp padrão `5554994720227`; Instagram `https://www.instagram.com/loja_edy_modas/`; Facebook `https://www.facebook.com/edi.rossarola`.
- Nenhum depoimento, número ou promoção inventado como real: produtos de seed têm `is_demo=1`; depoimentos começam vazios; seção oculta se vazia.
- Texto do site em português, tom acolhedor.
- Sem git (projeto não é repositório e commits não foram pedidos): os passos não incluem commit.

## Review Focus

1. Promoção com data final no passado ou datas inválidas → não aparece como ativa (teste na Task 2).
2. Lead com WhatsApp formatado `(54) 99472-0227`, nome com HTML/emoji → aceito, normalizado para dígitos, guardado como texto e nunca interpretado como HTML no painel (teste na Task 2; painel usa `textContent`).
3. Upload de arquivo não-imagem renomeado para `.jpg` → 400 (teste na Task 3).
4. Sessão ausente/expirada em rota admin → 401 e painel volta ao login (teste na Task 3).
5. API fora do ar ou produto sem preço/imagem → site continua de pé; produto mostra "Consulte" e imagem padrão (verificação na Task 6).

---

### Task 1: Projeto, banco e seed

**Files:** Create `package.json`, `.gitignore`, `.env.example`, `.env` (local), `server/db.js`, `server/seed.js`, `tests/db.test.js`

**Interfaces — Produces:**
- `openDb(path: string): DatabaseSync` — cria tabelas `settings(key PK, value)`, `categories(id, name, slug UNIQUE, image, sort)`, `products(id, name, description, price_cents NULL, sizes, category_id, image NULL, featured, active, is_demo, created_at)`, `promotions(id, title, text, image NULL, starts_at, ends_at, active)`, `testimonials(id, name, text, rating, active, created_at)`, `leads(id, name, whatsapp, interest, message, consent, source, created_at)`, `events(id, type, detail, created_at)`, `admin_users(id, username UNIQUE, password_hash)`, `sessions(token PK, user_id, expires_at)`.
- `seed(db)` — idempotente; settings padrão (`whatsapp`, `whatsapp_display`, `instagram_url`, `instagram_handle`, `facebook_url`, `address`, `hours` JSON por dia da semana 0–6 como lista de `["HH:MM","HH:MM"]`, `marquee` JSON, `stats` JSON `[{value,suffix,label}]`), 5 categorias (feminino, masculino, infantil, calcados, cama-mesa-banho), 8 produtos demo.
- `getSettings(db): Record<string, any>` (JSON já convertido), `setSettings(db, obj)`.

- [ ] Teste: `openDb(':memory:')` + `seed` duas vezes → 5 categorias, 8 produtos com `is_demo=1`, 0 depoimentos, `getSettings(db).whatsapp === '5554994720227'`, `hours` é array de 7.
- [ ] Rodar `node --test tests/` → falha; implementar; rodar → passa.

### Task 2: API pública

**Files:** Create `server/app.js`, `server/validate.js`, `server/routes/public.js`, `server/index.js`, `tests/public.test.js`, `tests/helpers.js`

**Interfaces — Produces:**
- `createApp(db, opts?: {uploadsDir?: string, rateLimit?: boolean}): express.Application`
- `tests/helpers.js`: `startTestApp(): Promise<{url, db, close}>` (banco em memória, porta 0, `rateLimit:false`).
- `validateLead(body): {ok:true, value:{name,whatsapp,interest,message,consent,source}} | {ok:false, errors:string[]}` — nome 2–80; whatsapp 10–13 dígitos após remover não-dígitos; interest ≤ 40; message ≤ 500; `consent === true`.
- Rotas: `GET /api/site` → `{settings, categories, promotion|null, testimonials, open: {isOpen, label}}`; `GET /api/categories`; `GET /api/products?category=<slug>&featured=1` (só `active=1`); `GET /api/promotions/active`; `GET /api/testimonials`; `POST /api/leads` → 201 `{ok:true, whatsappUrl}`; campo isca `website` preenchido → 201 sem gravar; `POST /api/events` `{type, detail}` com `type` em `visit|click_whatsapp|click_instagram|click_facebook|click_product` → 204.
- `openStatus(hours, now: Date): {isOpen: boolean, label: string}` em `server/validate.js` (fuso `America/Sao_Paulo`), ex.: `Aberto agora • fecha 18h30`, `Fechado • abre seg 8h30`.
- Estáticos: `/` → `public/`, `/admin` → `admin/`, `/uploads` → `data/uploads`, `/vendor/lenis.mjs` e `/vendor/three/` → `node_modules`. helmet com CSP `script-src 'self'`, `style-src 'self' 'unsafe-inline' fonts.googleapis.com`, `font-src fonts.gstatic.com`, `img-src 'self' data: blob:`.

- [ ] Testes: `/api/site` devolve settings e 5 categorias; `/api/products?category=feminino` só devolve dessa categoria e nunca inativos; lead válido com `(54) 99472-0227` → 201 e linha gravada com `54994720227`; lead sem consentimento / nome de 1 letra / whatsapp `123` → 400 com `errors`; nome `<img src=x onerror=1>` → 201 e gravado literal; isca preenchida → 201 e 0 linhas; promoção com `ends_at` ontem → `promotion:null`; com `starts_at` ontem e `ends_at` amanhã e `active=1` → devolvida; `ends_at:'lixo'` → null; evento com tipo fora da lista → 400; `openStatus` terça 10:00 → aberto, domingo → fechado.
- [ ] Rodar → falha; implementar; rodar → passa.

### Task 3: Auth e API admin

**Files:** Create `server/auth.js`, `server/upload.js`, `server/routes/admin.js`, `tests/admin.test.js`; modify `server/app.js`, `server/index.js`

**Interfaces — Produces:**
- `hashPassword(pw): string` (`scrypt$<salt hex>$<hash hex>`), `verifyPassword(pw, stored): boolean` (timing-safe), `ensureAdmin(db, username, password)`, `createSession(db, userId): token`, `requireAdmin(db)` middleware (cookie `edy_sid`, httpOnly, SameSite=Strict, 8 h).
- Rotas: `POST /api/admin/login` `{username,password}` → 200 + cookie | 401; `POST /api/admin/logout`; `GET /api/admin/me`; CRUD `GET/POST /api/admin/{products,categories,promotions,testimonials}`, `PUT/DELETE …/:id`; `GET/PUT /api/admin/settings`; `GET /api/admin/leads` e `GET /api/admin/leads.csv`; `GET /api/admin/stats?days=30` → `{totals:{visits,whatsapp,instagram,leads}, byDay:[{day,visits,clicks,leads}]}`; `POST /api/admin/upload` (campo `image`, ≤ 5 MB, assinatura JPEG/PNG/WebP verificada nos bytes) → `{url:'/uploads/<nome>'}`.
- Login limitado a 5 tentativas / 15 min por IP (desligado em teste).

- [ ] Testes: rota admin sem cookie → 401; login errado → 401; login certo → cookie e `/me` 200; criar/editar/apagar produto reflete em `/api/products`; produto com nome vazio → 400; upload de texto chamado `foto.jpg` → 400; upload de PNG mínimo válido → 200 com `url`; sessão expirada (expires_at no passado) → 401; `PUT settings` muda `GET /api/site`; `leads.csv` tem cabeçalho e a linha criada; stats conta eventos.
- [ ] Rodar → falha; implementar; rodar → passa. Subir `npm start` e conferir `GET /api/site` com curl.

### Task 4: Imagens

**Files:** Create `public/assets/img/*` (hero-a.jpg, hero-b.jpg, col-feminino.jpg, col-masculino.jpg, col-infantil.jpg, col-casa.jpg, prod-01…08.jpg, insta-1…6.jpg), `public/assets/logo-claro.jpeg`, `logo-escuro.jpeg`, `flor.png` (flor recortada, fundo transparente), `favicon`

- [ ] Conferir custo em créditos e avisar o usuário antes de gerar.
- [ ] Gerar par do hero com o mesmo enquadramento (look A claro/rosa; look B outro look), 4 coleções, 8 produtos em flat-lay, 6 do mosaico; olhar cada resultado antes de usar; redimensionar (hero ≤ 2000 px, demais ≤ 1200 px) e apontar os produtos do seed para os arquivos.

### Task 5: Site — base, loader, header, hero

**Files:** Create `public/index.html`, `public/css/site.css`, `public/js/main.js`, `js/core.js`, `js/reveal.js`, `js/loader.js`, `js/liquid.js`, `js/ui.js`

**Interfaces — Produces:**
- `core.js`: `lenis`, `stopScroll()`, `startScroll()`, `scrollToId(id)`, `onReady(fn)`, `setReady()`, `applyAdaptiveGrid()`, `canHover: boolean`, `reducedMotion: boolean`.
- `reveal.js`: `initReveals(root)` lê `data-reveal="up|lines|words|scale"`, `data-delay`, `data-stagger`, `data-gate="ready"`; `countUpOnScroll(el, value)`.
- `liquid.js`: `initLiquidReveal(container, {brushRadius:143, decay:0.016})` — ponteiro e toque; demonstração automática quando não há ponteiro; nada se `reducedMotion`.
- `ui.js`: `initHeader(site)`, `initNavMenu()`, `initModal()`, `openModal(source)`, `initCarousel()`, `waLink(text): string`.

- [ ] Implementar conforme a ordem de seções da spec (Loader → Header → Hero) e os parâmetros de Global Constraints.
- [ ] Verificar no navegador: contador 000→100 e saída do loader; revelação líquida segue o cursor e some após parar; menu e modal travam o scroll; 360 px sem rolagem horizontal.

### Task 6: Site — seções, dados, 3D e marketing

**Files:** Create `public/js/data.js`, `js/flower3d.js`, `js/tilt.js`, `js/track.js`, `public/robots.txt`, `public/sitemap.xml`; modify `index.html`, `site.css`, `main.js`

**Interfaces — Produces:**
- `data.js`: `loadSite(): Promise<site|null>`, `renderProducts(el, {category})`, `renderPromotion(el, promo)` (contagem regressiva; remove a seção se `null`), `renderTestimonials(el, list)` (remove se vazio), `applySettings(site)`.
- `flower3d.js`: `initFlower(canvas, fallbackImg)` — pétalas por código (creme `#f6efe2`, haste bronze), gira com o scroll, inclina com o cursor, pausa fora da tela; sem WebGL mostra `fallbackImg`.
- `tilt.js`: `initTilt(selector)` — `rotateX/Y` ≤ 8° + brilho; desligado sem hover.
- `track.js`: `track(type, detail)` via `navigator.sendBeacon('/api/events')`; registra `visit` uma vez por sessão e cliques em `[data-track]`.

- [ ] Implementar: letreiro, A Loja + flor 3D, faixa-pílula, Coleções, Novidades (filtro), Promoção, Diferenciais, Números, Depoimentos, Instagram, Rodapé, botão flutuante, convite Lista VIP (uma vez por sessão, ~60% da rolagem), modal gravando em `/api/leads` e oferecendo "Continuar no WhatsApp", SEO (meta, Open Graph, JSON-LD `ClothingStore`).
- [ ] Verificar: produtos aparecem e filtram; "Quero esse" abre `wa.me` com o nome da peça; com a API parada (servidor estático) a página não quebra; produto sem preço mostra "Consulte"; lead enviado aparece no banco; flor responde ao cursor; console sem erros.

### Task 7: Painel admin

**Files:** Create `admin/index.html`, `admin/admin.css`, `admin/admin.js`

- [ ] Login → Resumo (visitas, cliques, contatos, gráfico de barras por dia em SVG) → abas Produtos, Coleções, Promoções, Depoimentos, Contatos (com CSV), Configurações (contatos, endereço, horários, letreiro, números). Todo dado do banco entra via `textContent`. 401 em qualquer chamada → tela de login.
- [ ] Verificar: criar produto com foto e vê-lo no site; criar promoção ativa e ver o banner com contagem; cadastrar depoimento e ver a seção aparecer; lead com `<b>` no nome aparece literal.

### Task 8: Verificação final

- [ ] `node --test tests/` todo verde.
- [ ] Navegador em 360, 768 e desktop: cada seção, loader, hero, 3D, menu, modal, painel; `prefers-reduced-motion`; console sem erros.
- [ ] Escrever `README.md` curto: como rodar, trocar senha, trocar fotos, pendências de conteúdo.
