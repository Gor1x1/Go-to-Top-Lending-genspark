// QA Seed Script — 1 month simulation for "Go to Top" CRM
// 100 clients, 8 employees, expenses, loans, assets, dividends, taxes

const BASE = 'https://gototop.win/api/admin';
let TOKEN = '';

async function api(method, path, body) {
  const opts = { method, headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t, status: r.status }; }
}

async function login() {
  const r = await fetch(`${BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'gototop2026' }) });
  const d = await r.json();
  TOKEN = d.token;
  console.log('✅ Logged in');
}

// Armenian names
const firstNames = ['Арам','Тигран','Давид','Нарек','Артём','Ваган','Гарик','Самвел','Левон','Грант','Артур','Сурен','Карен','Ашот','Рафаэл','Мгер','Андраник','Завен','Ваагн','Геворг','Мариам','Ани','Лусинэ','Нарэ','Сирануш','Ева','Лиана','Диана','Ирина','Нина','Анна','Гаянэ','Тамара','Соня','Аида','Зара','Элен','Вика','Кристина','Лилит','Арпинэ','Наира','Рузанна','Астхик','Светлана','Маргарита','Асмик','Карина','Алиса','Нуне'];
const lastNames = ['Саркисян','Петросян','Григорян','Акопян','Мартиросян','Авагян','Карапетян','Арутюнян','Оганесян','Мкртчян','Назарян','Абрамян','Геворгян','Тонян','Бабаян','Айрапетян','Минасян','Симонян','Закарян','Галстян','Маргарян','Восканян','Балоян','Хачатрян','Степанян'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDate(day1, day2) {
  const d = randomInt(day1, day2);
  const h = randomInt(8, 21);
  const m = randomInt(0, 59);
  return `2026-03-${String(d).padStart(2,'0')} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
}

async function createEmployees() {
  console.log('\n👥 Creating employees...');
  const employees = [
    { username: 'armen_g', display_name: 'Армен Григорян', role: 'operator', salary: 200000, position_title: 'Старший оператор' },
    { username: 'karen_s', display_name: 'Карен Саркисян', role: 'operator', salary: 180000, position_title: 'Оператор' },
    { username: 'diana_m', display_name: 'Диана Мартиросян', role: 'buyer', salary: 170000, position_title: 'Выкупщик' },
    { username: 'mila_a', display_name: 'Мила Аветисян', role: 'buyer', salary: 170000, position_title: 'Выкупщик' },
    { username: 'anna_p', display_name: 'Анна Петросян', role: 'buyer', salary: 160000, position_title: 'Выкупщик' },
    { username: 'suren_k', display_name: 'Сурен Карапетян', role: 'analyst', salary: 250000, position_title: 'Бизнес-аналитик' },
    { username: 'levon_h', display_name: 'Левон Хачатрян', role: 'courier', salary: 150000, position_title: 'Курьер' },
  ];
  const ids = [];
  for (const emp of employees) {
    const r = await api('POST', '/users', { ...emp, password: 'test1234', hire_date: '2026-02-01', is_active: 1 });
    const id = r.id || r.user?.id || r.userId;
    ids.push(id);
    console.log(`  + ${emp.display_name} (${emp.role}) → id=${id}`);
  }
  return ids;
}

async function createExpenses() {
  console.log('\n💰 Creating expenses...');
  const expenses = [
    { name: 'Аренда офиса (Ереван)', amount: 250000, category_id: 2, is_marketing: 0 },
    { name: 'Интернет + мобильная связь', amount: 30000, category_id: 5, is_marketing: 0 },
    { name: 'Хостинг Cloudflare + домен', amount: 15000, category_id: 9, is_marketing: 0 },
    { name: 'Канцелярия и расходники', amount: 10000, category_id: 6, is_marketing: 0 },
    { name: 'Транспорт / доставка ПВЗ', amount: 45000, category_id: 4, is_marketing: 0 },
    { name: 'Упаковочные материалы', amount: 20000, category_id: 6, is_marketing: 0 },
    { name: 'Instagram реклама', amount: 120000, category_id: 1, is_marketing: 1 },
    { name: 'Google Ads', amount: 80000, category_id: 1, is_marketing: 1 },
    { name: 'Telegram реклама', amount: 40000, category_id: 10, is_marketing: 1 },
    { name: 'Бухгалтер (аутсорс)', amount: 35000, category_id: 8, is_marketing: 0 },
    { name: '1С Бухгалтерия лицензия', amount: 8000, category_id: 3, is_marketing: 0 },
  ];
  for (const exp of expenses) {
    const r = await api('POST', '/expenses', { ...exp, start_date: '2026-03-01', end_date: '', is_active: 1, frequency_type_id: 1 });
    console.log(`  + ${exp.name}: ${exp.amount} ֏ → ${r.success || r.id || 'ok'}`);
  }
}

async function createReferralCodes() {
  console.log('\n🎁 Creating referral codes...');
  const codes = [
    { code: 'WELCOME10', discount_percent: 10, description: 'Скидка 10% для новых клиентов', is_active: 1 },
    { code: 'VIP20', discount_percent: 20, description: 'VIP скидка 20%', is_active: 1 },
    { code: 'PARTNER15', discount_percent: 15, description: 'Партнёрская скидка 15%', is_active: 1 },
    { code: 'SPRING2026', discount_percent: 12, description: 'Весенняя акция 12%', is_active: 1 },
    { code: 'FIRST5FREE', discount_percent: 5, description: 'Первый заказ -5%', is_active: 1 },
    { code: 'MEGA30', discount_percent: 30, description: 'Мега-скидка 30%', is_active: 1 },
  ];
  for (const c of codes) {
    const r = await api('POST', '/referrals', c);
    console.log(`  + ${c.code} (${c.discount_percent}%) → ${r.id || r.success || JSON.stringify(r).substring(0,60)}`);
  }
}

async function createLeads(employeeIds) {
  console.log('\n👤 Creating 100 leads...');
  
  // Services from calculator
  const svcSets = [
    // Full service: выкуп + забор + отзыв + перемаркировка + доставка
    [{ id: 1, name: 'Выкуп + забор из ПВЗ', price: 2000, qty: 20 }, { id: 4, name: 'Оценка + отзыв', price: 500, qty: 5 }, { id: 14, name: 'Замена штрихкода', price: 100, qty: 20 }, { id: 17, name: 'Доставка на склад WB', price: 2000, qty: 1 }],
    // Выкуп + отзывы + вопросы
    [{ id: 1, name: 'Выкуп + забор из ПВЗ', price: 2000, qty: 15 }, { id: 4, name: 'Оценка + отзыв', price: 500, qty: 10 }, { id: 5, name: 'Вопрос к товару', price: 500, qty: 5 }],
    // КГТ выкуп + переупаковка + доставка
    [{ id: 27, name: 'Выкуп КГТ + забор из ПВЗ', price: 2500, qty: 10 }, { id: 15, name: 'Переупаковка (наша)', price: 200, qty: 10 }, { id: 31, name: 'Короб', price: 500, qty: 2 }, { id: 17, name: 'Доставка на склад WB', price: 2000, qty: 1 }],
    // Фото + выкуп
    [{ id: 1, name: 'Выкуп + забор из ПВЗ', price: 2000, qty: 25 }, { id: 8, name: 'Фото гардеробная жен', price: 3500, qty: 1 }, { id: 13, name: 'Видеообзор', price: 6000, qty: 1 }],
    // Только отзывы + оценки
    [{ id: 28, name: 'Оценка', price: 300, qty: 20 }, { id: 4, name: 'Оценка + отзыв', price: 500, qty: 10 }, { id: 6, name: 'Написание текста отзыва', price: 250, qty: 10 }],
    // Выкуп + фото мужская + доставка
    [{ id: 1, name: 'Выкуп + забор из ПВЗ', price: 2000, qty: 20 }, { id: 9, name: 'Фото гардеробная муж', price: 4500, qty: 1 }, { id: 14, name: 'Замена штрихкода', price: 100, qty: 20 }],
    // Детская одежда: выкуп + фото ребёнок + глажка
    [{ id: 1, name: 'Выкуп + забор из ПВЗ', price: 2000, qty: 15 }, { id: 12, name: 'Фото ребёнок', price: 2500, qty: 1 }, { id: 19, name: 'Глажка одежды', price: 1500, qty: 5 }],
    // Минимальный: только выкупы
    [{ id: 1, name: 'Выкуп + забор из ПВЗ', price: 2000, qty: 20 }],
    // Предметное фото + выкуп техника
    [{ id: 27, name: 'Выкуп КГТ + забор из ПВЗ', price: 2500, qty: 5 }, { id: 11, name: 'Предметная фото крупное', price: 5000, qty: 1 }, { id: 10, name: 'Предметное фото', price: 2500, qty: 1 }],
    // Полный цикл: всё
    [{ id: 1, name: 'Выкуп + забор из ПВЗ', price: 2000, qty: 20 }, { id: 4, name: 'Оценка + отзыв', price: 500, qty: 10 }, { id: 5, name: 'Вопрос к товару', price: 500, qty: 5 }, { id: 14, name: 'Замена штрихкода', price: 100, qty: 20 }, { id: 15, name: 'Переупаковка', price: 200, qty: 20 }, { id: 17, name: 'Доставка на склад WB', price: 2000, qty: 1 }, { id: 19, name: 'Глажка', price: 1500, qty: 5 }],
  ];

  // Package options (with realistic prices)
  const packageOptions = [
    null, null, null, null, null, null, null, // 65% no package
    { name: 'пакет старт', package_price: 59900, id: 2 },
    { name: 'paket premium', package_price: 70000, id: 3 },
    { name: 'pak', package_price: 50000, id: 4 },
  ];

  const sources = ['calculator_pdf','calculator_pdf','calculator_pdf','calculator_pdf','manual','manual','website','instagram','telegram','phone','whatsapp','referral'];
  const statuses = [];
  // 70 done, 15 in_progress, 8 new, 5 rejected, 2 checking
  for (let i = 0; i < 70; i++) statuses.push('done');
  for (let i = 0; i < 15; i++) statuses.push('in_progress');
  for (let i = 0; i < 8; i++) statuses.push('new');
  for (let i = 0; i < 5; i++) statuses.push('rejected');
  for (let i = 0; i < 2; i++) statuses.push('checking');
  // Shuffle
  for (let i = statuses.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [statuses[i], statuses[j]] = [statuses[j], statuses[i]]; }

  const refCodes = ['', '', '', '', '', '', '', 'WELCOME10', 'VIP20', 'PARTNER15', 'SPRING2026', 'FIRST5FREE', 'MEGA30'];
  const payMethods = [1, 2, 3]; // Расч. счёт 6%, Карта 2%, Cash-out 0%
  const buyerIds = employeeIds.filter((_, i) => [2,3,4].includes(i)); // Diana, Mila, Anna
  const operatorIds = employeeIds.filter((_, i) => [0,1].includes(i)); // Armen, Karen
  const assignableIds = [...buyerIds, ...operatorIds];

  const leadIds = [];
  
  // WB articles templates
  const wbProducts = [
    { name: 'Футболка мужская хлопок', article: '12345678', sizes: ['S','M','L','XL'], colors: ['Чёрный','Белый','Серый'], priceRange: [800, 2500] },
    { name: 'Платье женское летнее', article: '23456789', sizes: ['XS','S','M','L'], colors: ['Красный','Синий','Зелёный'], priceRange: [2000, 5000] },
    { name: 'Кроссовки спортивные', article: '34567890', sizes: ['38','39','40','41','42','43'], colors: ['Белый','Чёрный'], priceRange: [3000, 8000] },
    { name: 'Куртка зимняя мужская', article: '45678901', sizes: ['M','L','XL','XXL'], colors: ['Чёрный','Тёмно-синий'], priceRange: [5000, 15000] },
    { name: 'Джинсы женские slim', article: '56789012', sizes: ['25','26','27','28','29','30'], colors: ['Синий','Голубой'], priceRange: [2000, 4000] },
    { name: 'Рюкзак городской', article: '67890123', sizes: ['One size'], colors: ['Чёрный','Серый','Хаки'], priceRange: [1500, 4000] },
    { name: 'Худи оверсайз', article: '78901234', sizes: ['S','M','L','XL'], colors: ['Чёрный','Белый','Бежевый'], priceRange: [1500, 3500] },
    { name: 'Леггинсы спортивные', article: '89012345', sizes: ['XS','S','M','L'], colors: ['Чёрный','Серый'], priceRange: [1000, 2500] },
    { name: 'Пуховик женский', article: '90123456', sizes: ['S','M','L','XL'], colors: ['Белый','Чёрный','Розовый'], priceRange: [8000, 20000] },
    { name: 'Ботинки кожаные', article: '01234567', sizes: ['39','40','41','42','43'], colors: ['Коричневый','Чёрный'], priceRange: [4000, 10000] },
  ];

  for (let i = 0; i < 100; i++) {
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const name = `${lastName} ${firstName}`;
    const phone = `+374${randomInt(10,99)}${randomInt(100,999)}${randomInt(100,999)}`;
    const status = statuses[i];
    const source = randomItem(sources);
    const assigned = randomItem(assignableIds);
    const pmId = randomItem(payMethods);
    const refCode = randomItem(refCodes);
    const svcSet = randomItem(svcSets);
    const pkg = randomItem(packageOptions);

    // Calculate services total
    let svcTotal = 0;
    const items = svcSet.map(s => {
      const sub = s.price * s.qty;
      svcTotal += sub;
      return { name: s.name, qty: s.qty, price: s.price, subtotal: sub, service_id: s.id };
    });

    let discPercent = 0, discAmount = 0;
    if (refCode) {
      const discMap = { 'WELCOME10': 10, 'VIP20': 20, 'PARTNER15': 15, 'SPRING2026': 12, 'FIRST5FREE': 5, 'MEGA30': 30 };
      discPercent = discMap[refCode] || 0;
      discAmount = Math.round(svcTotal * discPercent / 100);
    }
    const pkgPrice = pkg ? pkg.package_price : 0;
    const totalAmount = Math.max(0, svcTotal - discAmount) + pkgPrice;

    const calcData = {
      items, subtotal: svcTotal, servicesSubtotal: svcTotal, articlesSubtotal: 0, total: totalAmount,
      refund: 0, referralCode: refCode, discountPercent: discPercent, discountAmount: discAmount, freeServices: [],
      ...(pkg ? { package: { id: pkg.id, name: pkg.name, package_price: pkg.package_price } } : {})
    };

    const createdAt = randomDate(1, 28);
    
    const leadData = {
      name, contact: phone, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@mail.am`,
      source, status, notes: `Клиент ${i+1}: ${svcSet.length} услуг, ${svcSet.reduce((s,x) => s + x.qty, 0)} шт выкупов`,
      assigned_to: assigned, total_amount: totalAmount, payment_method_id: pmId,
      referral_code: refCode, created_at: createdAt, calc_data: JSON.stringify(calcData)
    };

    const r = await api('POST', '/leads', leadData);
    const leadId = r.id || r.leadId || r.lead_id;
    if (leadId) leadIds.push(leadId);

    // Add 1-3 WB articles
    if (leadId) {
      const artCount = randomInt(1, 3);
      for (let a = 0; a < artCount; a++) {
        const prod = randomItem(wbProducts);
        const qty = randomInt(15, 25);
        const ppu = randomInt(prod.priceRange[0], prod.priceRange[1]);
        await api('POST', `/leads/${leadId}/articles`, {
          wb_article: String(Number(prod.article) + randomInt(1, 999)),
          wb_link: `https://www.wildberries.ru/catalog/${Number(prod.article) + randomInt(1,999)}/detail.aspx`,
          product_name: prod.name, size: randomItem(prod.sizes), color: randomItem(prod.colors),
          quantity: qty, price_per_unit: ppu, total_price: ppu * qty,
          status: ['pending','bought','delivered','completed'][randomInt(0,3)],
          buyer_id: randomItem(buyerIds), notes: ''
        });
      }
      // Recalc to update totals
      await api('POST', `/leads/${leadId}/recalc`);
    }

    if ((i+1) % 10 === 0) console.log(`  ✅ ${i+1}/100 leads created (latest: ${name} → ${status}, ${totalAmount} ֏)`);
  }
  return leadIds;
}

