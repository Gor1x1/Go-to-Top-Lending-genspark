const BASE = 'https://gototop.win/api/admin';
async function main() {
  const lr = await fetch(`${BASE}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'gototop2026'}) });
  const TOKEN = (await lr.json()).token;
  const h = {'Authorization': `Bearer ${TOKEN}`};
  
  const stats = await (await fetch(`${BASE}/stats`, {headers: h})).json();
  const dash = stats.dashboard || {};
  console.log('turnover:', dash.turnover?.toLocaleString());
  console.log('net_profit:', dash.net_profit?.toLocaleString());
  console.log('expenses:', dash.total_expenses?.toLocaleString());
  console.log('refunds:', dash.refunds?.toLocaleString());
  console.log('Expected: turnover(21.7M) - articles(16.9M) - expenses(653K) = ~4.1M');
}
main().catch(console.error);
