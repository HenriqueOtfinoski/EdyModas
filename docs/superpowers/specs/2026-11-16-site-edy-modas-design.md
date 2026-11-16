# Site Edy Modas — Design

Data: 2026-11-16 · Status: aguardando aprovação

## 1. Intenção e porquê

Criar o site da **Edy Modas** (Mariano Moro – RS, há 20 anos; moda masculina, feminina e infantil, calçados, cama/mesa/banho). O site é uma **vitrine**: precisa prender a atenção, fazer o visitante rolar a página e terminar no **WhatsApp** ou no **Instagram** da loja. Não vende online.

A maior parte do público chega pelo link do Instagram, no celular. O site tem que ser bonito e rápido ali primeiro.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Visual e movimento no estilo da referência "Lumora": fonte Onest, loader 000→100, hero com revelação líquida no cursor, cartões escuros, animações de mola, grade adaptativa em rem, scroll suave (Lenis).
- Elementos 3D que respondem ao usuário.
- Catálogo, promoções e depoimentos editáveis pela loja num painel com login.
- Ferramentas de marketing que levam ao contato (seção 6).
- Funcionar bem de 360 px a telas grandes.

**Não-objetivos (ficam fora desta versão)**
- Carrinho, pagamento, estoque, cadastro de clientes.
- Puxar o feed do Instagram automaticamente (exige token da Meta).
- Publicar o site na internet (deploy) — roda localmente; hospedagem é etapa seguinte.

**Anti-objetivos (seriam fracasso mesmo funcionando)**
- Site pesado que trava no celular.
- Depoimentos, números ou promoções inventados apresentados como reais.
- Pop-ups agressivos que irritam antes de o visitante ver a loja.

## 3. Abordagens

| Decisão | Opções consideradas | Escolha (do usuário) |
|---|---|---|
| Escopo do backend | Vitrine + painel admin · Landing + captura de contatos · E-commerce completo | **Vitrine + painel admin** — atende ao objetivo de gerar contato e deixa a loja trocar produtos sem programador |
| Stack | Node + Express + SQLite · Next.js + Prisma · Python (FastAPI) | **Node + Express + SQLite** — frontend puro igual à referência, um servidor só |
| Imagens | IA agora, reais depois · Só reais · Só IA | **IA agora, reais depois** — Higgsfield/Magnific para o lançamento; fotos reais entram pelo painel |
| Identidade | Logo da flor · Logo cursiva do Instagram · As duas | **Logo da flor** (arquivos da pasta) |

## 4. Identidade visual

Estrutura de cores da referência, trocando o acento laranja pelo rosa da logo e o preto por um azul-marinho quase preto.

```
--background:#ffffff   --foreground:#141821
--ink:#0c1626          (cartões, loader, rodapé, overlays)
--navy:#284b73         (azul da logo, detalhes)
--accent:#e24d7f       --accent-from:#f2668f   --accent-to:#c2356a
--cream:#f6efe2        (pétalas, superfícies quentes)
--surface:#f5f2ec      --surface-2:#e8e3da
--line:#e6e2da         --muted:#8d8d8d
```
Fonte: Onest 400/500/600/700. Raios, breakpoints, grade adaptativa, molas e tempos de animação: iguais ao prompt de referência.

## 5. Página (ordem das seções)

```
[Loader]      fundo marinho-escuro · flor + "Edy Modas" · "Há 20 anos vestindo Mariano Moro." · 000→100
[Header]      logo · Início  Coleções  Novidades  A Loja  Contato · chip "Aberto agora • fecha 18h30" · Menu
[Hero]        foto em tela cheia; o cursor/dedo "pinta" um segundo look por cima (revelação líquida)
              marca-d'água EDY MODAS · "Moda para toda / a família, / há 20 anos."
              ★★★★★ "2.200+ seguidores no Instagram" · [Chamar no WhatsApp →] [Ver coleções]
              cartão-carrossel (Feminino / Masculino / Infantil) · "Você encontra aqui": 7 departamentos
              barra: Há 20 anos · Mariano Moro — RS · Role para explorar ↓
[Faixa]       letreiro rolante com chamadas (editável no painel)
[A Loja]      flor 3D (Three.js) no lugar do globo · texto com revelação por palavra · Instagram / Facebook / WhatsApp
[Faixa-pílula] Vista · Seu · → · Estilo
[Coleções]    4 cartões escuros com foto e inclinação 3D: Feminino, Masculino, Infantil, Cama/Mesa/Banho
[Novidades]   grade de produtos vinda do banco · filtro por categoria · botão "Quero esse" → WhatsApp com mensagem pronta
[Promoção]    banner da campanha ativa com contagem regressiva (só aparece se houver promoção ativa)
[Diferenciais] 4 linhas com hover: Atendimento pelo WhatsApp · Lives com novidades · Moda para toda a família · Cama, mesa e banho
[Números]     painel escuro com contagem no scroll: 20 anos · 2.200+ seguidores · 7 departamentos (editáveis)
[Depoimentos] cartões vindos do banco (só aparece se houver depoimentos cadastrados)
[Instagram]   mosaico de fotos + "Seguir @loja_edy_modas"
[Rodapé]      "Gostou de alguma peça? Chama a gente." · colunas · endereço/horário · marca-d'água
[Fixo]        botão flutuante do WhatsApp (aparece depois do hero)
[Overlays]    menu em tela cheia · modal "Fale com a gente"
```

