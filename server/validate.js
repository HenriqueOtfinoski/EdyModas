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

export const EVENT_TYPES = ['visit', 'click_whatsapp', 'click_instagram', 'click_facebook', 'click_product'];

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

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const fmt = (hhmm) => {
  const total = toMinutes(hhmm);
  const h = Math.floor(total / 60);
  const min = total % 60;
  return min ? `${h}h${String(min).padStart(2, '0')}` : `${h}h`;
};

/** Períodos válidos ([abre, fecha]) de um dia, em ordem. */
function periodsOf(hours, day) {
  const list = Array.isArray(hours?.[day]) ? hours[day] : [];
  return list
    .filter((p) => Array.isArray(p) && !Number.isNaN(toMinutes(p[0])) && !Number.isNaN(toMinutes(p[1])))
    .sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
}

/**
 * Diz se a loja está aberta no instante `now` (fuso de Brasília) e monta o rótulo do cabeçalho.
 * `hours`: 7 posições (0 = domingo), cada uma com uma lista de ["HH:MM","HH:MM"].
 */
export function openStatus(hours, now = new Date()) {
  if (!Array.isArray(hours) || hours.length !== 7) return { isOpen: false, label: '' };

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));

  for (const [open, close] of periodsOf(hours, day)) {
    if (minutes >= toMinutes(open) && minutes < toMinutes(close)) {
      return { isOpen: true, label: `Aberto agora • fecha ${fmt(close)}` };
    }
  }
  const laterToday = periodsOf(hours, day).find(([open]) => toMinutes(open) > minutes);
  if (laterToday) return { isOpen: false, label: `Fechado • abre às ${fmt(laterToday[0])}` };

  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const first = periodsOf(hours, d)[0];
    if (first) return { isOpen: false, label: `Fechado • abre ${DAY_NAMES[d]} ${fmt(first[0])}` };
  }
  return { isOpen: false, label: 'Fechado' };
}
