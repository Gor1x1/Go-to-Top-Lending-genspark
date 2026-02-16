#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re, sys

with open('src/index.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Step 1: Find all data-ru="X" data-am="Y" pairs and collect the Russian text
pairs = re.findall(r'data-ru="([^"]+)"\s+data-am="([^"]+)"', c)
print(f"Found {len(pairs)} data-ru/data-am pairs")

# Step 2: Full Russian -> Armenian Unicode map
M = {
    # NAV
    "Услуги": "Ծառայություններ",
    "Калькулятор": "Հաշվիչ",
    "Склад": "Պահեստ",
    "Гарантии": "Երdelays",
    "FAQ": "ΗΤΗ",
    "Контакты": "Контакты-am",
    "Написать нам": "Գress",
}

# OK I see the issue - I cannot reliably type Armenian Unicode in this context.
# Let me try a different approach: write actual Armenian chars

armenian_test = "Ծառdelays"
print(f"Armenian test: {armenian_test}")
print(f"Bytes: {armenian_test.encode('utf-8')}")

# The issue is that my Armenian text keeps getting corrupted
# Let me verify I can write proper Armenian
test2 = "\u0548\u057e\u0561\u0576\u0575\u0561\u056f"  # Unicode escapes for Armenian
print(f"Unicode test: {test2}")
