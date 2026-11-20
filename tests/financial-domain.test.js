const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../www/modules/core-utils.js');
const { createFinancialDomain } = require('../www/modules/financial-domain.js');

const state = { loans: [], payments: [], moratoryWaivers: [], cashMovements: [], settings: {} };
const domain = createFinancialDomain({
  getState: () => state,
  getLoan: id => state.loans.find(loan => loan.id === id),
  todayISO: () => '2026-11-17',
  isValidISODate: core.isValidISODate,
  parseDate: core.parseDate,
  addDays: core.addDays,
  addMonth: core.addMonth,
  num: core.roundMoney,
  isLoanDisbursed: loan => !!loan.disbursedDate,
  getFundMovements: () => state.cashMovements,
});

test('la fecha local ISO y el cálculo de días no desbordan el mes', () => {
  assert.equal(core.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(core.isValidISODate('2026-02-29'), false);
  assert.equal(core.isValidISODate('2028-02-29'), true);
});

test('un registro anulado deja de estar activo desde la fecha indicada', () => {
  const record = { voidedAt: '2026-11-10' };
  assert.equal(domain.recordActiveAt(record, '2026-11-09'), true);
  assert.equal(domain.recordActiveAt(record, '2026-11-10'), false);
});

test('la reactivación posterior vuelve a activar un registro', () => {
  const record = {
    voidHistory: [
      { action: 'anulado', date: '2026-11-10', at: '2026-11-10T09:00:00Z' },
      { action: 'reactivado', date: '2026-11-12', at: '2026-11-12T09:00:00Z' },
    ],
  };
  assert.equal(domain.recordActiveAt(record, '2026-11-11'), false);
  assert.equal(domain.recordActiveAt(record, '2026-11-12'), true);
});

test('los eventos del mismo día respetan el orden temporal', () => {
  const record = {
    voidHistory: [
      { action: 'reactivado', date: '2026-11-12', at: '2026-11-12T12:00:00Z' },
      { action: 'anulado', date: '2026-11-12', at: '2026-11-12T15:00:00Z' },
    ],
  };
  assert.equal(domain.recordActiveAt(record, '2026-11-12'), false);
});
