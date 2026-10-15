# Phase 4A — Prototype Architecture

## Architecture goal

The prototype uses feature-based responsibility boundaries while keeping the runtime lightweight. The goal is not to create the maximum number of files; it is to make change impact predictable.

```text
App Shell
├── Navigation
├── Theme / Preferences
└── Feature Modules
    ├── Home
    ├── Dashboard
    ├── Bot Catalog
    │   ├── Search / Filter
    │   ├── Pagination
    │   └── Export
    ├── Bot Details
    ├── Admin Profile
    └── System

Feature Modules
        ↓
Shared UI
        ↓
Services / Data Contracts
        ↓
Catalog Repository Interface
        ↓
Data Adapter
        ↓
CSV / future approved source
```

## Layer responsibilities

### App Shell
Owns global layout, page container, safe-area spacing, and shared top/bottom navigation surfaces.

### Navigation
Owns logical routes, active state, browser history, and catalog-state restoration. Feature modules request navigation rather than manipulating unrelated page state.

### Theme / Preferences
Owns System/Light/Dark selection and best-effort local preference persistence. No sensitive data is stored here.

### Feature modules
Each feature owns its presentation and feature-specific state. A feature may consume shared UI and service contracts but should not directly depend on another feature's private implementation.

### Data layer
The data layer converts the physical source into normalized catalog records and exposes queryable data. Source syntax should remain hidden from feature modules.

### Shared UI
Contains only genuinely reusable presentation patterns such as buttons, cards, tags, empty/error/loading states, and accessibility tokens.

## Interface direction

The prototype's conceptual interfaces are:

```text
CatalogRepository
  loadCatalog()
  getById(botId)
  list(criteria)
  categories()
  statistics()

Navigation
  goTo(route, state?)
  back()
  getCurrentRoute()

ThemePreferences
  getTheme()
  setTheme(theme)

RuntimeStatus
  check()
  lastResult()
```

These are design contracts, not a claim that the current single-file runtime exposes these exact JavaScript classes/functions publicly.

## Why physical splitting is deferred

The current deployment is static and intentionally dependency-free. Introducing a bundler/framework solely to satisfy a visual module tree would add build complexity, deployment coupling, and maintenance cost before those costs are justified.

Phase 5 can extract the boundaries into physical ES modules if one or more of the following becomes true:

- feature code becomes difficult to test independently;
- repeated changes create cross-page regressions;
- shared components have enough reuse to justify a stable package boundary;
- a second data adapter is required;
- automated unit/component tests need importable modules.

## Future source layout

When physical extraction is approved, the intended direction is:

```text
app/
  shell/
  core/
    navigation/
    theme/
    preferences/
  modules/
    home/
    dashboard/
    bot-catalog/
    bot-details/
    admin-profile/
    system/
  shared/
    ui/
    states/
  data/
    models/
    repositories/
    adapters/
  tests/
```

The exact framework and filenames remain open until Phase 5 implementation planning verifies the repository constraints.
