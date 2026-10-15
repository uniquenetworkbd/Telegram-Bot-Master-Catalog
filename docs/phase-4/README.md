# Phase 4 — Interactive Prototype

**Version:** 1.0  
**Status:** Implemented as a design/interaction contract layer  
**Scope:** Modular architecture, interactive flow specification, prototype data boundaries, and acceptance criteria.

## Purpose

Phase 4 converts the approved screen blueprint into an explicit prototype contract without pretending that a production backend, authentication layer, external Telegram APIs, or an administrative system exists.

The current application remains a browser-based static catalog. Phase 4 therefore documents the boundaries and contracts around the existing six-screen experience rather than introducing an unnecessary framework migration.

## Deliverables

1. [Prototype Architecture](prototype-architecture.md) — module boundaries, dependency rules, data/service interfaces, and source-structure direction.
2. [Module Registry](module-registry.md) — stable module IDs, responsibilities, dependencies, inputs/outputs, and isolation rules.
3. [Interactive Flow Specification](interactive-flow-specification.md) — button, menu, search, filter, details, back, theme, loading, empty, error, and recovery contracts.
4. [Prototype Data Strategy](prototype-data-strategy.md) — demo-vs-production separation and adapter rules.
5. [Acceptance Checklist](acceptance-checklist.md) — Phase 4 review criteria and implementation status.

## Architectural decision

The repository currently uses a deliberately lightweight static HTML/CSS/JavaScript runtime. Phase 4 does **not** force a framework rewrite simply to make the folder tree look modular. Modularity is first established as explicit boundaries and contracts. A later implementation phase may physically split the runtime into modules when that change has a measurable maintenance or testing benefit.

## Non-goals

- No admin authentication.
- No database or server-side state.
- No Telegram Bot API integration.
- No claim that the planned 1,000 records are complete.
- No replacement of verified catalog data with prototype/demo records.
- No production-grade user account or permission system.

## Next phase

Phase 5 may implement physical module separation and additional production features only after the technology/runtime trade-offs are reviewed against this Phase 4 contract.
