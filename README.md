# Edy Modas — site da loja

Site-vitrine da **Edy Modas**, loja de Mariano Moro (RS), com **painel da loja** para cadastrar produtos, promoções e depoimentos e acompanhar os contatos.

O site não vende online. A ideia é levar quem visita até o **WhatsApp**, o **Instagram** e a **loja física**. Por isso todo produto tem o botão "Quero esse", que abre o WhatsApp com a mensagem pronta.

---

## O que tem no projeto

| Parte | O que faz |
|---|---|
| **Site** (`public/`) | Abertura animada, foto com troca de look ao passar o mouse, transição com faixa de luz, seção A Loja, coleções, novidades, promoção com contagem regressiva, diferenciais, "Visite a loja" com status de aberto/fechado ao vivo, Instagram e rodapé. |
| **Painel** (`admin/`) | Login, resumo de visitas e cliques, produtos, coleções, promoções, depoimentos, contatos (com planilha CSV) e configurações (WhatsApp, endereço, horários, letreiro, números e senha). |
| **Servidor e API** (`server/`) | Node.js + Express. Entrega o site e o painel e guarda tudo num banco SQLite. |
| **Testes** (`tests/`) | Testes automáticos da API (`npm test`). |

Tecnologias: Node.js, Express, SQLite (`node:sqlite`, já vem no Node), Lenis (rolagem suave), Sharp (tratamento das fotos enviadas) e compressão gzip das páginas. Não tem etapa de build: o site é HTML, CSS e JavaScript puros.

---

## Como rodar no computador

