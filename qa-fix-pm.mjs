// Fix payment_method_id for all leads
const BASE = 'https://gototop.win/api/admin';
let TOKEN = '';

async function main() {
  const lr = await fetch(`${BASE}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'gototop2026'}) });
  TOKEN = (await lr.json()).token;
  const h = {'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json'};

  const leadsRes = await (await fetch(`${BASE}/leads?page=1&limit=200`, {headers: h})).json();
  const leads = leadsRes.leads || [];
  console.log(`Updating ${leads.length} leads with payment_method_id...`);
  
  const methods = [1, 1, 1, 2, 2, 3]; // weighted: 50% cash, 33% card, 17% bank
  
  for (let i = 0; i < leads.length; i++) {
    const pmId = methods[i % methods.length];
    await fetch(`${BASE}/leads/${leads[i].id}`, {
      method: 'PUT', headers: h,
      body: JSON.stringify({ payment_method_id: pmId })
    });
    if ((i+1) % 25 === 0) console.log(`  ${i+1}/${leads.length}`);
  }
  
  // Recalc all to update commission amounts
  console.log('Recalculating all leads...');
  for (let i = 0; i < leads.length; i++) {
    await fetch(`${BASE}/leads/${leads[i].id}/recalc`, { method: 'POST', headers: h });
    if ((i+1) % 25 === 0) console.log(`  recalc ${i+1}/${leads.length}`);
  }
  
  console.log('✅ Done!');
}

main().catch(e => console.error(e));
