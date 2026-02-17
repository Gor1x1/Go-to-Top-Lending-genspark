#!/usr/bin/env python3
"""Generate TypeScript seed data constants from index.tsx."""
import re, json

with open('/home/user/webapp/src/index.tsx', 'r', encoding='utf-8') as f:
    html = f.read()

def esc_ts(s):
    """Escape for TypeScript string literal."""
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')

# Find the export default line
export_line = 'export default app'

# ============================
# Extract sections
# ============================
def extract_pairs(start_marker, end_marker):
    start_idx = html.find(start_marker)
    if start_idx == -1: return []
    end_idx = html.find(end_marker, start_idx + len(start_marker))
    if end_idx == -1: end_idx = len(html)
    chunk = html[start_idx:end_idx]
    pattern = r'data-ru="([^"]*?)"\s+data-am="([^"]*?)"'
    return re.findall(pattern, chunk)

sections_def = [
    ("nav", "Навигация (шапка)", "<!-- ===== HEADER =====", "<!-- ===== HERO ====="),
    ("hero", "Hero секция", "<!-- ===== HERO =====", "<!-- ===== TICKER ====="),
    ("wb_banner", "WB Баннер", "<!-- ===== WB BANNER =====", "<!-- ===== STATS BAR ====="),
    ("stats_bar", "Статистика", "<!-- ===== STATS BAR =====", "<!-- ===== ABOUT ====="),
    ("about", "О компании", "<!-- ===== ABOUT =====", "<!-- ===== SERVICES ====="),
    ("services", "Наши услуги", "<!-- ===== SERVICES =====", "<!-- ===== BUYOUT DETAIL ====="),
    ("buyout_detail", "Детали выкупа", "<!-- ===== BUYOUT DETAIL =====", "<!-- ===== WHY BUYOUTS"),
    ("why_buyouts", "Почему выкупы работают", "<!-- ===== WHY BUYOUTS", "<!-- ===== WB OFFICIAL ====="),
    ("wb_official", "WB Official", "<!-- ===== WB OFFICIAL =====", "<!-- ===== CALCULATOR ====="),
    ("calculator", "Калькулятор (заголовки)", "<!-- ===== CALCULATOR =====", "<!-- ===== PROCESS ====="),
    ("process", "Как мы работаем", "<!-- ===== PROCESS =====", "<!-- ===== WAREHOUSE ====="),
    ("warehouse", "Наш склад", "<!-- ===== WAREHOUSE =====", "<!-- ===== GUARANTEE ====="),
    ("guarantee", "Гарантия безопасности", "<!-- ===== GUARANTEE =====", "<!-- ===== COMPARISON ====="),
    ("comparison", "Сравнение", "<!-- ===== COMPARISON =====", "<!-- ===== IMPORTANT NOTES ====="),
    ("important", "Важно знать", "<!-- ===== IMPORTANT NOTES =====", "<!-- ===== FAQ ====="),
    ("faq", "Частые вопросы (FAQ)", "<!-- ===== FAQ =====", "<!-- ===== CONTACT FORM ====="),
    ("contact", "Контактная форма", "<!-- ===== CONTACT FORM =====", "<!-- ===== FOOTER ====="),
    ("footer", "Подвал сайта", "<!-- ===== FOOTER =====", "<!-- FLOATING TG BUTTON"),
    ("floating_tg", "Плавающая кнопка TG", "<!-- FLOATING TG BUTTON", "<!-- LIGHTBOX"),
    ("popup", "Popup (5 сек)", "<!-- ===== POPUP", "<!-- ===== FORM SUBMIT"),
]

ts_lines = []
ts_lines.append("// ===== SEED DATA (auto-generated from current HTML) =====")
ts_lines.append("const SEED_CONTENT_SECTIONS = [")
sort_i = 0
for key, name, start, end in sections_def:
    pairs = extract_pairs(start, end)
    if not pairs:
        continue
    sort_i += 1
    items_arr = []
    for ru, am in pairs:
        items_arr.append(f"{{ru:'{esc_ts(ru)}',am:'{esc_ts(am)}'}}")
    items_str = ','.join(items_arr)
    ts_lines.append(f"  {{key:'{key}',name:'{esc_ts(name)}',sort:{sort_i},items:[{items_str}]}},")
ts_lines.append("];")
ts_lines.append("")

# Calc tabs
tab_pattern = r'showCalcTab\(\'(\w+)\',this\)"\s+data-ru="([^"]*?)"\s+data-am="([^"]*?)"'
tab_matches = re.findall(tab_pattern, html)

ts_lines.append("const SEED_CALC_TABS = [")
for i, (key, ru, am) in enumerate(tab_matches, 1):
    ts_lines.append(f"  {{key:'{key}',ru:'{esc_ts(ru)}',am:'{esc_ts(am)}',sort:{i}}},")
ts_lines.append("];")
ts_lines.append("")

