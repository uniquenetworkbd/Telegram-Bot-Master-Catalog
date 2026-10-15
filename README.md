# Telegram Bot Master Catalog

A mobile-first, data-driven catalog interface for exploring Telegram bot **concepts** and their available metadata.

## Project pages

- **Home** — project orientation and quick entry points.
- **Dashboard** — dataset-derived summary and category distribution.
- **BotCatalog** — search, filtering, sorting, and record browsing.
- **Bot Details** — the available information for a selected record.
- **Admin Profile** — public project/maintainer information.
- **System** — appearance preferences and runtime/data status.

## Product blueprints

- [Phase 2 — Mobile User Journey Blueprint v1.0](docs/blueprints/PHASE-2-MOBILE-USER-JOURNEY-BLUEPRINT-v1.0.md)
- [Phase 4 — Interactive Prototype](docs/phase-4/README.md)
- [Phase 4C — Repository Audit](docs/phase-4/REPOSITORY-AUDIT-v1.0.md)
- [Phase 4C — Technology Decision](docs/phase-4/TECHNOLOGY-DECISION-v1.0.md)
- [Phase 4D — Prototype Review Results](docs/phase-4/PROTOTYPE-REVIEW-RESULTS-v1.0.md)
- [Phase 5 Implementation Report](docs/phase-5/PHASE-5-IMPLEMENTATION-REPORT-v1.0.md)
- [1,000-Record Research & Verification Report](docs/research/1000-RECORD-RESEARCH-VERIFICATION-v1.0.md)

## Phase 5 implementation

Phase 5 uses the selected incremental modular refactor strategy. The static stack is retained while responsibilities are separated into an app shell, catalog repository adapter, catalog feature module, and shared stylesheet.

- App shell: navigation, history, mobile navigation, More menu, theme and preferences.
- Catalog repository: CSV source loading, parsing and source-field helpers.
- Catalog feature: search, filters, sorting, pagination, details routing, state restoration, export and runtime checks.
- UI: responsive mobile-first styles with Light/Dark/System support.

## Catalog completion

The catalog target is **100 categories × 10 bot concepts = 1,000 unique records**.

The runtime repository now composes:

1. the original audited 646-record dataset,
2. the four missing records completing category 65,
3. ten records for category 66,
4. a research-backed registry for categories 67–100, with ten deterministic concept records per category.

The loader enforces two hard invariants before the application can use the dataset:

- exactly **1,000 unique Bot IDs**;
- exactly **100 distinct categories**.

If either invariant fails, catalog loading fails instead of silently displaying an incomplete dataset.

## Important data boundary

This project is a **Telegram bot master-concept catalog**, not a claim that every named record is an existing public Telegram bot. The new research records are buildable concept labels grounded in real Telegram capabilities and ecosystem use cases. They do not invent public usernames, Telegram URLs, user counts, activity metrics or claims of live availability.

A separate future live-bot directory would require per-bot existence verification, current Telegram source URLs and verification dates. That dataset contract must remain separate from this concept catalog.

## Research basis

The catalog research was checked against Telegram's official Bot Platform documentation and current ecosystem evidence. Telegram documents commands, keyboards, inline mode, Mini Apps, files/media, service integrations, payments and other bot capabilities. Independent directories such as TGSONAR provide evidence of a large live bot ecosystem, while a 2026 ICWSM study reported 32,071 bots in a large-scale research dataset.

## Validation and deployment

- [Catalog validation workflow](.github/workflows/catalog-validation.yml)
- [GitHub Pages deployment workflow](.github/workflows/pages.yml)

The catalog validation workflow checks HTML structure, JavaScript syntax, catalog data integrity, and browser smoke paths. The research loader additionally validates the 1,000/100 invariants at runtime.

A successful CI check is not a substitute for testing on a physical Android device. Public deployment should be reported as live only after a successful deployment run and the resulting site URL have been verified.