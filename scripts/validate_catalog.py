#!/usr/bin/env python3
"""Independent, strict integrity audit for the canonical Telegram Bot concept catalog."""
import csv
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "Telegram_Bot_Master_Catalog_1000.csv"
README = ROOT / "README.md"
HTML = ROOT / "index.html"
EXPECTED_HEADER = [
    "index", "Bot ID", "Category No", "Category", "English Category",
    "Bot Name", "What it does", "Free/Low-cost Technology", "API Required?",
    "Automation Potential", "Monetization Potential", "Suggested MVP", "Notes",
]

def require(condition, message):
    if not condition:
        raise AssertionError(message)

with DATA.open("r", encoding="utf-8-sig", newline="") as stream:
    reader = csv.DictReader(stream)
    require(reader.fieldnames == EXPECTED_HEADER, f"Unexpected CSV header: {reader.fieldnames!r}")
    records = list(reader)

require(len(records) == 1000, f"Expected 1000 records; got {len(records)}")
require(all(None not in row for row in records), "One or more rows contain extra CSV columns")
require(all(all(str(row.get(k, "")).strip() for k in EXPECTED_HEADER) for row in records),
        "One or more records have missing/blank required fields")

ids = [row["Bot ID"].strip() for row in records]
names = [row["Bot Name"].strip().casefold() for row in records]
require(len(set(ids)) == 1000, "Bot IDs are not unique")
require(len(set(names)) == 1000, "Bot names are not unique (case-insensitive)")
require([int(row["index"]) for row in records] == list(range(1000)),
        "Index must be sequential from 0 through 999")

category_counts = Counter(row["English Category"].strip() for row in records)
require(len(category_counts) == 100, f"Expected 100 English categories; got {len(category_counts)}")
require(set(category_counts.values()) == {10}, "Every category must contain exactly 10 records")

category_labels = {}
category_bengali_labels = {}
per_category_ids = {}
for row in records:
    cat_no = int(row["Category No"])
    require(1 <= cat_no <= 100, f"Category No out of range: {cat_no}")
    require(re.fullmatch(r"B\d{3}-\d{2}", row["Bot ID"].strip()) is not None,
            f"Invalid Bot ID format: {row['Bot ID']}")
    require(row["Bot ID"].startswith(f"B{cat_no:03d}-"),
            f"Bot ID/category mismatch: {row['Bot ID']} vs category {cat_no}")
    eng = row["English Category"].strip()
    ben = row["Category"].strip()
    require(category_labels.setdefault(cat_no, eng) == eng,
            f"Category {cat_no} maps to multiple English labels")
    require(category_bengali_labels.setdefault(cat_no, ben) == ben,
            f"Category {cat_no} maps to multiple Bengali labels")
    per_category_ids.setdefault(cat_no, []).append(row["Bot ID"].strip())

require(set(category_labels) == set(range(1, 101)), "Category numbers must cover 1..100")
for cat_no, values in per_category_ids.items():
    expected = [f"B{cat_no:03d}-{n:02d}" for n in range(1, 11)]
    require(sorted(values) == expected, f"Category {cat_no} must have IDs 01..10")

readme = README.read_text(encoding="utf-8").casefold()
html = HTML.read_text(encoding="utf-8").casefold()
require("not a claim that every named record is an existing public telegram bot" in readme,
        "README must explicitly document that records are concepts, not verified live bots")
require("not a verified directory of live telegram bots" in html,
        "Catalog UI must disclose concept-only scope")
require("admin authentication" in html and "not implemented" in html,
        "System page must disclose that admin authentication is not implemented")
require("backend server" in html and "not used" in html,
        "System page must disclose the static/no-backend boundary")

print("INDEPENDENT CATALOG AUDIT: PASS")
print("Records: 1000 | unique IDs: 1000 | unique names: 1000")
print("Categories: 100 | exactly 10 records per category | blank required fields: 0")
print("ID/category sequence: PASS | concept-only disclosure: PASS")
print("Security boundary disclosure (no backend/admin authentication): PASS")