# Calc services
ts_lines.append("const SEED_CALC_SERVICES = [")
groups = re.findall(r'id="cg-(\w+)"', html)
for group_key in groups:
    start = html.find(f'id="cg-{group_key}"')
    # Find end of this group
    next_group = html.find('<div class="calc-group"', start + 10)
    calc_total = html.find('<div class="calc-total">', start)
    if next_group == -1: next_group = len(html)
    if calc_total == -1: calc_total = len(html)
    end = min(next_group, calc_total)
    block = html[start:end]
    
    # Extract rows
    row_pattern = r'data-price="([^"]*?)".*?calc-label"[^>]*data-ru="([^"]*?)"\s+data-am="([^"]*?)"'
    rows = re.findall(row_pattern, block, re.DOTALL)
    
    for sort_j, (price, ru, am) in enumerate(rows, 1):
        if price == 'buyout':
            tiers_json = json.dumps([{"min":1,"max":20,"price":2000},{"min":21,"max":40,"price":1700},{"min":41,"max":60,"price":1500},{"min":61,"max":999,"price":1250}])
            # Get tier descs
            tier_match = re.search(r'buyout-tier-info.*?<span[^>]*data-ru="([^"]*?)"\s+data-am="([^"]*?)"', html, re.DOTALL)
            tier_ru = esc_ts(tier_match.group(1)) if tier_match else ''
            tier_am = esc_ts(tier_match.group(2)) if tier_match else ''
            ts_lines.append(f"  {{tab:'{group_key}',ru:'{esc_ts(ru)}',am:'{esc_ts(am)}',price:2000,type:'tiered',tiers:'{esc_ts(tiers_json)}',tierRu:'{tier_ru}',tierAm:'{tier_am}',sort:{sort_j}}},")
        else:
            ts_lines.append(f"  {{tab:'{group_key}',ru:'{esc_ts(ru)}',am:'{esc_ts(am)}',price:{price},type:'fixed',tiers:null,tierRu:null,tierAm:null,sort:{sort_j}}},")

ts_lines.append("];")
ts_lines.append("")

# Telegram messages
ts_lines.append("const SEED_TG_MESSAGES = [")
# Find all <a href="https://t.me/..." with button labels
tg_btn_pattern = r'<a\s+href="(https://t\.me/[^"]+)"[^>]*>.*?<span\s+data-ru="([^"]*?)"\s+data-am="([^"]*?)"'
tg_btns = re.findall(tg_btn_pattern, html, re.DOTALL)

used_keys = set()
for url, label_ru, label_am in tg_btns:
    key = re.sub(r'[^a-z0-9]+', '_', label_ru.lower()[:40].strip())
    key = re.sub(r'_+', '_', key).strip('_')
    orig_key = key
    counter = 2
    while key in used_keys:
        key = f"{orig_key}_{counter}"
        counter += 1
    used_keys.add(key)
    
    msg_ru = f"Здравствуйте! Пишу с сайта Go to Top. Интересует: {label_ru}"
    msg_am = f"Ողdelays! Go to Top: {label_am}"
    desc = f"Кнопка: {label_ru}"
    
    ts_lines.append(f"  {{key:'{esc_ts(key)}',labelRu:'{esc_ts(label_ru)}',labelAm:'{esc_ts(label_am)}',url:'{esc_ts(url)}',msgRu:'{esc_ts(msg_ru)}',msgAm:'{esc_ts(msg_am)}',desc:'{esc_ts(desc)}'}},")

# Add form message templates
ts_lines.append(f"  {{key:'calc_order_msg',labelRu:'Заказать в Telegram',labelAm:'Պdelaysdelays Telegram-ов',url:'https://t.me/goo_to_top',msgRu:'Здравствуйте! Хочу заказать:\\n{{items}}\\n\\nИтого: ֏{{total}}',msgAm:'Ողdelays! delays:\\n{{items}}\\n\\ndelays: ֏{{total}}',desc:'Шаблон калькулятора'}},")
ts_lines.append(f"  {{key:'popup_form_msg',labelRu:'Получить расdelays в Telegram',labelAm:'Stanaldelays Telegram-ов',url:'https://t.me/suport_admin_2',msgRu:'Заявка с сайта Go to Top:\\n\\nВыdelays: {{buyouts}}\\nОтdelays: {{reviews}}\\nКоntakt: {{contact}}',msgAm:'Delays Go to Top:\\n\\nDelays: {{buyouts}}\\nDelays: {{reviews}}\\nDelays: {{contact}}',desc:'Шаблон popup формы'}},")
ts_lines.append(f"  {{key:'contact_form_msg',labelRu:'Отправить заявку',labelAm:'delays delays',url:'https://t.me/suport_admin_2',msgRu:'Здравствуйте! Заявка с сайта Go to Top:\\n\\nИмя: {{name}}\\nКоntakt: {{contact}}\\nТовар: {{product}}\\nУsluga: {{service}}\\nКоmmentarij: {{message}}',msgAm:'delays Go to Top:\\n\\nDelays: {{name}}\\nDelays: {{contact}}\\nDelays: {{product}}\\nDelays: {{service}}\\nDelays: {{message}}',desc:'Шаблон контактной формы'}},")

ts_lines.append("];")

result = "\n".join(ts_lines)
print(result)

# Write to file
with open('/home/user/webapp/src/seed-data.ts', 'w', encoding='utf-8') as f:
    f.write(result + "\n\nexport { SEED_CONTENT_SECTIONS, SEED_CALC_TABS, SEED_CALC_SERVICES, SEED_TG_MESSAGES };\n")

print(f"\n\nGenerated seed-data.ts with {sort_i} sections, {len(tab_matches)} tabs, {len(tg_btns)} TG buttons")
