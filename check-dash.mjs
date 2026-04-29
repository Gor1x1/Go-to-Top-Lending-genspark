const BASE = 'https://gototop.win/api/admin';
async function main() {
  const lr = await fetch(`${BASE}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'gototop2026'}) });
  const TOKEN = (await lr.json()).token;
  const h = {'Authorization': `Bearer ${TOKEN}`};
  
  // Check stats endpoint
  const stats = await (await fetch(`${BASE}/stats`, {headers: h})).json();
  console.log('=== Dashboard Stats ===');
  console.log('turnover:', stats.turnover);
  console.log('net_profit:', stats.net_profit);
  console.log('total_expenses:', stats.total_expenses);
  console.log('refunds:', stats.refunds);
  console.log('avg_check:', stats.avg_check);
  
  // Check if calc_data has services field
  const leads = await (await fetch(`${BASE}/leads?limit=3`, {headers: h})).json();
  const leadsList = leads.leads || [];
  for (const l of leadsList.slice(0,3)) {
    let cd = {};
    try { cd = typeof l.calc_data === 'string' ? JSON.parse(l.calc_data) : (l.calc_data || {}); } catch {}
    console.log(`Lead ${l.id}: total=${l.total_amount}, calc_data.services=${cd.services}, calc_data.package_price=${cd.package_price}, status=${l.status}`);
  }
}
main().catch(console.error);
