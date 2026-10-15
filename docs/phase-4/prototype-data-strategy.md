# Phase 4 Prototype Data Strategy

## Principle

Prototype behavior must be testable without confusing demo records with the production catalog. The current runtime continues to load the repository CSV as its actual catalog source; no synthetic demo records are inserted into that production dataset.

## Data layers

### Prototype fixtures

If isolated interaction tests need synthetic records, they must live outside the production CSV and be clearly named as fixtures. Fixture records should include stable IDs and cover:

- a complete record;
- a record with optional/missing fields;
- multiple categories;
- API-required and non-required labels;
- high/medium/low automation labels;
- an empty-result query;
- an unknown Bot ID for Not Found testing.

### Production catalog

The production catalog is the repository's supplied CSV dataset. Its actual record count and category count must be calculated at runtime. The filename `Telegram_Bot_Master_Catalog_1000.csv` is a target-oriented filename, not evidence that 1,000 valid records currently exist.

## Data adapter boundary

Feature modules consume a normalized record shape rather than reading raw CSV syntax. Conceptually:

```text
Data Adapter
    ↓
Catalog Repository Interface
    ↓
Search / Filter / Statistics Services
    ↓
Feature Modules
    ↓
Shared UI
```

The adapter may later read JSON, a GitHub-hosted data file, an approved API, or another source. That source change should not require rewriting the Catalog, Dashboard, Home, or Details presentation logic.

## Normalized record contract

Required identity fields:

- `botId`
- `category`
- `botName`

Optional descriptive fields:

- `whatItDoes`
- `technology`
- `apiRequired`
- `automationPotential`
- `monetizationPotential`
- `suggestedMvp`
- `notes`

Unknown values remain unknown/unspecified. The UI must not manufacture missing descriptions, API providers, prices, or operational claims.

## Validation rules

At minimum, a loaded production dataset should be checked for:

1. non-empty stable Bot IDs;
2. duplicate Bot IDs;
3. usable category data;
4. parseability of required columns;
5. successful search/filter initialization.

A validation concern should produce a Review/Partial state rather than silently changing the data.