**Requisito:** [Node.js](https://nodejs.org) 22.13 ou mais recente (desenvolvido no Node 26).

```bash
npm install
```

Crie o arquivo `.env` a partir do exemplo e preencha **o seu** usuário e senha do painel:

```bash
cp .env.example .env
```

```ini
ADMIN_USER=seu-usuario
ADMIN_PASSWORD=uma-senha-com-10-ou-mais-caracteres
```

Depois inicie o servidor:

```bash
npm start
```

- Site: <http://localhost:3000>
- Painel: <http://localhost:3000/admin>

Para desenvolver, `npm run dev` reinicia o servidor sozinho a cada alteração no código do servidor.

> O `.env` **não vai para o GitHub** (está no `.gitignore`). Os valores de exemplo do `.env.example` são recusados pelo servidor, então o painel só funciona com um usuário e uma senha definidos por você.

---

## Painel da loja

Entre em `/admin` com o usuário e a senha do `.env`.

- **Resumo:** visitas e cliques em WhatsApp, Instagram, Facebook, "Quero esse" e "Como chegar", mais os contatos deixados (7, 30 ou 90 dias).
- **Produtos:** foto, nome, descrição, preço (se ficar vazio, o site mostra "Consulte o valor"), tamanhos, coleção, destaque e mostrar/ocultar. Os produtos marcados como **Demonstração** vieram com o site e devem ser trocados pelas peças reais.
- **Coleções:** os cartões da faixa escura (nome, frase, foto e ordem).
- **Promoções:** o banner com contagem regressiva aparece no site **só entre o início e o fim** cadastrados.
- **Depoimentos:** a seção só aparece no site quando existe pelo menos um depoimento ativo. Cadastre apenas depoimentos reais.
- **Contatos:** quem preencheu "Fale com a gente" ou a lista VIP, com botão para responder no WhatsApp e a planilha CSV. Se alguém pedir para remover os próprios dados, exclua por aqui.
- **Configurações:** WhatsApp, redes, endereço, horários (que geram o "Aberto agora / Fechado" do site), frases do letreiro, números da loja e troca de senha.

### Senha do painel

- **Trocar pelo painel:** em Configurações → Senha do painel. A senha nova continua valendo mesmo depois de reiniciar o servidor.
- **Trocar pelo `.env`:** mude `ADMIN_PASSWORD` e reinicie o servidor. A senha do `.env` só é reaplicada quando ela muda no arquivo.

---

## Fotos

### Fotos dos produtos, coleções e promoções

Envie pelo painel. O servidor gira a foto conforme a orientação do celular, reduz para no máximo 1600 px, converte para WebP e **remove os metadados** (como a localização GPS). Assim, uma foto de vários MB tirada no celular fica bem mais leve para quem visita o site.

### Fotos fixas do site

Ficam em `public/assets/img/`. Para trocar, substitua o arquivo **mantendo o mesmo nome**:

| Arquivo | Onde aparece |
|---|---|
| `hero-before.jpg` / `hero-after.jpg` | Foto da tela inicial (cinza) e o look revelado ao passar o mouse e na transição (rosa). As duas precisam ter o mesmo enquadramento. |
| `loja.jpg` | Seção "Visite a loja": foto real do interior da loja. Para trocar, prefira uma foto na vertical com o assunto principal no centro (o cartão corta as bordas conforme o tamanho da tela). |
| `col-feminino.jpg` | Fotos dentro do título da seção A Loja e vitrine em tela cheia. |
| `prod-01.jpg` | Foto dentro do título da seção A Loja. |
| `col-*.jpg`, `prod-*.jpg` | Imagens das coleções e dos produtos de demonstração (as dos produtos são trocadas pelo painel). |

As imagens ficam guardadas por 1 dia no navegador de quem visita. Depois de trocar uma foto, use **Ctrl + F5** para ver a nova na hora.

---

## Dados e cópia de segurança

Tudo o que é cadastrado pelo painel fica em `data/`:

- `data/edy.db` (e os arquivos `edy.db-wal` / `edy.db-shm`): banco de dados.
- `data/uploads/`: fotos enviadas pelo painel.

Para fazer uma cópia de segurança, **pare o servidor** e copie a pasta `data/` inteira. A pasta não vai para o GitHub.

O site guarda os registros de visitas e cliques dos últimos 13 meses. Os mais antigos são apagados quando o servidor inicia.

---

## Testes

```bash
npm test
```

Cobrem a API pública (produtos, contatos, promoções, horários de funcionamento), o painel (login, sessões, cadastros, upload de fotos, planilha, estatísticas) e as configurações do servidor (compressão, cache, `robots.txt`).

---

## Estrutura das pastas

```
admin/            painel da loja (HTML, CSS, JS)
public/           site
  css/site.css
  js/             módulos do site (abertura, efeitos, dados, interface…)
  assets/         fotos, ícones e imagem de compartilhamento
server/
  index.js        inicia o servidor
  app.js          rotas, segurança, compressão e arquivos estáticos
  db.js, seed.js  banco de dados e dados iniciais
  auth.js         login, sessões e senha
  upload.js       tratamento das fotos enviadas
  validate.js     validações e horário de funcionamento
  routes/         API pública e API do painel
tests/            testes automáticos
data/             banco e fotos enviadas (criada ao rodar; fora do git)
docs/             especificação e plano do projeto
```

---

## Segurança e privacidade

- Senhas guardadas com `scrypt`. Sessão em cookie `HttpOnly` e `SameSite=Strict`, válida por 8 horas.
- Limite de tentativas no login (5 a cada 15 min) e no formulário de contato.
- O painel recusa pedidos vindos de outros sites e envios de arquivos que não sejam imagem.
- Os textos cadastrados nunca são interpretados como código na página.
- A planilha de contatos é protegida contra fórmulas maliciosas.
- O formulário de contato pede autorização explícita (LGPD), e o site não usa cookies de publicidade.
- `robots.txt` pede para os buscadores não indexarem o painel nem a API.

Em hospedagem com HTTPS, defina `NODE_ENV=production` no `.env`: o cookie do painel passa a trafegar só por HTTPS e o navegador é instruído a carregar tudo por HTTPS.

---

## Hospedagem

Ainda não definida. O site precisa de um serviço que rode Node.js e tenha **disco persistente** para a pasta `data/`; sem isso, os produtos e os contatos se perdem quando o servidor reinicia.
