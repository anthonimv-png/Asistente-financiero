(function (root, factory) {
  const api = factory();
  root.MujerImpulsaModules = root.MujerImpulsaModules || {};
  root.MujerImpulsaModules.creditRisk = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function isWeeklyLoan(loan) {
    if (!loan || typeof loan !== 'object') return false;
    const raw = [loan.paymentFrequency, loan.frequency, loan.paymentPeriod, loan.periodicity, loan.installmentFrequency]
      .filter(v => v !== undefined && v !== null).join(' ').toLowerCase();
    return /semanal|weekly|cada\s*7\s*d[ií]as|7\s*d[ií]as/.test(raw);
  }
  function classifyWeeklyDue({ dueDate, today, hour = 0, minute = 0 }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) {
      return { level: 'unknown', label: 'Sin fecha verificable', daysLate: null };
    }
    const due = Date.parse(`${dueDate}T00:00:00Z`), current = Date.parse(`${today}T00:00:00Z`);
    if (!Number.isFinite(due) || !Number.isFinite(current)) return { level: 'unknown', label: 'Sin fecha verificable', daysLate: null };
    const daysLate = Math.floor((current - due) / 86400000);
    if (daysLate < 0) return { level: 'upcoming', label: 'Por vencer', daysLate: 0 };
    if (daysLate === 0) {
      const lateCutoffPassed = Number(hour) > 15 || (Number(hour) === 15 && Number(minute) >= 1);
      return lateCutoffPassed
        ? { level: 'moderate', label: 'Riesgo moderado', daysLate: 0 }
        : { level: 'ontime', label: 'Al día · hasta 3:00 p. m.', daysLate: 0 };
    }
    if (daysLate <= 14) return { level: 'high', label: 'Riesgo alto', daysLate };
    return { level: 'critical', label: 'Riesgo crítico', daysLate };
  }
  return Object.freeze({ isWeeklyLoan, classifyWeeklyDue });
});
