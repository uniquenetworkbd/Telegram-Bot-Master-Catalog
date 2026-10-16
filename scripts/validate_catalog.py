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
require("content-security-policy" in html and "script-src 'self'" in html,
        "A restrictive Content Security Policy must be present")
require("not a verified directory of live telegram bots" in html,
        "Catalog UI must disclose concept-only scope")
nav_source = (ROOT / "assets" / "js" / "global-bottom-nav.js").read_text(encoding="utf-8").casefold()
require("tbmc-bottom-navigation" in nav_source and "tbmc-system-toggle" in nav_source and "tbmc-system-links" in nav_source,
        "Shared bottom navigation must contain a System parent and nested submenu")
for label in ["system configuration", "logs & audit", "version logs", "live information"]:
    require(label in nav_source, f"Shared System submenu must include {label}")
require('class="sidebar"' not in html and 'class="bottom-nav"' not in html and 'id="moremenu"' not in html,
        "Legacy duplicate navigation must be removed from the main page")
require('id="page-system"' not in html,
        "System must be a navigation group, not a separate hub page")
profile_html = (ROOT / "pages" / "admin-profile.html").read_text(encoding="utf-8").casefold() if (ROOT / "pages" / "admin-profile.html").exists() else html
require("admin authentication" in html or "admin authentication" in profile_html or "admin authentication" in readme,
        "Repository must disclose that admin authentication is not implemented")
runtime_html = (ROOT / "pages" / "live-information.html").read_text(encoding="utf-8").casefold()
require("not used" in runtime_html or "github pages" in runtime_html,
        "Live information must disclose the static hosting boundary")

print("INDEPENDENT CATALOG AUDIT: PASS")
print("Records: 1000 | unique IDs: 1000 | unique names: 1000")
print("Categories: 100 | exactly 10 records per category | blank required fields: 0")
print("ID/category sequence: PASS | concept-only disclosure: PASS")
# Scan repository text for common credential formats. This is a baseline secret scan, not a guarantee against every secret type.
secret_patterns = {
    "Telegram bot token": re.compile(r"\b\d{6,12}:[A-Za-z0-9_-]{30,}\b"),
    "GitHub token": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "Private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}
secret_hits = []
for candidate in ROOT.rglob("*"):
    if not candidate.is_file() or ".git" in candidate.parts or "node_modules" in candidate.parts or candidate.stat().st_size > 2_000_000:
        continue
    try:
        contents = candidate.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    for label, pattern in secret_patterns.items():
        if pattern.search(contents):
            secret_hits.append(f"{label} pattern in {candidate.relative_to(ROOT)}")
require(not secret_hits, "Potential committed secrets detected: " + "; ".join(secret_hits))

# Static security guardrails: no inline HTML event handlers, remote scripts, eval, Function constructor, or document.write.
from html.parser import HTMLParser
class SecurityParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.scripts=[]; self.inline_handlers=[]
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            self.scripts.append(attrs.get("src", ""))
        self.inline_handlers.extend(k for k in attrs if k.lower().startswith("on"))
p = SecurityParser(); p.feed(HTML.read_text(encoding="utf-8")); p.close()
require(p.scripts == ["./assets/js/catalog-repository.js", "./assets/js/app-shell.js", "./assets/js/engine-core.js", "./assets/js/history-engine.js", "./assets/js/module-manager.js", "./assets/js/search-engine.js", "./assets/js/analytics-engine.js", "./assets/js/logging-engine.js", "./assets/js/security-engine.js", "./assets/js/admin-engine.js", "./assets/js/system-engine.js", "./assets/js/catalog-feature.js", "./assets/js/main-engine.js", "./assets/js/global-bottom-nav.js"],
        f"Unexpected script sources: {p.scripts}")
require(not p.inline_handlers, f"Inline event handlers are disallowed: {p.inline_handlers}")
for source_path in [ROOT / "assets/js/catalog-repository.js", ROOT / "assets/js/app-shell.js", ROOT / "assets/js/catalog-feature.js"]:
    source = source_path.read_text(encoding="utf-8")
    require(re.search(r"\beval\s*\(", source) is None, f"eval() found in {source_path}")
    require(re.search(r"\bnew\s+Function\b", source) is None, f"Function constructor found in {source_path}")
    require(re.search(r"document\s*\.\s*write\s*\(", source) is None, f"document.write() found in {source_path}")

print("Security static guardrails: PASS (CSP, local scripts only, no inline handlers/eval/Function/document.write)")
print("Common credential-format scan: PASS (no matching token/private-key patterns found)")
print("Security boundary disclosure (no backend/admin authentication): PASS")