async function createBonuses(employeeIds) {
  console.log('\n🏆 Creating employee bonuses...');
  for (const empId of employeeIds) {
    // 1-2 bonuses per employee
    const bonusCount = randomInt(1, 2);
    for (let b = 0; b < bonusCount; b++) {
      const isBonus = Math.random() > 0.2;
      const amount = isBonus ? randomInt(10000, 30000) : -randomInt(5000, 15000);
      await api('POST', `/users/${empId}/bonuses`, {
        amount, bonus_type: isBonus ? 'bonus' : 'penalty',
        bonus_date: `2026-03-${String(randomInt(15, 28)).padStart(2, '0')}`,
        reason: isBonus ? randomItem(['Перевыполнение плана', 'Отличная работа с клиентом', 'Бонус за срочный заказ', 'Привлечение нового клиента']) : randomItem(['Опоздание', 'Ошибка в заказе', 'Нарушение SLA'])
      });
    }
  }
  console.log('  ✅ Bonuses created');
}

async function createLoans() {
  console.log('\n🏦 Creating loans...');
  // Business loan
  const loan1 = await api('POST', '/loans', {
    name: 'Бизнес-кредит Америабанк', lender: 'Америабанк', principal: 5000000,
    interest_rate: 14.5, term_months: 24, remaining_balance: 3638200,
    start_date: '2025-06-01', end_date: '2028-06-01', payment_type: 'annuity',
    monthly_payment: 172000, purpose: 'Кредит на развитие бизнеса', is_active: 1
  });
  console.log(`  + Бизнес-кредит → ${loan1.id || 'ok'}`);

  // Partner loan
  const loan2 = await api('POST', '/loans', {
    name: 'Займ от партнёра', lender: 'Вардан Авагян (партнёр)', principal: 1500000,
    interest_rate: 8, term_months: 12, remaining_balance: 1142250,
    start_date: '2026-01-15', end_date: '2027-01-15', payment_type: 'manual',
    monthly_payment: 135000, purpose: 'Частный займ на маркетинг', is_active: 1
  });
  console.log(`  + Займ от партнёра → ${loan2.id || 'ok'}`);

  // Overdraft
  const loan3 = await api('POST', '/loans', {
    name: 'Овердрафт Араратбанк', lender: 'Араратбанк', principal: 2000000,
    interest_rate: 18, term_months: 12, remaining_balance: 450000,
    start_date: '2025-09-01', end_date: '2026-09-01', payment_type: 'overdraft',
    monthly_payment: 0, purpose: 'Овердрафт для покрытия кассовых разрывов',
    is_active: 1, credit_limit: 2000000
  });
  console.log(`  + Овердрафт → ${loan3.id || 'ok'}`);

  // Loan payments
  if (loan1.id) {
    await api('POST', `/loans/${loan1.id}/payments`, { amount: 172000, payment_date: '2026-03-15', principal_part: 128038, interest_part: 43962, notes: 'Ежемесячный платёж' });
    console.log('  + Платёж по бизнес-кредиту');
  }
  if (loan2.id) {
    await api('POST', `/loans/${loan2.id}/payments`, { amount: 135000, payment_date: '2026-03-20', principal_part: 127385, interest_part: 7615, notes: 'Ежемесячный платёж' });
    console.log('  + Платёж по займу');
  }
}

