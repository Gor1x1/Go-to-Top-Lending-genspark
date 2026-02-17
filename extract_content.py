#!/usr/bin/env python3
"""Extract all texts, prices, and Telegram messages from index.tsx to generate proper seed SQL."""

import re

with open('/home/user/webapp/src/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all data-ru / data-am pairs
pattern = r'data-ru="([^"]*?)"\s+data-am="([^"]*?)"'
matches = re.findall(pattern, content)

print(f"Found {len(matches)} data-ru/data-am pairs")
for i, (ru, am) in enumerate(matches):
    # Escape single quotes for SQL
    ru_esc = ru.replace("'", "''")
    am_esc = am.replace("'", "''")
    print(f"{i+1}. RU: {ru_esc[:80]}...")
    print(f"   AM: {am_esc[:80]}...")
    print()

# Extract Telegram URLs
tg_pattern = r'href="(https://t\.me/[^"]+)"'
tg_urls = re.findall(tg_pattern, content)
unique_tg = set(tg_urls)
print(f"\nTelegram URLs found: {unique_tg}")

# Extract calculator prices
price_pattern = r'data-price="(\d+)"'
prices = re.findall(price_pattern, content)
print(f"\nCalculator prices: {prices}")
