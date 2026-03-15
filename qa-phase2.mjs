// QA Phase 2 — Add articles, refunds, payment_method, and fill ALL data gaps
const BASE = 'https://gototop.win/api/admin';
let TOKEN = '';

async function api(method, path, body) {
  const opts = { method, headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  return r.json().catch(() => ({}));
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const wbProducts = [
  { name: 'Футболка мужская хлопок', base: 12345000, sizes: ['S','M','L','XL'], colors: ['Чёрный','Белый','Серый'], pr: [800, 2500] },
  { name: 'Платье женское летнее', base: 23456000, sizes: ['XS','S','M','L'], colors: ['Красный','Синий','Зелёный'], pr: [2000, 5000] },
  { name: 'Кроссовки спортивные', base: 34567000, sizes: ['38','39','40','41','42','43'], colors: ['Белый','Чёрный'], pr: [3000, 8000] },
  { name: 'Куртка зимняя мужская', base: 45678000, sizes: ['M','L','XL','XXL'], colors: ['Чёрный','Тёмно-синий'], pr: [5000, 15000] },
  { name: 'Джинсы женские slim', base: 56789000, sizes: ['25','26','27','28','29','30'], colors: ['Синий','Голубой'], pr: [2000, 4000] },
  { name: 'Рюкзак городской', base: 67890000, sizes: ['One size'], colors: ['Чёрный','Серый','Хаки'], pr: [1500, 4000] },
  { name: 'Худи оверсайз', base: 78901000, sizes: ['S','M','L','XL'], colors: ['Чёрный','Белый','Бежевый'], pr: [1500, 3500] },
  { name: 'Леггинсы спортивные', base: 89012000, sizes: ['XS','S','M','L'], colors: ['Чёрный','Серый'], pr: [1000, 2500] },
  { name: 'Пуховик женский', base: 90123000, sizes: ['S','M','L','XL'], colors: ['Белый','Чёрный','Розовый'], pr: [8000, 20000] },
  { name: 'Ботинки кожаные', base: 11234000, sizes: ['39','40','41','42','43'], colors: ['Коричневый','Чёрный'], pr: [4000, 10000] },
  { name: 'Шапка зимняя вязаная', base: 22345000, sizes: ['One size'], colors: ['Чёрный','Серый','Бежевый'], pr: [500, 1500] },
  { name: 'Спортивный костюм', base: 33456000, sizes: ['S','M','L','XL'], colors: ['Чёрный','Серый','Синий'], pr: [3000, 6000] },
  { name: 'Сумка женская кожа', base: 44567000, sizes: ['One size'], colors: ['Чёрный','Бежевый','Красный'], pr: [4000, 12000] },
  { name: 'Детский комбинезон', base: 55678000, sizes: ['86','92','98','104'], colors: ['Розовый','Голубой','Белый'], pr: [2000, 5000] },
];

async function main() {
  const lr = await fetch(`${BASE}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'gototop2026'}) });
  TOKEN = (await lr.json()).token;
  console.log('✅ Logged in');

  // Get all leads
  const leadsRes = await api('GET', '/leads?page=1&limit=200');
  const leads = leadsRes.leads || [];
  console.log(`Found ${leads.length} leads`);

  const buyerIds = [19, 20, 21]; // Diana, Mila, Anna (buyers)
  const payMethods = [1, 2, 3];

  let totalArticlesAdded = 0;
  let totalRefunds = 0;
  let refundCount = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const leadId = lead.id;

    // 1. Check if lead already has articles
    const existingArts = await api('GET', `/leads/${leadId}/articles`);
    const arts = Array.isArray(existingArts) ? existingArts : (existingArts.articles || []);
    
    if (arts.length === 0) {
      // Add 1-3 articles to each lead
      const artCount = randomInt(1, 3);
      for (let a = 0; a < artCount; a++) {
        const prod = randomItem(wbProducts);
        const qty = randomInt(15, 25);
        const ppu = randomInt(prod.pr[0], prod.pr[1]);
        const artNum = prod.base + randomInt(1, 9999);
        
        // Status based on lead status
        let artStatus = 'pending';
        if (lead.status === 'done') artStatus = randomItem(['completed', 'completed', 'completed', 'delivered']);
        else if (lead.status === 'in_progress') artStatus = randomItem(['bought', 'delivered', 'pending']);
        else if (lead.status === 'checking') artStatus = 'delivered';

        await api('POST', `/leads/${leadId}/articles`, {
          wb_article: String(artNum),
          wb_link: `https://www.wildberries.ru/catalog/${artNum}/detail.aspx`,
          product_name: prod.name,
          size: randomItem(prod.sizes),
          color: randomItem(prod.colors),
          quantity: qty,
          price_per_unit: ppu,
          total_price: ppu * qty,
          status: artStatus,
          buyer_id: randomItem(buyerIds),
          notes: ''
        });
        totalArticlesAdded++;
      }
    }

    // 2. Add payment_method_id (PUT doesn't support it, need to check)
    // Actually, let's update via the lead's calc_data to keep things consistent

    // 3. Add refunds for ~15% of done leads (realistic: some items returned)
    if (lead.status === 'done' && Math.random() < 0.15) {
      const refundAmount = randomInt(5000, 50000);
      await api('PUT', `/leads/${leadId}`, { refund_amount: refundAmount });
      totalRefunds += refundAmount;
      refundCount++;
    }

    // 4. Recalc to include articles in total_amount
    await api('POST', `/leads/${leadId}/recalc`);

    if ((i+1) % 20 === 0) console.log(`  ✅ ${i+1}/${leads.length} processed (articles: ${totalArticlesAdded}, refunds: ${refundCount})`);
  }

  console.log(`\n📦 Total articles added: ${totalArticlesAdded}`);
  console.log(`💸 Total refunds: ${refundCount} leads, ${totalRefunds.toLocaleString()} ֏`);

  // 5. Add employee bonuses that we might have missed
  console.log('\n🏆 Adding more bonuses...');
  const empIds = [17, 18, 19, 20, 21, 22, 23];
  const bonusReasons = ['Перевыполнение плана выкупов', 'Отличная обработка клиента', 'Бонус за срочный заказ', 'Привлечение VIP клиента', 'Бонус за фотосессию', 'Быстрая доставка'];
  const penaltyReasons = ['Опоздание на работу', 'Ошибка в артикуле', 'Задержка доставки', 'Потеря товара'];
  
  for (const empId of empIds) {
    // Check if bonuses already exist
    const existing = await api('GET', `/users/${empId}/bonuses`);
    const existingBonuses = Array.isArray(existing) ? existing : (existing.bonuses || []);
    if (existingBonuses.length < 2) {
      // Add 1-3 bonuses
      for (let b = 0; b < randomInt(1, 3); b++) {
        const isBonus = Math.random() > 0.25;
        await api('POST', `/users/${empId}/bonuses`, {
          amount: isBonus ? randomInt(8000, 35000) : -randomInt(3000, 12000),
          bonus_type: isBonus ? 'bonus' : 'penalty',
          bonus_date: `2026-03-${String(randomInt(5, 28)).padStart(2, '0')}`,
          reason: isBonus ? randomItem(bonusReasons) : randomItem(penaltyReasons)
        });
      }
    }
  }
  console.log('  ✅ Bonuses updated');

  // 6. Final P&L verification
  console.log('\n📊 Final P&L:');
  const pnl = await api('GET', '/pnl/2026-03');
  const keys = ['revenue','revenue_services','revenue_articles','revenue_packages','cogs','gross_profit','salary_total','marketing','depreciation','total_opex','ebit','ebitda','ebt','total_taxes','net_profit','effective_loan_payments','net_profit_after_loans','total_dividends','retained_earnings','refunds'];
  for (const k of keys) {
    const v = pnl[k];
    if (v !== undefined && v !== null) console.log(`  ${k}: ${typeof v === 'number' ? v.toLocaleString('ru-RU') : v} ֏`);
  }

  // 7. Count summary
  const allLeads = await api('GET', '/leads?page=1&limit=200');
  const ll = allLeads.leads || [];
  const done = ll.filter(l => l.status === 'done').length;
  const inProg = ll.filter(l => l.status === 'in_progress').length;
  const withRef = ll.filter(l => l.refund_amount > 0).length;
  console.log(`\n📈 Summary: ${ll.length} leads, ${done} done, ${inProg} in_progress, ${withRef} with refunds`);
}

main().catch(e => console.error('FATAL:', e));