async function createAssets() {
  console.log('\n🏗️ Creating assets...');
  const assets = [
    { name: 'MacBook Pro 16" M3 (x3)', category: 'Компьютеры', purchase_date: '2025-01-15', cost: 900000, useful_life_months: 36, residual_value: 150000 },
    { name: 'iMac 27" (x2)', category: 'Компьютеры', purchase_date: '2025-03-01', cost: 500000, useful_life_months: 48, residual_value: 0 },
    { name: 'Фотостудия (свет, фоны)', category: 'Оборудование', purchase_date: '2025-09-01', cost: 180000, useful_life_months: 48, residual_value: 20000 },
    { name: 'Сервер Dell PowerEdge', category: 'Серверы', purchase_date: '2025-06-15', cost: 280000, useful_life_months: 60, residual_value: 30000 },
    { name: 'Мебель офисная (столы, стулья)', category: 'Мебель', purchase_date: '2025-01-01', cost: 350000, useful_life_months: 84, residual_value: 50000 },
    { name: 'Принтер HP LaserJet Pro', category: 'Оргтехника', purchase_date: '2023-06-01', cost: 45000, useful_life_months: 60, residual_value: 6000 },
    { name: 'Кондиционер (x2)', category: 'Оборудование', purchase_date: '2025-04-01', cost: 120000, useful_life_months: 96, residual_value: 10000 },
    { name: 'Лицензия 1С:Бухгалтерия', category: 'ПО', purchase_date: '2025-01-01', cost: 50000, useful_life_months: 36, residual_value: 0 },
  ];
  for (const a of assets) {
    const r = await api('POST', '/assets', a);
    console.log(`  + ${a.name} → ${r.id || 'ok'}`);
  }
}

