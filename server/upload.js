import multer from 'multer';
import sharp from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
}).single('image');

/** Descobre o tipo pela assinatura dos bytes (a extensão e o Content-Type não são confiáveis). */
export function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Lado maior das fotos guardadas: suficiente para telas grandes e retina. */
export const MAX_SIDE = 1600;

/**
 * Grava a imagem com nome aleatório e devolve a URL pública.
 * Fotos de celular chegam com 3–5 MB e com metadados (GPS, aparelho): aqui elas são giradas conforme
 * a orientação, reduzidas para no máximo 1600 px, convertidas para WebP e salvas SEM metadados.
 * Devolve null se o arquivo não for uma imagem válida.
 */
export async function saveImage(buf, uploadsDir) {
  if (!sniffImage(buf)) return null;
  let out;
  try {
    out = await sharp(buf, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return null; // assinatura de imagem, mas conteúdo corrompido
  }
  const name = `${crypto.randomBytes(12).toString('hex')}.webp`;
  fs.writeFileSync(path.join(uploadsDir, name), out);
  return `/uploads/${name}`;
}
