import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const passThrough = (req, res, next) => next();

/**
 * Monta a aplicação Express sobre um banco já aberto.
 * opts.uploadsDir: pasta das imagens enviadas pelo painel.
 * opts.rateLimit: false desliga os limites (testes).
 */
export function createApp(db, opts = {}) {
  const uploadsDir = opts.uploadsDir ?? path.join(ROOT, 'data', 'uploads');
  const useLimit = opts.rateLimit !== false;
  const production = process.env.NODE_ENV === 'production';
  fs.mkdirSync(uploadsDir, { recursive: true });

  const limiter = (windowMs, limit, message) =>
    useLimit
      ? rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { errors: [message] } })
      : passThrough;

  const app = express();
  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
    })
  );
  app.use(express.json({ limit: '50kb' }));

  app.use(
    '/api',
    publicRoutes(db, {
      leadLimiter: limiter(10 * 60 * 1000, 5, 'Muitos envios. Tente de novo em alguns minutos.'),
      eventLimiter: limiter(60 * 1000, 120, 'Muitas requisições.'),
    })
  );
  app.use(
    '/api/admin',
    adminRoutes(db, {
      uploadsDir,
      loginLimiter: limiter(15 * 60 * 1000, 5, 'Muitas tentativas. Tente de novo em 15 minutos.'),
    })
  );
  app.use('/api', (req, res) => res.status(404).json({ error: 'Não encontrado' }));

  // Bibliotecas do frontend servidas localmente (sem CDN)
  app.get('/vendor/lenis.mjs', (req, res) =>
    res.sendFile(path.join(ROOT, 'node_modules', 'lenis', 'dist', 'lenis.mjs'))
  );
  app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules', 'three', 'build'), { maxAge: '7d' }));

  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', index: false }));
  app.use('/admin', express.static(path.join(ROOT, 'admin')));
  app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

  app.use((req, res) => res.status(404).sendFile(path.join(ROOT, 'public', '404.html'), (err) => {
    if (err) res.status(404).type('text').send('Página não encontrada');
  }));

  // Erros: nunca vaza detalhes internos
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    const message =
      err.type === 'entity.parse.failed' ? 'JSON inválido.'
      : err.code === 'LIMIT_FILE_SIZE' ? 'A imagem pode ter no máximo 5 MB.'
      : status === 500 ? 'Erro interno.'
      : err.message || 'Requisição inválida.';
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 400 : status).json({ errors: [message] });
  });

  return app;
}
