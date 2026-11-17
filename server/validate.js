const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Valida e normaliza o corpo de um contato (lead). */
export function validateLead(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < 2 || name.length > 80) errors.push('Informe seu nome (2 a 80 caracteres).');

  const whatsapp = typeof b.whatsapp === 'string' ? b.whatsapp.replace(/\D/g, '') : '';
  if (whatsapp.length < 10 || whatsapp.length > 13) errors.push('Informe um WhatsApp válido com DDD.');

  const rawMessage = typeof b.message === 'string' ? b.message.trim() : '';
  if (rawMessage.length > 500) errors.push('A mensagem pode ter no máximo 500 caracteres.');

  if (b.consent !== true) errors.push('É preciso autorizar o contato para enviar.');

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      whatsapp,
      interest: str(b.interest, 40),
      message: rawMessage,
      consent: 1,
      source: str(b.source, 40),
    },
  };
}

export const EVENT_TYPES = ['visit', 'click_whatsapp', 'click_instagram', 'click_facebook', 'click_product', 'click_maps'];

/** Valida um evento de medição. */
export function validateEvent(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (!EVENT_TYPES.includes(b.type)) return { ok: false, errors: ['Tipo de evento inválido.'] };
  return { ok: true, value: { type: b.type, detail: str(b.detail, 120) } };
}

/** Uma promoção só vale se está ativa e o agora cai entre início e fim (datas válidas). */
export function isPromotionLive(promo, now = Date.now()) {
  if (!promo || !promo.active) return false;
  const start = Date.parse(promo.starts_at);
  const end = Date.parse(promo.ends_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= now && now < end;
}

// O cálculo de aberto/fechado é compartilhado com o navegador, que atualiza o status com a página aberta.
export { openStatus } from '../public/js/hours.js';
