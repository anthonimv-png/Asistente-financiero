(function (root, factory) {
  const api = factory();
  root.MujerImpulsaModules = root.MujerImpulsaModules || {};
  root.MujerImpulsaModules.core = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const todayISO = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const parseDate = value => {
    if (!value) return new Date();
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
  };
  const asISO = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const isValidISODate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };
  const dateIsAfterToday = value => isValidISODate(value) && value > todayISO();
  const addDays = (iso, count) => { const date = parseDate(iso); date.setDate(date.getDate() + count); return asISO(date); };
  const addMonth = (iso, count) => {
    const date = parseDate(iso), day = date.getDate();
    date.setDate(1); date.setMonth(date.getMonth() + count);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
    return asISO(date);
  };
  const prettyDate = iso => iso ? parseDate(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '') : '—';
  const fullDateEs = iso => {
    if (!iso) return '—';
    const value = parseDate(iso).toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    return value.charAt(0).toLocaleUpperCase('es') + value.slice(1);
  };
  const currentMonth = () => todayISO().slice(0, 7);
  const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;
  const moneyInput = value => Number(value || 0).toFixed(2);
  const normalizeKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  const normalizeDni = value => String(value ?? '').replace(/\D/g, '');

  function spanishNumberToWords(value) {
    const number = Math.floor(Math.max(0, Number(value) || 0));
    const units = ['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
    const tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    const underThousand = number => {
      if (number < 30) return units[number];
      if (number < 100) { const ten = Math.floor(number / 10), unit = number % 10; return tens[ten] + (unit ? ' y ' + units[unit] : ''); }
      if (number === 100) return 'cien';
      return hundreds[Math.floor(number / 100)] + (number % 100 ? ' ' + underThousand(number % 100) : '');
    };
    if (number < 1000) return underThousand(number);
    if (number < 1000000) { const thousands = Math.floor(number / 1000), rest = number % 1000; return (thousands === 1 ? 'mil' : underThousand(thousands) + ' mil') + (rest ? ' ' + underThousand(rest) : ''); }
    if (number < 1000000000) { const millions = Math.floor(number / 1000000), rest = number % 1000000; return (millions === 1 ? 'un millón' : underThousand(millions) + ' millones') + (rest ? ' ' + (rest < 1000 ? underThousand(rest) : spanishNumberToWords(rest)) : ''); }
    return String(number);
  }
  function amountInWords(value, currency = 'PEN') {
    const centsTotal = Math.round((Number(value) || 0) * 100), whole = Math.floor(centsTotal / 100), cents = centsTotal % 100;
    let words = spanishNumberToWords(whole);
    words = words.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
    return `${words} y ${String(cents).padStart(2, '0')}/100 ${currency === 'USD' ? 'dólares americanos' : 'soles'}`;
  }

  return Object.freeze({
    todayISO, escapeHtml, parseDate, asISO, isValidISODate, dateIsAfterToday,
    addDays, addMonth, prettyDate, fullDateEs, currentMonth, roundMoney,
    moneyInput, normalizeKey, normalizeDni, spanishNumberToWords, amountInWords
  });
});
