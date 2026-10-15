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

Phase 4 defines the modular architecture boundaries, module registry, six-page interaction contracts, data-source independence rules, prototype data separation, and acceptance criteria. It is an explicit design/interaction contract; it does not claim that a production backend, authentication system, or Telegram API integration exists.

## Data integrity

The catalog CSV is the application data source. Displayed counts and statuses must be derived from actual records and verified behavior. The CSV filename alone is not proof that all 1,000 planned records are complete or valid.

## Validation and deployment

- [Catalog validation workflow](.github/workflows/catalog-validation.yml)
- [GitHub Pages deployment workflow](.github/workflows/pages.yml)

A successful CI check is not a substitute for testing on a physical Android device. Public deployment should be reported as live only after a successful deployment run and the resulting site URL have been verified.