async function createDividends() {
  console.log('\n💵 Creating dividends...');
  await api('POST', '/dividends', {
    recipient: 'Георгий Дарбинян (основатель)', amount: 150000,
    tax_amount: 7500, payment_date: '2026-03-28', period_key: '2026-03',
    calc_type: 'net_after_loans', calc_percent: 30, frequency: 'monthly',
    notes: 'Ежемесячные дивиденды — 30% от чистой прибыли'
  });
  console.log('  + Дивиденды Георгий: 150,000 + налог 7,500');
}

async function createOtherIncomeExpenses() {
  console.log('\n📊 Creating other income/expenses...');
  await api('POST', '/other-income-expenses', { type: 'income', name: 'Субаренда части офиса', amount: 50000, date: '2026-03-01', period_key: '2026-03', notes: 'Сдаём часть офиса партнёру' });
  await api('POST', '/other-income-expenses', { type: 'income', name: 'Консультационные услуги', amount: 38000, date: '2026-03-15', period_key: '2026-03', notes: 'Консультация по WB для нового клиента' });
  await api('POST', '/other-income-expenses', { type: 'expense', name: 'Ремонт оборудования', amount: 25000, date: '2026-03-10', period_key: '2026-03', notes: 'Ремонт принтера' });
  await api('POST', '/other-income-expenses', { type: 'expense', name: 'Корпоратив команды', amount: 45000, date: '2026-03-20', period_key: '2026-03', notes: 'Тимбилдинг март' });
  await api('POST', '/other-income-expenses', { type: 'expense', name: 'Штраф за парковку', amount: 5000, date: '2026-03-12', period_key: '2026-03', notes: 'Штраф курьеру' });
  console.log('  ✅ Прочие доходы/расходы созданы');
}

