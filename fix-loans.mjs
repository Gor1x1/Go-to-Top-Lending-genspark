const BASE = 'https://gototop.win/api/admin';
async function main() {
  const lr = await fetch(`${BASE}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'gototop2026'}) });
  const TOKEN = (await lr.json()).token;
  const h = {'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json'};

  // Get current payments
  const loansRes = await (await fetch(`${BASE}/loans`, {headers: h})).json();
  const payments = loansRes.payments || [];
  console.log(`Current payments: ${payments.length}`);
  
  // Delete all existing payments
  for (const p of payments) {
    await fetch(`${BASE}/loan-payments/${p.id}`, { method: 'DELETE', headers: h });
    console.log(`  Deleted payment ${p.id}`);
  }
  
  // Add correct payments for March 2026
  const newPayments = [
    { loanId: 1, amount: 241247, principal: 200000, interest: 41247, note: 'Бизнес-кредит Америабанк — Март 2026' },
    { loanId: 2, amount: 130483, principal: 110000, interest: 20483, note: 'Займ от партнёра — Март 2026' },
    { loanId: 3, amount: 183360, principal: 150000, interest: 33360, note: 'Овердрафт Араратбанк — Март 2026' },
  ];
  
  for (const np of newPayments) {
    const res = await fetch(`${BASE}/loans/${np.loanId}/payments`, {
      method: 'POST', headers: h,
      body: JSON.stringify({
        amount: np.amount,
        principal_part: np.principal,
        interest_part: np.interest,
        payment_date: '2026-03-10',
        notes: np.note,
        period_key: '2026-03',
        is_extra: 0
      })
    });
    console.log(`  Added payment for loan ${np.loanId}: ${(await res.json()).success ? '✅' : '❌'}`);
  }
  
  // Verify
  const verify = await (await fetch(`${BASE}/loans`, {headers: h})).json();
  const finalPayments = verify.payments || [];
  console.log(`\nFinal payments: ${finalPayments.length}`);
  let totalInterest = 0;
  for (const p of finalPayments) {
    totalInterest += p.interest_part || 0;
    console.log(`  loan_id=${p.loan_id}, amount=${p.amount.toLocaleString()}, interest=${(p.interest_part||0).toLocaleString()}`);
  }
  console.log(`Total interest: ${totalInterest.toLocaleString()}`);
  
  // Check P&L
  const pnl = await (await fetch(`${BASE}/pnl/2026-03`, {headers: h})).json();
  console.log(`\nP&L interest_expense: ${pnl.interest_expense}`);
  console.log(`P&L loan_total_payments_period: ${pnl.loan_total_payments_period}`);
  console.log(`P&L loan_load_on_revenue: ${pnl.loan_load_on_revenue}%`);
}
main().catch(console.error);
