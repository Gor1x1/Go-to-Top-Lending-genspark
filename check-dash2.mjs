const BASE = 'https://gototop.win/api/admin';
async function main() {
  const lr = await fetch(`${BASE}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'gototop2026'}) });
  const TOKEN = (await lr.json()).token;
  const h = {'Authorization': `Bearer ${TOKEN}`};
  
  // Check all keys in stats
  const stats = await (await fetch(`${BASE}/stats`, {headers: h})).json();
  for (const [k,v] of Object.entries(stats)) {
    if (typeof v !== 'object') console.log(`${k}: ${v}`);
    else console.log(`${k}: [object with ${Object.keys(v).length} keys]`);
  }
  
  // Check calc_data structure
  const leads = await (await fetch(`${BASE}/leads?limit=1`, {headers: h})).json();
  const l = (leads.leads || [])[0];
  if (l) {
    console.log('\n=== Lead calc_data ===');
    console.log('raw calc_data:', typeof l.calc_data, l.calc_data ? String(l.calc_data).slice(0,300) : 'null');
  }
}
main().catch(console.error);
