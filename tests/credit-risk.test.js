const test = require('node:test');
const assert = require('node:assert/strict');
const risk = require('../www/modules/credit-risk.js');

test('identifica frecuencia semanal sin asumirla para créditos sin frecuencia', () => {
  assert.equal(risk.isWeeklyLoan({ paymentFrequency: 'Semanal' }), true);
  assert.equal(risk.isWeeklyLoan({ frequency: 'monthly' }), false);
  assert.equal(risk.isWeeklyLoan({}), false);
});

test('cuota semanal del día sigue al día hasta las 3:00 p. m.', () => {
  assert.equal(risk.classifyWeeklyDue({ dueDate: '2026-11-17', today: '2026-11-17', hour: 15, minute: 0 }).level, 'ontime');
  assert.equal(risk.classifyWeeklyDue({ dueDate: '2026-11-17', today: '2026-11-17', hour: 15, minute: 1 }).level, 'moderate');
});

test('clasifica atraso de 1 a 14 días como alto y mayor a 14 como crítico', () => {
  assert.equal(risk.classifyWeeklyDue({ dueDate: '2026-11-16', today: '2026-11-17' }).level, 'high');
  assert.equal(risk.classifyWeeklyDue({ dueDate: '2026-11-02', today: '2026-11-17' }).level, 'critical');
});
