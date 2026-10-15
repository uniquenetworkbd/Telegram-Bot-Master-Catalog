# Phase 4 Module Registry

The registry is the authoritative design map for feature ownership in the prototype. A module may use another module through its documented responsibility, but it must not reach into another module's private implementation details.

| ID | Module | Responsibility | Depends on | Public contract |
|---|---|---|---|---|
| CORE-01 | App Shell | Shared page container, global layout, safe-area/content spacing | UI-01 | `renderShell()`, layout tokens |
| CORE-02 | Navigation | Routes, active destination, browser history, back/state restoration | CORE-01, DATA-01 | `goTo(route)`, route state |
| CORE-03 | Theme | System/Light/Dark selection and application | CORE-04 | `getTheme()`, `setTheme()` |
| CORE-04 | Preferences | Persist non-sensitive UI preferences | Browser storage | `getPreference()`, `setPreference()` |
| DATA-01 | Catalog Data | Parse and expose catalog records | DATA-03 | `loadCatalog()`, record model |
| DATA-02 | Search & Filter | Query, category, API, automation filtering and pagination inputs | DATA-01 | `filterCatalog(criteria)` |
| DATA-03 | Data Adapter | Hide the physical CSV/source format from features | Static CSV | `fetchSource()`, `parseSource()` |
| UI-01 | Shared UI | Buttons, cards, tags, state/feedback patterns, accessibility tokens | CORE-03 | Reusable presentation primitives |
| FEAT-01 | Home | Welcome, quick actions, dataset-derived summary | DATA-01, UI-01 | Home view model |
| FEAT-02 | Dashboard | Dataset-derived statistics and distributions | DATA-01, UI-01 | Dashboard view model |
| FEAT-03 | Bot Catalog | Search/filter controls, table/cards, pagination, export entry | DATA-01, DATA-02, UI-01 | Catalog interaction contract |
| FEAT-04 | Bot Details | Selected record presentation and return path | DATA-01, CORE-02, UI-01 | `openBot(id)` |
| FEAT-05 | Admin Profile | Public project/maintainer metadata | Configuration, UI-01 | Read-only profile model |
| FEAT-06 | System | Theme controls, runtime checks, implementation boundaries | CORE-03, CORE-04, DATA-01, UI-01 | System status model |

## Dependency rules

1. **Feature → Shared UI** is allowed.
2. **Feature → Service/Data contract** is allowed; a feature should not parse raw source text itself.
3. **Service → Data Adapter** is allowed.
4. **Feature → Navigation contract** is allowed; a feature must not directly rewrite unrelated route state.
5. **Feature → Theme/Preferences contract** is allowed.
6. **Circular dependencies are forbidden.**
7. **Shared code must stay generic.** Page-specific business rules belong to the owning feature.
8. **Data source details are isolated.** A future JSON/GitHub/API adapter should replace DATA-03 without requiring every feature to change.
9. **No secrets belong in any module.** Authentication and private credentials are outside this static prototype.

## Change-impact rule

Every proposed feature should identify:

- owning module;
- new or reused contract;
- direct dependencies;
- state it introduces;
- test surface;
- removal/rollback impact.

A feature is not accepted merely because it is interesting or new. The change must have a clear responsibility boundary and a maintenance reason.

## Current runtime mapping

The existing single-file runtime already exposes most of these responsibilities conceptually: routing/state, theme preferences, catalog loading/parsing, filtering, details rendering, export, and runtime checks. Phase 4 records those boundaries explicitly. Physical file splitting is intentionally deferred until it provides a measurable benefit.
