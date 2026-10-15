# Telegram Bot Master Catalog

A mobile-first, data-driven catalog interface for exploring Telegram bot concepts and their available metadata.

## Project pages

- **Home** — project orientation and quick entry points.
- **Dashboard** — dataset-derived summary and category distribution.
- **BotCatalog** — search, filtering, sorting, and record browsing.
- **Bot Details** — the available information for a selected record.
- **Admin Profile** — public project/maintainer information.
- **System** — appearance preferences and honest dataset/feature status.

## Product blueprints

- [Phase 2 — Mobile User Journey Blueprint v1.0](docs/blueprints/PHASE-2-MOBILE-USER-JOURNEY-BLUEPRINT-v1.0.md)
- [Phase 4 — Interactive Prototype](docs/phase-4/README.md)
- [Phase 4C — Repository Audit](docs/phase-4/REPOSITORY-AUDIT-v1.0.md)
- [Phase 4C — Technology Decision](docs/phase-4/TECHNOLOGY-DECISION-v1.0.md)
- [Phase 4D — Prototype Review Results](docs/phase-4/PROTOTYPE-REVIEW-RESULTS-v1.0.md)

Phase 4 defines the modular architecture boundaries, module registry, six-page interaction contracts, data-source independence rules, prototype data separation, and acceptance criteria. The Phase 4C audit records the actual repository structure and technology decision. The Phase 4D review records only evidence-backed results and keeps untested Android/device behavior explicitly open.

## Phase 5 implementation

Phase 5 is implemented on the `phase-5-implementation-v1` development branch using the selected incremental modular refactor strategy. The static stack is retained while responsibilities are separated into an app shell, catalog repository adapter, catalog feature module, and shared stylesheet.

- [Phase 5 Implementation Report](docs/phase-5/PHASE-5-IMPLEMENTATION-REPORT-v1.0.md)
- App shell: navigation, history, mobile navigation, More menu, theme and preferences.
- Catalog repository: CSV source loading, parsing and source-field helpers.
- Catalog feature: search, filters, sorting, pagination, details routing, state restoration, export and runtime checks.
- UI: responsive mobile-first styles with Light/Dark/System support.

## Data integrity

The catalog CSV is the application data source. The current audited dataset contains **646 data records across 65 categories**. Category 65 is currently partial, so the planned 1,000-record / 100-category target is **not yet complete**. Displayed counts and statuses must be derived from actual records and verified behavior. The CSV filename alone is not proof that all 1,000 planned records are complete or valid.

No fabricated records should be added merely to reach the target count.

## Validation and deployment

- [Catalog validation workflow](.github/workflows/catalog-validation.yml)
- [GitHub Pages deployment workflow](.github/workflows/pages.yml)

The catalog validation workflow checks HTML structure, external JavaScript syntax, catalog CSV structural integrity, and browser smoke paths covering mobile navigation, search, details/back state, More/System navigation, theme selection and responsive controls. A successful CI check is not a substitute for testing on a physical Android device.

Production deployment remains a separate release decision. Public deployment should be reported as live only after a successful deployment run and the resulting site URL have been verified.
