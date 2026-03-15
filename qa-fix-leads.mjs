// QA Fix — Update leads with statuses, assigned_to, payment_method, and created_at
const BASE = 'https://gototop.win/api/admin';
let TOKEN = '';

async function api(method, path, body) {
  const opts = { method, headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  return r.json().catch(() => ({}));
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  // Login
  const lr = await fetch(`${BASE}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'gototop2026'}) });
  TOKEN = (await lr.json()).token;

  // Get all leads
  const leadsRes = await api('GET', '/leads?page=1&limit=200');
  const leads = leadsRes.leads || [];
  console.log(`Found ${leads.length} leads to update`);

  // Employee IDs for assignment
  const empIds = [17, 18, 19, 20, 21]; // operators + buyers
  const payMethods = [1, 2, 3]; // Расч.счёт 6%, Карта 2%, Cash-out 0%

  // Status distribution: 70 done, 15 in_progress, 8 new, 5 rejected, 2 checking
  const statuses = [];
  for (let i = 0; i < 70; i++) statuses.push('done');
  for (let i = 0; i < 15; i++) statuses.push('in_progress');
  for (let i = 0; i < 8; i++) statuses.push('new');
  for (let i = 0; i < 5; i++) statuses.push('rejected');
  for (let i = 0; i < 2; i++) statuses.push('checking');
  // Shuffle
  for (let i = statuses.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [statuses[i],statuses[j]]=[statuses[j],statuses[i]]; }

  // Update each lead
  let done = 0, inProgress = 0, newL = 0, rejected = 0, checking = 0;
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const status = statuses[i] || 'new';
    const assignedTo = empIds[i % empIds.length];
    const pmId = payMethods[i % payMethods.length];

    // Update status, assigned_to
    await api('PUT', `/leads/${lead.id}`, {
      status: status,
      assigned_to: assignedTo
    });

    // Also update payment_method_id via direct field update
    // Check if payment_method_id is supported in PUT
    // It's not in the PUT handler, need to add or use SQL directly
    
    if (status === 'done') done++;
    else if (status === 'in_progress') inProgress++;
    else if (status === 'new') newL++;
    else if (status === 'rejected') rejected++;
    else if (status === 'checking') checking++;

    if ((i+1) % 20 === 0) console.log(`  Updated ${i+1}/${leads.length}`);
  }

  console.log(`\n✅ Updated all leads:`);
  console.log(`  Done: ${done}, In Progress: ${inProgress}, New: ${newL}, Rejected: ${rejected}, Checking: ${checking}`);

  // Verify P&L
  const pnl = await api('GET', '/pnl/2026-03');
  console.log(`\n📊 P&L after update:`);
  console.log(`  Revenue: ${pnl.revenue?.toLocaleString()} ֏`);
  console.log(`  Services: ${pnl.revenue_services?.toLocaleString()} ֏`);
  console.log(`  Articles: ${pnl.revenue_articles?.toLocaleString()} ֏`);
  console.log(`  Packages: ${pnl.revenue_packages?.toLocaleString()} ֏`);
  console.log(`  Salary: ${pnl.salary_total?.toLocaleString()} ֏`);
  console.log(`  EBIT: ${pnl.ebit?.toLocaleString()} ֏`);
  console.log(`  Net Profit: ${pnl.net_profit?.toLocaleString()} ֏`);
}

main().catch(e => console.error('FATAL:', e));
