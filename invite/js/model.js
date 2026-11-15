// Invitation data model: event types, default wording, and text helpers.
//
// Field keys are short because they travel in the share link:
//   tp type · tl template · lg date language · bl blessing · in intro
//   n1 name/title · jn joiner · n2 second name · ms message
//   dt date · tm time · vn venue · va address · ml map link
//   ft footer · hn host name · ph RSVP WhatsApp · ev schedule · lk licence key

export const EVENT_TYPES = [
  {
    id: 'wedding', label: 'Wedding', emoji: '💍', pair: true, template: 'royal',
    words: {
      bl: '॥ श्री गणेशाय नमः ॥', in: 'Together with their families',
      n1: 'Aarav', jn: 'weds', n2: 'Meera',
      ms: 'request the honour of your presence\nat their wedding celebration',
      ft: 'With best compliments from the Sharma & Iyer families',
    },
  },
  {
    id: 'engagement', label: 'Engagement', emoji: '💞', pair: true, template: 'ivory',
    words: {
      bl: '', in: 'We are getting engaged',
      n1: 'Kabir', jn: '&', n2: 'Ananya',
      ms: 'Please join us as we exchange rings\nand begin our forever',
      ft: 'Your blessings mean the world to us',
    },
  },
  {
    id: 'birthday', label: 'Birthday', emoji: '🎂', pair: false, template: 'confetti',
    words: {
      bl: '', in: "You're invited to",
      n1: "Vihaan's 5th Birthday", jn: '', n2: '',
      ms: 'Cake, games and a whole lot of fun.\nCome celebrate with us!',
      ft: 'Hosted by Mom & Dad',
    },
  },
  {
    id: 'housewarming', label: 'Housewarming', emoji: '🏡', pair: false, template: 'ivory',
    words: {
      bl: '॥ शुभ गृह प्रवेश ॥', in: 'With divine blessings',
      n1: 'Griha Pravesh', jn: '', n2: '',
      ms: 'We warmly invite you and your family\nto bless our new home',
      ft: 'The Verma Family',
    },
  },
  {
    id: 'babyshower', label: 'Baby shower', emoji: '🍼', pair: false, template: 'ivory',
    words: {
      bl: '', in: 'A little one is on the way',
      n1: "Priya's Baby Shower", jn: '', n2: '',
      ms: 'Join us to shower the mum-to-be\nwith love and blessings',
      ft: 'Hosted by the Nair family',
    },
  },
  {
    id: 'party', label: 'Party / Other', emoji: '🎉', pair: false, template: 'confetti',
    words: {
      bl: '', in: 'You are invited to',
      n1: 'A Celebration', jn: '', n2: '',
      ms: 'Good food, good music and great company.\nWe would love to have you with us',
      ft: '',
    },
  },
];

export const WORD_FIELDS = ['bl', 'in', 'n1', 'jn', 'n2', 'ms', 'ft'];

export const BLESSINGS = [
  '॥ श्री गणेशाय नमः ॥', '॥ ॐ ॥', '॥ शुभ विवाह ॥', '॥ शुभ गृह प्रवेश ॥',
  'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ', 'بسم الله الرحمن الرحيم', 'With the blessings of God', 'Save the date',
];

export const DATE_LANGS = [
  ['en-IN', 'English'], ['hi-IN', 'हिन्दी'], ['mr-IN', 'मराठी'], ['gu-IN', 'ગુજરાતી'],
  ['pa-IN', 'ਪੰਜਾਬੀ'], ['bn-IN', 'বাংলা'], ['ta-IN', 'தமிழ்'], ['te-IN', 'తెలుగు'],
  ['kn-IN', 'ಕನ್ನಡ'], ['ml-IN', 'മലയാളം'],
];

export function eventType(id) {
  return EVENT_TYPES.find((t) => t.id === id) ?? EVENT_TYPES[0];
}

function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// First Saturday at least four weeks out: a plausible date for the sample.
function sampleDate(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 28);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return isoDate(d);
}

export function defaultInvite(typeId = 'wedding', now = new Date()) {
  const type = eventType(typeId);
  return {
    tp: type.id, tl: type.template, lg: 'en-IN', ...type.words,
    dt: sampleDate(now), tm: '19:00',
    vn: 'The Grand Orchid Banquet', va: 'MG Road, Bengaluru', ml: '',
    hn: '', ph: '', ev: [],
  };
}

export function parseDate(dt) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dt ?? '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(dt, lang = 'en-IN') {
  const d = parseDate(dt);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return d.toDateString();
  }
}

export function formatTime(tm, lang = 'en-IN') {
  const m = /^(\d{2}):(\d{2})$/.exec(tm ?? '');
  if (!m) return '';
  const d = new Date(2000, 0, 1, +m[1], +m[2]);
  try {
    return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit', hour12: true }).format(d).toUpperCase();
  } catch {
    return tm;
  }
}

// Start of the event as a local Date, or null when no date is set.
export function eventStart(data) {
  const d = parseDate(data.dt);
  if (!d) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(data.tm ?? '');
  if (m) d.setHours(+m[1], +m[2]);
  return d;
}

export function headline(data) {
  const a = (data.n1 ?? '').trim();
  const b = (data.n2 ?? '').trim();
  if (a && b) return `${a} ${data.jn?.trim() || '&'} ${b}`;
  return a || b || 'Invitation';
}

export function mapUrl(data) {
  if (data.ml) return data.ml;
  const q = [data.vn, data.va].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}

export function shareText(data, link) {
  const lines = [`You're invited! ${headline(data)}`];
  const when = [formatDate(data.dt, data.lg), formatTime(data.tm, data.lg)].filter(Boolean).join(' · ');
  if (when) lines.push(`🗓 ${when}`);
  if (data.vn) lines.push(`📍 ${data.vn}`);
  if (link) lines.push('', `Open the invitation & RSVP: ${link}`);
  return lines.join('\n');
}

export function fileSlug(data) {
  const s = headline(data).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `invitation-${s || 'card'}`.slice(0, 60);
}

// ---- Calendar ----

function icsStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

function icsEscape(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

// Floating local time: the event shows at the same clock time for every guest.
export function buildIcs(data) {
  const start = eventStart(data);
  if (!start) return '';
  const allDay = !data.tm;
  const end = new Date(start);
  if (allDay) end.setDate(end.getDate() + 1); else end.setHours(end.getHours() + 3);
  const day = (d) => icsStamp(d).slice(0, 8);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//invite//EN', 'BEGIN:VEVENT',
    `UID:${start.getTime()}-${fileSlug(data)}@invite`,
    `DTSTAMP:${icsStamp(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${day(start)}` : `DTSTART:${icsStamp(start)}`,
    allDay ? `DTEND;VALUE=DATE:${day(end)}` : `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(headline(data))}`,
    `LOCATION:${icsEscape([data.vn, data.va].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${icsEscape(data.ms)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}