**Hero — revelação líquida:** duas fotos com o mesmo enquadramento (look A sempre visível, look B revelado no rastro). Mesma mecânica da referência (raio 143, decaimento 0,016). No celular, o rastro segue o dedo e, sem toque, um movimento automático suave demonstra o efeito. Com `prefers-reduced-motion`, fica só a foto base.

**3D (decisão minha):**
1. **Flor 3D** em Three.js, modelada por código a partir da logo (pétalas creme, haste bronze): gira com o scroll e inclina na direção do cursor. Leve, sem baixar modelo. Sem WebGL → imagem da logo.
2. **Inclinação 3D com brilho** nos cartões de coleções e produtos (CSS 3D, segue o cursor).
3. **Profundidade no hero**: marca-d'água e cartões em camadas com parallax leve.

Preferi código próprio a um modelo 3D gerado por IA porque carrega instantaneamente e não trava celular.

## 6. Ferramentas de marketing

- **WhatsApp com mensagem pronta** em todo CTA ("Olá! Vi no site a peça *X* e quero saber mais").
- **Botão flutuante** do WhatsApp e **CTA repetido** a cada duas seções.
- **Promoção com contagem regressiva** (urgência real: só campanhas cadastradas pela loja).
- **Lista VIP**: formulário curto (nome + WhatsApp + interesse) "receba as novidades antes de todo mundo", com caixa de consentimento (LGPD). Aparece no modal e uma única vez como convite discreto após ~60% da rolagem.
- **Prova social**: números reais e depoimentos reais cadastrados.
- **Medição**: cada clique em WhatsApp/Instagram/Facebook e cada envio de formulário é registrado; o painel mostra visitas, cliques e contatos por dia.
- **SEO local**: título/descrição, Open Graph (prévia bonita ao compartilhar), dados estruturados `ClothingStore` com endereço e horário, sitemap.

## 7. Arquitetura

```
Loja Edy Modas/
  server/
    index.js            Express: estáticos + API + segurança
    db.js               SQLite (módulo nativo node:sqlite — Node 26 já instalado), criação de tabelas e seed
    routes/public.js    leitura do site, leads, eventos
    routes/admin.js     login e CRUD
    middleware/         auth, validação, limite de requisições, upload
  public/               site (index.html, css/, js/ em módulos ES, assets/)
  admin/                painel (HTML/CSS/JS puro, mesma identidade)
  data/                 edy.db e uploads/ (fora do git)
  tests/                testes da API (node:test)
  .env.example          ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET, PORT
```

Decisão minha: o site não será um arquivo HTML único como no prompt de referência — com catálogo, painel e 3D, separar em `index.html` + CSS + módulos JS (sem etapa de build) fica mais fácil de manter. Bibliotecas por CDN/importmap: Lenis e Three.js.

**Banco (SQLite)**

| Tabela | Campos principais |
|---|---|
| `settings` | chave/valor: WhatsApp, Instagram, Facebook, endereço, horários, textos do letreiro, números |
| `categories` | nome, slug, imagem, ordem |
| `products` | nome, descrição, preço (opcional), tamanhos, categoria, imagem, destaque, ativo |
| `promotions` | título, texto, imagem, início, fim, ativa |
| `testimonials` | nome, texto, nota, ativo |
| `leads` | nome, WhatsApp, interesse, mensagem, consentimento, origem, data |
| `events` | tipo (visita, clique_whatsapp, clique_instagram…), detalhe, data |
| `admin_users` | usuário, hash da senha |

**API**

Pública: `GET /api/site` · `GET /api/categories` · `GET /api/products?category=&featured=` · `GET /api/promotions/active` · `GET /api/testimonials` · `POST /api/leads` · `POST /api/events`

Admin (sessão por cookie httpOnly): `POST /api/admin/login|logout` · CRUD de `products`, `categories`, `promotions`, `testimonials` · `GET/PUT settings` · `GET leads` (com exportação CSV) · `GET stats` · `POST upload` (imagem)

**Segurança:** senha com hash (scrypt), sessão em cookie httpOnly/SameSite, limite de requisições no login e nos formulários, validação de entrada, consultas parametrizadas, upload só de imagens até 5 MB, cabeçalhos de segurança (helmet). Usuário e senha iniciais vêm do `.env`.

**Painel admin:** login → painel com resumo (visitas, cliques, contatos) → abas Produtos, Coleções, Promoções, Depoimentos, Contatos, Configurações.

## 8. Imagens (IA)

Cerca de 15 imagens em estilo editorial claro e natural: par do hero (mesmo enquadramento, dois looks), 4 coleções, ~8 produtos de exemplo, mosaico. Antes de gerar, confiro o custo em créditos e aviso. Produtos de exemplo ficam marcados como demonstração no painel para a loja substituir.

## 9. Pendências de conteúdo (não bloqueiam; ficam editáveis no painel)

- **WhatsApp principal:** uso (54) 99472-0227 (o do Instagram). O Facebook mostra (54) 99200-2830.
- **Horário de funcionamento** e **endereço**: entram como exemplo até a loja informar.
- **Depoimentos:** seção oculta até haver depoimentos reais cadastrados.

## 10. Testes e verificação

- Testes automáticos da API: leads (validação e limite), login, CRUD protegido, promoções ativas por data.
- Verificação no navegador em 360 px, 768 px e desktop: loader, revelação líquida, 3D, menu, modal, envio de contato, painel.
- `prefers-reduced-motion` e ausência de WebGL com alternativas estáticas.

## 11. O que fica a cargo de quem constrói

Textos finais de cada seção (em português, tom próximo e acolhedor como o do Instagram), detalhes de layout do painel, forma exata da flor 3D, ordem de entrega em etapas.
