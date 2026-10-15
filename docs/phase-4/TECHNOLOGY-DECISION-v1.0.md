# Phase 4C — Technology Decision Record v1.0

**Date:** 15 October 2026  
**Decision scope:** Prototype/Phase 5 implementation direction  
**Decision status:** Approved as a Phase 4 recommendation; Phase 5 coding remains a separate gate.

## 1. Decision

Retain the current lightweight static HTML/CSS/JavaScript stack and perform an **incremental modular refactor** rather than migrating to a frontend framework.

This decision is based on the audited repository, not on a preference for a particular framework.

## 2. Options evaluated

Scoring uses the Phase 4C weighting model:

- Repository compatibility — 25%
- Mobile UX / responsive capability — 20%
- Modular architecture — 20%
- Maintenance / extensibility — 15%
- Testing / build capability — 10%
- Deployment simplicity — 10%

### Option A — Improve the existing static implementation

Ratings (1–5): **5, 4, 2, 3, 4, 5**  
Weighted score: **76/100**

Strength: lowest migration risk.  
Weakness: logical responsibilities remain tightly concentrated if no refactor is performed.

### Option B — Modular refactor inside the existing stack

Ratings (1–5): **4, 4, 4, 4, 4, 4**  
Weighted score: **80/100**

Strength: improves responsibility boundaries while preserving the current deployment model and tested behavior.  
Weakness: requires disciplined extraction and regression testing.

### Option C — Framework migration / rebuild

Ratings (1–5): **2, 5, 5, 3, 5, 2**  
Weighted score: **73/100**

Strength: strong long-term module tooling.  
Weakness: unnecessary migration cost and regression risk for the current product scope.

## 3. Selected architecture direction

```text
Current static app
      │
      ├── App Shell boundary
      ├── Navigation boundary
      ├── Theme / Preferences boundary
      ├── Catalog Data boundary
      ├── Search / Filter / Sort boundary
      ├── Feature rendering boundaries
      └── Shared UI boundary

        ↓ protected by validation + browser smoke tests

Future framework migration only if evidence requires it
```

The physical extraction can use plain browser-compatible JavaScript modules when that improves maintainability. A framework remains an option for a later phase only if measurable requirements justify the migration.

## 4. Non-goals

This decision does not authorize:

- Phase 5 production implementation by itself.
- A backend or database migration.
- Authentication or admin operations.
- Telegram Bot API integrations.
- Replacing the existing dataset with fabricated records.

## 5. Phase 5 entry conditions

Before implementation begins, the approved Phase 5 scope should include:

1. Stable module contracts from the Phase 4 documentation.
2. A protected validation workflow on `main`.
3. A clear rollback point.
4. Work-package acceptance criteria.
5. No unresolved Critical Failure from the Phase 4 review.

## 6. Decision conclusion

**Technology Decision: Option B — incremental modular refactor.**

The project should evolve from its current static architecture rather than being rewritten merely to obtain a framework label.