async function createTaxPayments() {
  console.log('\n🧾 Creating tax payments...');
  await api('POST', '/tax-payments', {
    tax_type: 'income_tax', tax_name: 'Налог на прибыль (ИП) 5%', amount: 0,
    period_key: '2026-03', due_date: '2026-04-20', status: 'pending',
    tax_rate: 5, tax_base: 'turnover_excl_transit', is_auto: 1,
    notes: '5% от оборота (без транзитных выкупов)'
  });
  await api('POST', '/tax-payments', {
    tax_type: 'social_tax', tax_name: 'Социальный взнос март', amount: 40000,
    period_key: '2026-03', payment_date: '2026-03-15', due_date: '2026-03-15', status: 'paid',
    notes: '8 сотрудников × 5000 ֏'
  });
  console.log('  ✅ Налоги созданы');
}

async function verifyPnL() {
  console.log('\n📊 Verifying P&L...');
  const pnl = await api('GET', '/pnl/2026-03');
  console.log(`  Revenue: ${pnl.revenue?.toLocaleString()} ֏`);
  console.log(`  Services: ${pnl.revenue_services?.toLocaleString()} ֏`);
  console.log(`  Articles: ${pnl.revenue_articles?.toLocaleString()} ֏`);
  console.log(`  Packages: ${pnl.revenue_packages?.toLocaleString()} ֏`);
  console.log(`  COGS: ${pnl.cogs?.toLocaleString()} ֏`);
  console.log(`  Gross: ${pnl.gross_profit?.toLocaleString()} ֏`);
  console.log(`  Salary: ${pnl.salary_total?.toLocaleString()} ֏`);
  console.log(`  Marketing: ${pnl.marketing?.toLocaleString()} ֏`);
  console.log(`  EBIT: ${pnl.ebit?.toLocaleString()} ֏`);
  console.log(`  Taxes: ${pnl.total_taxes?.toLocaleString()} ֏`);
  console.log(`  Net Profit: ${pnl.net_profit?.toLocaleString()} ֏`);
  return pnl;
}

// Main
async function main() {
  console.log('🚀 QA Seed — Go to Top CRM — March 2026 Simulation');
  console.log('=' .repeat(60));
  
  await login();
  await createReferralCodes();
  const empIds = await createEmployees();
  await createExpenses();
  await createLeads(empIds);
  await createBonuses(empIds);
  await createLoans();
  await createAssets();
  await createDividends();
  await createOtherIncomeExpenses();
  await createTaxPayments();
  
  const pnl = await verifyPnL();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ QA SEED COMPLETE!');
  console.log(`  100 leads, 8 employees, expenses, loans, assets, dividends, taxes`);
  console.log(`  Revenue: ${pnl.revenue?.toLocaleString()} ֏`);
  console.log(`  Net Profit: ${pnl.net_profit?.toLocaleString()} ֏`);
}

main().catch(e => console.error('FATAL:', e));
