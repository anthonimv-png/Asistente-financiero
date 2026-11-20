const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDailyCollectionSeries } = require('../www/modules/dashboard-analytics.js');
const addDays = (iso, n) => { const [y,m,d] = iso.split('-').map(Number); const date = new Date(y,m-1,d+n,12); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };

test('la serie de 7 días incluye días sin cobros y suma importes', () => {
  const rows = buildDailyCollectionSeries([{date:'2026-11-15',amount:30},{date:'2026-11-15',amount:12.5},{date:'2026-11-17',amount:20}], {today:'2026-11-17',addDays});
  assert.equal(rows.length,7);
  assert.equal(rows.at(-1).amount,20);
  assert.equal(rows[rows.length-3].amount,42.5);
  assert.equal(rows[0].amount,0);
});

test('la serie omite fechas futuras, pagos inválidos, negativos y anulados', () => {
  const rows = buildDailyCollectionSeries([{date:'2026-11-17',amount:10},{date:'2026-11-18',amount:90},{date:'2026-11-16',amount:-2},{date:'2026-11-15',amount:12,voided:true}], {today:'2026-11-17',addDays,isActive:p=>!p.voided});
  assert.equal(rows.reduce((sum,row)=>sum+row.amount,0),10);
});

test('rechaza parámetros de fecha o calendario ausentes', () => {
  assert.throws(()=>buildDailyCollectionSeries([], {today:'17-11-2026'}), /fecha ISO/);
});


test('la serie de 30 días permite el nuevo selector de tendencia', () => {
  const rows = buildDailyCollectionSeries([{date:'2026-11-01',amount:125},{date:'2026-11-17',amount:75}], {today:'2026-11-17',days:30,addDays});
  assert.equal(rows.length,30);
  assert.equal(rows.at(-1).amount,75);
  assert.equal(rows.find(row=>row.date==='2026-11-01').amount,125);
});
