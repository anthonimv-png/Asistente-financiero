(function (root, factory) {
  const api = factory();
  root.MujerImpulsaModules = root.MujerImpulsaModules || {};
  root.MujerImpulsaModules.financial = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createFinancialDomain(dependencies) {
    const {
      getState, getLoan, todayISO, isValidISODate, parseDate, addDays, addMonth,
      num, isLoanDisbursed, getFundMovements = () => []
    } = dependencies;
    const currentMonth = () => todayISO().slice(0, 7);

    function correctionEvents(record) {
      const events = Array.isArray(record?.voidHistory)
        ? record.voidHistory.filter(event => event && ['anulado', 'reactivado'].includes(event.action)).map(event => ({
          action: event.action,
          date: isValidISODate(event.date) ? event.date : (event.action === 'anulado' && isValidISODate(record.voidedAt) ? record.voidedAt : event.action === 'reactivado' && isValidISODate(record.restoredAt) ? record.restoredAt : String(event.at || '').slice(0, 10)),
          at: event.at || '', reason: String(event.reason || record.voidReason || '')
        })).filter(event => isValidISODate(event.date)) : [];
      if (!events.some(event => event.action === 'anulado') && isValidISODate(record?.voidedAt)) events.push({ action: 'anulado', date: record.voidedAt, at: '', reason: String(record.voidReason || '') });
      if (!events.some(event => event.action === 'reactivado') && isValidISODate(record?.restoredAt)) events.push({ action: 'reactivado', date: record.restoredAt, at: '' });
      return events.sort((a, b) => a.date.localeCompare(b.date) || String(a.at).localeCompare(String(b.at)));
    }
    function recordActiveAt(record, asOf = todayISO()) {
      let active = true;
      for (const event of correctionEvents(record)) if (event.date <= asOf) active = event.action === 'reactivado';
      return active;
    }
    const paymentIsActive = payment => !!payment && recordActiveAt(payment, todayISO());
    const paymentIsActiveAt = (payment, date = todayISO()) => !!payment && recordActiveAt(payment, date);
    const isCurrentlyVoided = record => !!record && !recordActiveAt(record, todayISO());
    const activePayments = () => getState().payments.filter(paymentIsActive);
    const paymentRegularAmount = payment => Math.max(0, Number(payment?.regularAmount === undefined || payment?.regularAmount === null ? payment?.amount : payment?.regularAmount) || 0);
    const totalPayments = loanId => num(activePayments().filter(payment => payment.loanId === loanId).reduce((sum, payment) => sum + Number(payment.amount), 0));
    const totalRegularPayments = loanId => num(activePayments().filter(payment => payment.loanId === loanId).reduce((sum, payment) => sum + paymentRegularAmount(payment), 0));
    function totalRegularPaymentsAt(loanId, asOf = todayISO()) {
      return num(getState().payments.filter(payment => payment.loanId === loanId && (payment.date || '') <= asOf && paymentIsActiveAt(payment, asOf)).reduce((sum, payment) => sum + paymentRegularAmount(payment), 0));
    }
    const totalMoratoryPayments = loanId => num(activePayments().filter(payment => payment.loanId === loanId).reduce((sum, payment) => sum + Number(payment.moratoryAmount || 0), 0));
    const totalCollected = () => num(activePayments().reduce((sum, payment) => sum + Number(payment.amount), 0));

    function loanNormalInterest(loan) {
      if (!loan) return 0;
      const total = Math.max(0, Number(loan.totalDue) || 0), principal = Math.max(0, Number(loan.principal) || 0), stored = loan.interestAmount;
      return num(Math.max(0, stored === undefined || stored === null ? total - principal : Number(stored) || 0));
    }
    function paymentFinancialAllocation(payment, loan = getLoan(payment?.loanId)) {
      const regular = paymentRegularAmount(payment);
      if (!loan || regular <= 0) return { principalAmount: 0, normalInterestAmount: 0, regularAmount: regular, estimated: true };
      const storedPrincipal = payment?.principalAmount, storedInterest = payment?.normalInterestAmount;
      if (storedPrincipal !== undefined && storedPrincipal !== null && storedInterest !== undefined && storedInterest !== null) {
        const principal = num(Math.max(0, Number(storedPrincipal) || 0)), interest = num(Math.max(0, Number(storedInterest) || 0));
        if (Math.abs(num(principal + interest) - regular) <= 0.02) return { principalAmount: principal, normalInterestAmount: interest, regularAmount: regular, estimated: false };
      }
      const total = Math.max(0, Number(loan.totalDue) || 0), normal = loanNormalInterest(loan);
      const interest = total > 0 ? Math.min(regular, num(regular * normal / total)) : 0;
      return { principalAmount: num(Math.max(0, regular - interest)), normalInterestAmount: num(interest), regularAmount: regular, estimated: true };
    }
    function paymentFinancialTimeline(payment) {
      const timeline = [];
      if (isValidISODate(payment?.date)) timeline.push({ date: payment.date, action: 'registrado', sign: 1, at: '' });
      timeline.push(...correctionEvents(payment).map(event => ({ ...event, priority: 1 })));
      timeline.sort((a, b) => a.date.localeCompare(b.date) || (a.priority || 0) - (b.priority || 0) || String(a.at || '').localeCompare(String(b.at || '')));
      let active = false; const effective = [];
      for (const event of timeline) {
        if (event.action === 'registrado') { if (!active) { effective.push({ date: event.date, sign: 1, action: 'registrado' }); active = true; } }
        else if (event.action === 'anulado' && active) { effective.push({ date: event.date, sign: -1, action: 'anulado' }); active = false; }
        else if (event.action === 'reactivado' && !active) { effective.push({ date: event.date, sign: 1, action: 'reactivado' }); active = true; }
      }
      return effective;
    }
    function allocateRegularPayment(loan, regularAmount, asOf = todayISO()) {
      const regular = num(Math.max(0, Number(regularAmount) || 0));
      const total = Math.max(0, Number(loan?.totalDue) || 0), principalTotal = Math.min(total, Math.max(0, Number(loan?.principal) || 0)), interestTotal = Math.min(total, loanNormalInterest(loan));
      if (regular <= 0 || total <= 0) return { principalAmount: 0, normalInterestAmount: 0 };
      let priorPrincipal = 0, priorInterest = 0;
      for (const payment of getState().payments.filter(row => row.loanId === loan.id && (row.date || '') <= asOf && paymentIsActiveAt(row, asOf))) {
        const allocation = paymentFinancialAllocation(payment, loan); priorPrincipal += allocation.principalAmount; priorInterest += allocation.normalInterestAmount;
      }
      const remainingPrincipal = Math.max(0, num(principalTotal - priorPrincipal)), remainingInterest = Math.max(0, num(interestTotal - priorInterest)), remaining = num(remainingPrincipal + remainingInterest);
      if (regular >= remaining - 0.005) return { principalAmount: remainingPrincipal, normalInterestAmount: remainingInterest };
      let interest = num(regular * interestTotal / total); interest = Math.min(remainingInterest, interest);
      let principal = num(regular - interest);
      if (principal > remainingPrincipal) { principal = remainingPrincipal; interest = num(regular - principal); }
      if (interest > remainingInterest) { interest = remainingInterest; principal = num(regular - interest); }
      return { principalAmount: num(Math.max(0, principal)), normalInterestAmount: num(Math.max(0, interest)) };
    }

    function regularOutstandingAt(loan, asOf = todayISO()) { return Math.max(0, num(Number(loan?.totalDue || 0) - totalRegularPaymentsAt(loan?.id, asOf))); }
    function scheduleFor(loan, asOf = todayISO()) {
      const count = Math.max(1, Math.floor(Number(loan.installments) || 1));
      const totalCents = Math.round(Number(loan.totalDue) * 100);
      let paidCents = Math.round(totalRegularPaymentsAt(loan.id, asOf) * 100);
      const base = Math.floor(totalCents / count), rows = [];
      for (let index = 0; index < count; index++) {
        let date;
        if (loan.frequency === 'monthly') date = addMonth(loan.firstDue, index);
        else { const every = loan.frequency === 'weekly' ? 7 : loan.frequency === 'biweekly' ? 15 : 28; date = addDays(loan.firstDue, every * index); }
        const amountCents = index === count - 1 ? totalCents - base * (count - 1) : base;
        const paid = Math.max(0, Math.min(amountCents, paidCents)); paidCents -= paid;
        const balance = amountCents - paid;
        rows.push({ number: index + 1, date, amount: amountCents / 100, paid: paid / 100, balance: balance / 100, status: balance === 0 ? 'Pagado' : date < asOf ? 'Vencido' : date === asOf ? 'Hoy' : 'Pendiente' });
      }
      return rows;
    }
    const dateDiffDays = (from, to) => Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000);
    function moratoryRateHistory() {
      const settings = getState().settings;
      const rows = (settings.moratoryRateHistory || []).filter(row => row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))).map(row => ({ date: row.date, dailyRatePct: Math.max(0, Number(row.dailyRatePct) || 0) })).sort((a, b) => a.date.localeCompare(b.date));
      return rows.length ? rows : [{ date: todayISO(), dailyRatePct: Math.max(0, Number(settings.moratoryDailyRatePct) || 0) }];
    }
    function moratoryRateAt(date = todayISO()) { let rate = 0; for (const row of moratoryRateHistory()) { if (row.date <= date) rate = row.dailyRatePct; else break; } return rate; }
    function accrueMoratorySegment(balance, fromExclusive, toInclusive) {
      if (balance <= 0 || !fromExclusive || !toInclusive || toInclusive <= fromExclusive) return 0;
      const history = moratoryRateHistory(); let cursor = addDays(fromExclusive, 1), total = 0;
      while (cursor <= toInclusive) {
        let applicable = null; for (const row of history) { if (row.date <= cursor) applicable = row; else break; }
        const next = history.find(row => row.date > cursor), end = next && next.date <= toInclusive ? addDays(next.date, -1) : toInclusive;
        const days = dateDiffDays(cursor, end) + 1, rate = applicable ? applicable.dailyRatePct : 0;
        if (days > 0 && rate > 0) total += balance * (rate / 100) * days;
        cursor = addDays(end, 1);
      }
      return total;
    }
    function moratoryGrossForLoan(loan, asOf = todayISO()) {
      const settings = getState().settings;
      if (!loan || !isLoanDisbursed(loan) || Number(settings.moratoryDailyRatePct || 0) <= 0 && !moratoryRateHistory().some(row => row.dailyRatePct > 0)) return 0;
      const installments = scheduleFor(loan).map(row => ({ number: row.number, date: row.date, amount: row.amount, balance: row.amount, lastInterestDate: row.date, accrued: 0 }));
      const payments = getState().payments.filter(payment => payment.loanId === loan.id && (payment.date || '') <= asOf && paymentIsActiveAt(payment, asOf)).slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id).localeCompare(String(b.id)));
      for (const payment of payments) {
        const paymentDate = payment.date || asOf;
        for (const item of installments) if (item.balance > 0.0001 && paymentDate > item.date) { item.accrued += accrueMoratorySegment(item.balance, item.lastInterestDate, paymentDate); item.lastInterestDate = paymentDate; }
        let regular = Math.max(0, Number(payment.regularAmount === undefined || payment.regularAmount === null ? payment.amount : payment.regularAmount) || 0);
        for (const item of installments) { if (regular <= 0.0001) break; const applied = Math.min(item.balance, regular); item.balance = num(item.balance - applied); regular = num(regular - applied); }
      }
      for (const item of installments) if (item.balance > 0.0001 && asOf > item.date) item.accrued += accrueMoratorySegment(item.balance, item.lastInterestDate, asOf);
      return num(installments.reduce((sum, item) => sum + item.accrued, 0));
    }
    function moratoryBreakdown(loan, asOf = todayISO()) {
      const accrued = moratoryGrossForLoan(loan, asOf);
      const paid = num(getState().payments.filter(payment => payment.loanId === loan.id && (payment.date || '') <= asOf && paymentIsActiveAt(payment, asOf)).reduce((sum, payment) => sum + Number(payment.moratoryAmount || 0), 0));
      const waived = num((getState().moratoryWaivers || []).filter(waiver => waiver.loanId === loan.id && (waiver.date || '') <= asOf).reduce((sum, waiver) => sum + Number(waiver.amount || 0), 0));
      return { accrued, paid, waived, outstanding: Math.max(0, num(accrued - paid - waived)) };
    }
    const regularOutstanding = loan => Math.max(0, num(Number(loan.totalDue) - totalRegularPayments(loan.id)));
    const outstanding = loan => Math.max(0, num(regularOutstanding(loan) + (isLoanDisbursed(loan) ? moratoryBreakdown(loan).outstanding : 0)));
    const activeLoans = () => getState().loans.filter(loan => isLoanDisbursed(loan) && outstanding(loan) > 0.001);
    const loanStatus = loan => {
      if (!isLoanDisbursed(loan)) return loan.disbursementStatus === 'Documentación completa' ? 'Pendiente de desembolso' : 'Pendiente documentación';
      return outstanding(loan) <= 0.001 ? 'Pagado' : (scheduleFor(loan).some(row => row.balance > 0.001 && row.date < todayISO()) || moratoryBreakdown(loan).outstanding > 0.001 ? 'Vencido' : 'Activo');
    };
    function allInstallments() { return getState().loans.filter(isLoanDisbursed).flatMap(loan => scheduleFor(loan).map(row => ({ ...row, loanId: loan.id, clientId: loan.clientId, groupId: loan.groupId }))); }
    const overdueItems = () => allInstallments().filter(item => item.status === 'Vencido' && item.balance > 0.001);
    const todayItems = () => allInstallments().filter(item => item.status === 'Hoy' && item.balance > 0.001);
    const dueSoonItems = () => { const today = todayISO(), end = addDays(today, 7); return allInstallments().filter(item => item.balance > 0.001 && item.date >= today && item.date <= end).sort((a, b) => a.date.localeCompare(b.date)); };
    const monthPayments = () => num(activePayments().filter(payment => (payment.date || '').slice(0, 7) === currentMonth()).reduce((sum, payment) => sum + Number(payment.amount), 0));
    const principalPortfolio = () => num(activeLoans().reduce((sum, loan) => sum + Number(loan.principal), 0));
    const scheduledBalance = () => num(getState().loans.filter(isLoanDisbursed).reduce((sum, loan) => sum + regularOutstanding(loan), 0));
    function financialPeriodSummary(startDate, endDate = todayISO()) {
      const start = isValidISODate(startDate) ? startDate : currentMonth() + '-01', end = isValidISODate(endDate) ? endDate : todayISO();
      let principalRecovered = 0, normalInterestCollected = 0, moratoryCollected = 0;
      for (const payment of getState().payments) {
        const loan = getLoan(payment.loanId); if (!loan || !isLoanDisbursed(loan)) continue;
        const allocation = paymentFinancialAllocation(payment, loan), mora = Math.max(0, Number(payment.moratoryAmount) || 0);
        for (const event of paymentFinancialTimeline(payment)) if (event.date >= start && event.date <= end) {
          principalRecovered += allocation.principalAmount * event.sign;
          normalInterestCollected += allocation.normalInterestAmount * event.sign;
          moratoryCollected += mora * event.sign;
        }
      }
      let otherIncome = 0, operatingExpenses = 0, ownerWithdrawals = 0, otherExpenses = 0, unclassifiedIncome = 0, unclassifiedExpenses = 0, capitalContributions = 0;
      const movements = getFundMovements().filter(row => (row.date || '') >= start && (row.date || '') <= end && row.source !== 'Cobro' && row.source !== 'Crédito' && row.type !== 'transfer');
      for (const movement of movements) {
        const category = movement.category || (movement.type === 'expense' ? 'unclassified_expense' : 'unclassified_income');
        const amount = Number(movement.amount || 0), direction = movement.type === 'income' ? 1 : -1;
        if (category === 'other_income') otherIncome += amount * direction;
        else if (category === 'capital_contribution') capitalContributions += amount * direction;
        else if (category === 'operating_expense') operatingExpenses -= amount * direction;
        else if (category === 'owner_withdrawal') ownerWithdrawals -= amount * direction;
        else if (category === 'other_expense') otherExpenses -= amount * direction;
        else if (category === 'unclassified_expense') unclassifiedExpenses -= amount * direction;
        else unclassifiedIncome += amount * direction;
      }
      const financialInterest = num(normalInterestCollected + moratoryCollected);
      return { start, end, principalRecovered: num(principalRecovered), normalInterestCollected: num(normalInterestCollected), moratoryCollected: num(moratoryCollected), financialInterest, otherIncome: num(otherIncome), operatingExpenses: num(operatingExpenses), ownerWithdrawals: num(ownerWithdrawals), otherExpenses: num(otherExpenses), unclassifiedIncome: num(unclassifiedIncome), unclassifiedExpenses: num(unclassifiedExpenses), capitalContributions: num(capitalContributions), estimatedOperatingResult: num(financialInterest + otherIncome - operatingExpenses - otherExpenses) };
    }
    function interestMetrics() {
      const loans = getState().loans.filter(isLoanDisbursed), today = todayISO(), month = currentMonth();
      let normalPact = 0, normalCollected = 0, normalCollectedMonth = 0, principalDisbursed = 0, principalRecovered = 0, principalRecoveredMonth = 0;
      let moratoryAccrued = 0, moratoryPaid = 0, moratoryPaidMonth = 0, moratoryWaived = 0, moratoryOutstandingTotal = 0;
      for (const loan of loans) {
        const principal = Math.max(0, Number(loan.principal) || 0), normal = loanNormalInterest(loan);
        normalPact += normal; principalDisbursed += principal;
        const loanPayments = getState().payments.filter(payment => payment.loanId === loan.id && (payment.date || '') <= today && paymentIsActiveAt(payment, today));
        let loanNormalCollected = 0, loanPrincipalRecovered = 0;
        for (const payment of loanPayments) {
          const allocation = paymentFinancialAllocation(payment, loan); loanNormalCollected += allocation.normalInterestAmount; loanPrincipalRecovered += allocation.principalAmount;
          if ((payment.date || '').slice(0, 7) === month) { normalCollectedMonth += allocation.normalInterestAmount; principalRecoveredMonth += allocation.principalAmount; moratoryPaidMonth += Number(payment.moratoryAmount || 0); }
        }
        normalCollected += Math.min(normal, num(loanNormalCollected)); principalRecovered += Math.min(principal, num(loanPrincipalRecovered));
        const mora = moratoryBreakdown(loan, today); moratoryAccrued += mora.accrued; moratoryPaid += mora.paid; moratoryWaived += mora.waived; moratoryOutstandingTotal += mora.outstanding;
      }
      normalCollected = num(Math.min(normalPact, normalCollected)); principalRecovered = num(Math.min(principalDisbursed, principalRecovered));
      const period = financialPeriodSummary(`${month}-01`, today);
      principalRecoveredMonth = num(period.principalRecovered); normalCollectedMonth = num(period.normalInterestCollected); moratoryPaidMonth = num(period.moratoryCollected);
      return { principalDisbursed: num(principalDisbursed), principalRecovered, principalRecoveredMonth, principalPending: num(Math.max(0, principalDisbursed - principalRecovered)), normalPact: num(normalPact), normalCollected, normalCollectedMonth, normalPending: num(Math.max(0, normalPact - normalCollected)), moratoryAccrued: num(moratoryAccrued), moratoryPaid: num(moratoryPaid), moratoryPaidMonth, moratoryWaived: num(moratoryWaived), moratoryOutstanding: num(moratoryOutstandingTotal), financialIncomeCollected: num(normalCollected + moratoryPaid) };
    }
    return Object.freeze({
      correctionEvents, recordActiveAt, paymentIsActive, paymentIsActiveAt, isCurrentlyVoided,
      activePayments, paymentRegularAmount, totalPayments, totalRegularPayments, totalRegularPaymentsAt,
      totalMoratoryPayments, totalCollected, loanNormalInterest, paymentFinancialAllocation,
      paymentFinancialTimeline, allocateRegularPayment, regularOutstandingAt, scheduleFor,
      dateDiffDays, moratoryRateHistory, moratoryRateAt, accrueMoratorySegment,
      moratoryGrossForLoan, moratoryBreakdown, regularOutstanding, outstanding, activeLoans,
      loanStatus, allInstallments, overdueItems, todayItems, dueSoonItems, monthPayments,
      principalPortfolio, scheduledBalance, financialPeriodSummary, interestMetrics
    });
  }
  return Object.freeze({ createFinancialDomain });
});
