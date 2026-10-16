# Telegram Bot Master Catalog

A mobile-first, data-driven catalog interface for exploring Telegram bot **concepts** and their available metadata.

## Project pages

- **Home** — project orientation and quick entry points.
- **Dashboard** — dataset-derived summary and category distribution.
- **BotCatalog** — search, filtering, sorting, and record browsing.
- **Bot Details** — the available information for a selected record.
- **Admin Profile** — public project/maintainer information.
- **System** — dedicated submenu for System configuration, Logs & Audit, Version Logs and Live information.
  - **System configuration** — browser-local theme, density and reduced-motion preferences.
  - **Logs & Audit** — public GitHub Actions workflow runs and repository commits.
  - **Version Logs** — sequential, human-readable release notes; commit and workflow history remains in Logs & Audit.
  - **Live information** — browser runtime signals and public repository activity; global visitor counts are not exposed by static GitHub Pages.

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

The canonical CSV now contains **1,000 complete concept records across 100 categories**. The malformed former final row `B065-06` was completed, four additional concepts finish category 65, and categories 66–100 each contain ten category-specific concepts. The CSV is the single source of truth; runtime-generated concepts and extension-file merging are no longer used.

The loader validates before displaying data:

- exactly **1,000 records and unique Bot IDs**;
- exactly **1,000 unique Bot Names**;
- exactly **100 categories with ten records each**;
- all required CSV fields are non-empty.

If a validation fails, catalog loading reports an error instead of silently displaying incomplete or duplicated data.

## Important data boundary

This project is a **Telegram bot master-concept catalog**, not a claim that every named record is an existing public Telegram bot. The new research records are buildable concept labels grounded in real Telegram capabilities and ecosystem use cases. They do not invent public usernames, Telegram URLs, user counts, activity metrics or claims of live availability.

A separate future live-bot directory would require per-bot existence verification, current Telegram source URLs and verification dates. That dataset contract must remain separate from this concept catalog.

## Research basis

The catalog research was checked against Telegram's official Bot Platform documentation and current ecosystem evidence. Telegram documents commands, keyboards, inline mode, Mini Apps, files/media, service integrations, payments and other bot capabilities. Independent directories such as TGSONAR provide evidence of a large live bot ecosystem, while a 2026 ICWSM study reported 32,071 bots in a large-scale research dataset.

## Telegram Bot Engine foundation

- [GitHub-native Telegram Bot architecture v1.0](docs/telegram/GITHUB-NATIVE-TELEGRAM-BOT-ARCHITECTURE-v1.0.md)
- Browser Bot Engine registry: `assets/js/bot-engine.js`.
- First module contract: `assets/js/bot-modules/catalog-query.js` (`/start`, `/help`, `/search <keyword>`).
- Manual Telegram API smoke workflow: [Telegram Bot API smoke test](.github/workflows/telegram-bot-smoke.yml).
- Scheduled Telegram polling workflow: [Telegram Bot Runtime](.github/workflows/telegram-bot-runtime.yml).
- Node.js Bot Module handler and CSV parser: `scripts/telegram/`; contract tests: `tests/telegram-module-contract.mjs`.

The browser only manages module contracts and never calls Telegram with a bot token. The manual smoke workflow requires `TELEGRAM_BOT_TOKEN` as a GitHub Actions secret and `TELEGRAM_CHAT_ID` as an Actions variable. The scheduled poller requires `TELEGRAM_BOT_ENABLED=true` plus the `TELEGRAM_BOT_TOKEN` secret, is best-effort (five-minute cadence), and stores only its update offset in a GitHub Actions artifact; it is not a real-time webhook or production-grade always-on server. See the architecture document for the exact boundary.

## Validation and deployment

- [Catalog validation workflow](.github/workflows/catalog-validation.yml)
- [GitHub Pages deployment workflow](.github/workflows/pages.yml)

The catalog validation workflow checks HTML structure, JavaScript syntax, catalog data integrity, and browser smoke paths. The research loader additionally validates the 1,000/100 invariants at runtime.

A successful CI check is not a substitute for testing on a physical Android device. Public deployment should be reported as live only after a successful deployment run and the resulting site URL have been verified.