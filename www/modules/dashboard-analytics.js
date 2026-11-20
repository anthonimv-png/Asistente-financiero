(function (root, factory) {
  const api = factory();
  root.MujerImpulsaModules = root.MujerImpulsaModules || {};
  root.MujerImpulsaModules.analytics = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function buildDailyCollectionSeries(payments, options = {}) {
    const { today, days = 7, addDays, isActive = () => true } = options;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today || '')) || typeof addDays !== 'function') {
      throw new TypeError('Se requiere una fecha ISO válida y la función addDays.');
    }
    const count = Math.max(1, Math.min(31, Math.trunc(Number(days) || 7)));
    const totals = new Map();
    for (const payment of Array.isArray(payments) ? payments : []) {
      const date = String(payment?.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || !isActive(payment, date)) continue;
      const amount = Number(payment?.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      totals.set(date, (totals.get(date) || 0) + amount);
    }
    return Array.from({ length: count }, (_, index) => {
      const date = addDays(today, index - count + 1);
      const day = Number(date.slice(8, 10));
      return { date, label: String(day).padStart(2, '0'), amount: Math.round((totals.get(date) || 0) * 100) / 100 };
    });
  }

  return Object.freeze({ buildDailyCollectionSeries });
});
