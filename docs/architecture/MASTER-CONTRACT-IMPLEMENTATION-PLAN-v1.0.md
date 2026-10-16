# Telegram Bot Master Catalog — Master Contract & Implementation Plan v1.0

**Repository:** `uniquenetworkbd/Telegram-Bot-Master-Catalog`  
**Status:** Implementation control document — proposed baseline, must be reconciled with current branch tests before code migration  
**Purpose:** Single source of truth for Engine, Module Manager, Event Bus, source mapping, regression gates, implementation order, rollback, and release acceptance.  
**Policy:** No additional architecture/contract documents are to be created for this migration. Amend this master document if a decision needs updating.

## 1. Binding decisions

1. This document consolidates the intended rules for Main Engine, Module Manager, Event Bus, and Catalog, Search, History, Analytics, Logging, Security, Storage, Admin, and System Engines.
2. Existing Engine and Module Manager contract documents are historical inputs, not separate implementation authorities. Where wording differs, this master document governs after review/approval.
3. Preserve existing behavior first. Do not replace the current event envelope, registry return shapes, page routes, dataset, or local diagnostics behavior as an incidental part of refactoring.
4. Migration sequence is **Preserve → Isolate → Contract → Migrate → Test → Release**.
5. Do not claim a test or live deployment passed unless the current commit/run/live URL was actually checked.
6. GitHub Pages is a static browser deployment. Browser-side UI controls and local storage are not a trusted server, secure admin authorization, backend database, central visitor analytics, or process-level Engine isolation.
7. Dataset/content changes are out of scope for engine refactoring unless separately requested and validated.
8. The implementation should be incremental and reviewable: small source changes, tests in the same change, no broad rewrite, no unrelated UI redesign.

## 2. Current source facts observed

### 2.1 Event Bus in `assets/js/engine-core.js`

The current source has:
- An in-memory `listeners` Map and `engines` Map.
- `publish(type, payload = {})`, which creates a frozen outer event object shaped as `{ type, at, payload }`, calls exact-type listeners and wildcard `*` listeners, catches listener exceptions individually, and returns the event.
- `subscribe(type, callback)`, which rejects non-functions, adds the callback, and returns an unsubscribe function.
- A registry `register(definition)` with stable-ID syntax validation and duplicate-ID checks.
- Local activity/diagnostics keys and safe storage read/write helpers.
- Existing System UI integration and conceptual engine registration are present in this file; they must be inspected with all consumers before refactoring.

Compatibility note: `Object.freeze` on the outer event does not deep-freeze `payload`. Subscriber mutation and cross-subscriber payload effects must be tested and handled deliberately, without silently changing existing consumers.

### 2.2 Catalog repository in `assets/js/catalog-repository.js`

Observed source characteristics:
- Defines the canonical 13 CSV headers.
- Loads `./data/Telegram_Bot_Master_Catalog_1000.csv`.
- Parses CSV and validates the expected 1,000 records and unique/non-empty Bot IDs.
- Exposes repository functionality consumed by Catalog UI. Preserve its public API until all call sites are mapped and migrated.

Canonical fields:
`index`, `Bot ID`, `Category No`, `Category`, `English Category`, `Bot Name`, `What it does`, `Free/Low-cost Technology`, `API Required?`, `Automation Potential`, `Monetization Potential`, `Suggested MVP`, `Notes`.

### 2.3 Catalog UI in `assets/js/catalog-feature.js`

Observed source characteristics:
- Uses `window.TBMC.catalogRepository` and `window.TBMC.appShell`.
- Owns UI state such as records, filtered results, and current page.
- Uses escaped text for rendered category labels in chart/bar markup; all HTML insertion points must be audited by context during Security Engine work.
- Contains metrics and System UI updates. UI must not become the source of truth for runtime health.

### 2.4 Baseline status and limitations

- Prior project context recorded a dataset of 1,000 records / 100 categories / 10 records per category, with uniqueness checks; re-run the current validator before implementation and record its exact result.
- Prior browser/security smoke results are historical evidence only. Re-run against the current baseline branch/commit before claiming current regression status.
- Existing code is a static browser app. No backend/admin identity service should be implied by the proposed architecture.
- The current Event Bus is synchronous and supports wildcard subscribers; preserve this until a separately reviewed breaking contract is approved.
- Existing registrations may be treated as active immediately. Lifecycle-state migration must not label an Engine healthy/active unless its actual readiness criteria have passed.

## 3. Target architecture and boundaries

```text
Main Engine
├── Module Manager
├── Event Bus
└── Registered Engines
    ├── Storage Engine
    ├── Catalog Engine
    ├── Search Engine
    ├── History Engine
    ├── Analytics Engine
    ├── Logging Engine
    ├── Security Engine
    ├── Admin Engine
    └── System Engine

Presentation Layer (not an Engine)
├── Home
├── Dashboard
├── Bot Catalog
├── Bot Details
├── Admin Profile
├── System UI
└── Navigation, shared controls, styles
```

These are logical modules in one browser runtime, not independently isolated processes. A future backend or service boundary requires a separate deployment/security design and must not be fabricated in the current static build.

### Engine responsibilities and proposed public APIs

| Component | Owns | Proposed public surface |
|---|---|---|
| Main Engine | Bootstrap, runtime readiness, shutdown | `bootstrap(config)`, `getRuntimeInfo()`, `getState()`, `shutdown(options)` |
| Module Manager | Registration, metadata validation, dependencies, lifecycle, health snapshots | `register(definition)`, `unregister(id)`, `validate(id)`, `resolveDependencies(id)`, `start(id)`, `stop(id)`, `restart(id)`, `enable(id)`, `disable(id)`, `getEngine(id)`, `listEngines()`, `getHealth(id)` |
| Event Bus | Event schema, publish/subscribe, dispatch, cleanup | Legacy-compatible `publish(type,payload)`, `subscribe(type,callback)`; add schema/version APIs only additively |
| Storage | Canonical CSV loading/parsing/validation, normalized records | `loadCatalog()`, `getRecordById(id)`, `getAllRecords()`, `getCategories()`, `getDatasetMetadata()`, `validateDataset(data)` |
| Catalog | Record/category access, detail lookup, export semantics | `getCatalogSummary()`, `getBotById(id)`, `getBotsByCategory(id)`, `getCategories()`, `exportCatalog(options)` |
| Search | Query normalization, matching, filtering, sorting, pagination | `search(query,options)`, `filter(records,filters)`, `sort(records,options)`, `paginate(records,options)`, `getSearchState()` |
| History | Local navigation/activity history and retention policy | `recordNavigation(entry)`, `getNavigationHistory(options)`, `recordActivity(activity)`, `getActivityHistory(options)`, `clearLocalHistory(options)` |
| Analytics | Dataset metrics and permitted aggregate usage metrics | `getCatalogMetrics()`, `getUsageMetrics(options)`, `getDashboardSummary(options)`, `processEvent(event)` |
| Logging | Runtime diagnostics, errors, audit categories | `log(level,message,context)`, `logError(error,context)`, `logAudit(action,context)`, `getLogs(query)`, `clearLogs(options)` |
| Security | Input/schema validation, safe rendering policy, URL validation, privacy policy | `validateInput(value,schema)`, `validateConfiguration(config)`, `checkCapability(subject,capability)`, `reportSecurityEvent(event)` |
| Admin | Admin capability decisions and operations | `getAdminCapabilities(subject)`, `authorizeAction(subject,action)`, `validateAdminOperation(operation)`, `recordAdminAction(action,context)` |
| System | Runtime status, configuration, versions, diagnostics, feature availability | `getPlatformStatus()`, `getSystemConfiguration()`, `getVersionInformation()`, `getDiagnostics(options)`, `getFeatureAvailability()` |
| Presentation | Routes, DOM, accessibility, responsive UI and interaction | Consume public APIs; no direct mutation of Engine private state |

These APIs are target contracts, not a claim that each function already exists. Before moving a behavior, record the actual current API and all call sites.

## 4. Shared Engine definition contract

A new-format Engine definition must declare:
- `id`: stable unique ID matching `^[a-z][a-z0-9.-]{1,63}$` unless the current implementation contract is explicitly revised.
- `name`, `description`.
- `version` and `contractVersion` using SemVer.
- `dependencies`: dependency ID, version constraint, and required/optional flag.
- `capabilities`, `provides`, `publishes`, `subscribes`.
- Supported lifecycle hooks and health/readiness policy.
- Failure policy and, where relevant, data/privacy classification.

Rules:
- Duplicate IDs are rejected without mutating the registry.
- Metadata strings are data, never executable code.
- Public snapshots must not expose mutable internal Maps/Sets, callbacks, runtime handles, secrets, or arbitrary mutable objects.
- Required dependencies must exist and be version-compatible before activation.
- Optional dependencies require documented fallback behavior.
- Legacy definitions are supported through a compatibility adapter during migration.
- Never store credentials or tokens in Engine metadata, events, local storage, or logs.

## 5. Module Manager contract

### Lifecycle states

Use the following target states: `registered`, `validated`, `initialized`, `starting`, `active`, `degraded`, `failed`, `stopping`, `stopped`, `disabled`, `blocked`, `destroyed`.

The Manager is the only authority for lifecycle transitions. Invalid transitions return a structured error and do not corrupt state. An active state and a healthy health result are separate facts.

### Dependency graph

- Graph edges are consumer → dependency; startup order is dependency-first.
- Required dependency cycles block the affected startup plan.
- Missing required dependencies and incompatible versions fail validation.
- Missing optional dependencies create a warning and use only an explicitly declared fallback.
- Resolve the full transitive dependency closure before mutating lifecycle state.
- Use deterministic ordering for independent dependencies (stable Engine ID order is the proposed tie-breaker).
- Shared dependencies in a diamond graph start once.
- A partial topological result is not a successful plan.

### Lifecycle rules

- Lifecycle hooks may be asynchronous; handle thrown errors and rejected promises.
- Repeated start/stop/enable/disable calls are idempotent documented no-ops where appropriate.
- Startup order follows the resolved dependency graph; stop/cleanup uses reverse dependency order.
- A failed start cleans up subscriptions/resources acquired during that attempt.
- A provider cannot be stopped, disabled, or unregistered while required dependents remain active unless an explicit controlled cascade is requested. Default behavior: reject.
- Restart is stop → cleanup → revalidate → initialize → start → health check.
- Retries are bounded; validation errors are not retried.
- One Engine's failure must not prevent unrelated Engines from registering or running, within the limitations of the shared JS runtime.
- If the Event Bus or Logging Engine fails, local state must remain consistent and errors must not recursively emit forever.
- Health check exceptions produce a safe unhealthy/unknown report; no callback does not mean healthy.

### Registry UI

System UI displays ID/name, implementation and contract versions, lifecycle state, health, dependencies, enabled status, last safe error code, and timestamps where available. It must distinguish unknown/unavailable, degraded, failed, blocked, and active states. It cannot infer health from a green badge or from registration alone.

## 6. Event Contract — normative v1 rules

### 6.1 Backward-compatible public API

For the first implementation pass, keep these APIs and semantics:
- `publish(type, payload = {})` returns the emitted event.
- `subscribe(type, callback)` throws `TypeError` when callback is not a function and returns an unsubscribe function.
- Exact-type and wildcard (`*`) subscribers both receive events.
- Dispatch is synchronous in registration order within each subscriber list, unless baseline tests demonstrate a different existing behavior.
- One subscriber exception is caught and must not stop unrelated subscribers.
- Unsubscribe prevents subsequent delivery to that callback.
- The current envelope `{ type, at, payload }` remains canonical during compatibility migration.
- Do not change return shapes or convert dispatch to async as an incidental refactor.

### 6.2 Event envelope and payload

The canonical envelope remains:
```js
{ type: "catalog.loaded", at: "ISO timestamp", payload: {} }
```

The v1 schema registry is deliberately stored out-of-band. It does not add fields to emitted events, so the legacy `{ type, at, payload }` shape remains unchanged.

Implemented additive API:
- `registerEventSchema(type, definition)` — registers one in-memory schema for a new or explicitly opted-in event type.
- `validateEvent(type, payload)` — returns `{ valid, schemaRegistered, version?, errors }`; unknown schema types return `valid: true` and `schemaRegistered: false` to preserve legacy event types.
- `getEventSchema(type)` and `listEventSchemas()` — return safe metadata snapshots and never expose validator callbacks.
- Schema definition requires a positive integer `version`, non-empty `publisher`, `privacy` in `public | internal | usage | security | configuration`, a `consumers` array, and a `validate(payload)` function that returns a boolean.

For a registered schema, `publish(type,payload)` validates before dispatch. A false, non-boolean, or throwing validator rejects the event with a `TypeError` and no subscriber is called. Unregistered types keep their current behavior. Duplicate schema registration is rejected; schema definitions are immutable for the runtime lifetime. Public schema metadata is copied and omits the validator function.

Do not rename `type` to `name`, `at` to `timestamp`, or change existing payload semantics. The outer event object remains frozen; payload identity is preserved for backward compatibility. Payload deep-freezing is not part of this implementation.

### 6.3 Event naming and schema rules

- Use lowercase dot-separated names such as `engine.registered`, `engine.state_changed`, `catalog.loaded`, `catalog.search_used`.
- Every event added after baseline capture must define: name, schema/version, publisher, allowed consumers, privacy class, delivery timing, failure policy, and whether it is persisted.
- Event payloads carry data, never executable code.
- Payload validation failures must be reported through a safe fallback that cannot recurse through the same failing event.
- Do not include secrets, passwords, tokens, full unnecessary records, or personally identifying data in analytics events.
- Event schemas are versioned; compatible optional additions may remain within a version, but breaking payload changes require a new event version or explicit major contract migration.
- Avoid duplicate event emission from repeated initialization.
- Logging failure must not create recursive logging/event loops.

### 6.4 Initial event registry

This list is the approved candidate set; only add an event to runtime after its payload schema and publisher are tested.

| Event | Publisher | Intended consumers | Classification |
|---|---|---|---|
| `engine.registered` | Module Manager | System, Logging | internal |
| `engine.validated` | Module Manager | System, Logging | internal |
| `engine.state_changed` | Module Manager | System, Logging | internal |
| `engine.health_changed` | Module Manager | System, Logging | internal |
| `engine.start_failed` | Module Manager | System, Logging | internal |
| `engine.stop_failed` | Module Manager | System, Logging | internal |
| `engine.enabled` / `engine.disabled` | Module Manager | System, Logging | internal |
| `engine.unregistered` | Module Manager | System, Logging | internal |
| `module_manager.dependency_cycle_detected` | Module Manager | System, Logging | internal |
| `catalog.loaded` | Storage | Catalog, Analytics | internal |
| `catalog.search_used` | Search/UI adapter | Analytics | usage metadata |
| `catalog.filter_changed` | Search/UI adapter | Analytics | usage metadata |
| `catalog.details_opened` | Catalog/UI adapter | History, Analytics | usage metadata |
| `storage.load_failed` | Storage | Logging, System | internal |
| `security.validation_failed` | Security | Logging, System | security event |
| `system.configuration_changed` | System | Logging | configuration metadata |
| `navigation.changed` | navigation adapter | History | local activity |

Do not claim that every event in this table is currently emitted. Treat it as the planned registry.

### 6.5 Subscriber cleanup and failure isolation

- A subscription handle is private to its owner and must be invoked during stop/destroy.
- The Event Bus must not retain dead Engine callbacks after teardown.
- Duplicate subscription behavior must be explicit; baseline behavior currently permits adding the same callback more than once.
- Subscriber mutation of a shared payload must not silently alter the event for later subscribers. Capture the current behavior in tests before introducing defensive copies/freezing.
- Subscriber errors are isolated per callback; do not throw a listener error back through `publish`.
- Add optional subscription IDs/listing only if required by diagnostics and privacy policy; do not expose callback functions.
- Wildcard subscriber delivery and ordering are regression-protected.
- No event history persistence is added by default.

## 7. Storage, Catalog, Search, History, Analytics, Logging, Security, Admin, System

### Storage and Catalog
- Storage owns CSV fetch, parse, schema validation, normalized record access, and dataset metadata.
- Catalog owns record/category domain access, details lookup, summary and export semantics.
- Search must not parse the physical CSV itself.
- Catalog and UI must not invent records, counts, or unavailable metadata.
- Migration does not rewrite the canonical dataset.
- Unknown Bot IDs return a documented not-found result; malformed data must not appear as a misleading partial success.

### Search
- Preserve current query, filters, sort, pagination, result counts, URL/hash behavior, and empty/no-result states.
- Query strings are data, never HTML.
- Recompute page bounds when filters change; invalid page/filter inputs have explicit behavior.
- Capture baseline UI behavior before rebinding the UI to Search Engine APIs.

### History and Analytics
- Separate browser-local history, visitor activity, authenticated-user history, and admin audit concepts.
- Local storage does not imply cross-device history or central analytics.
- New persistent tracking requires a stated consent, minimization, retention, and clear-history policy.
- Dataset metrics derive from validated data; missing metrics show unavailable rather than fabricated values.
- Duplicate event handling and aggregation windows must be explicit.
- Local diagnostics are not central visitor analytics.

### Logging
- Levels: `debug`, `info`, `warn`, `error`; audit is a separate category.
- Redact secrets and unnecessary personal data.
- Distinguish browser-local logs from GitHub workflow/commit records.
- Browser logs are not tamper-proof audit trails.
- Logging failure must not crash unrelated functionality or recurse indefinitely.

### Security and Admin
- Never render untrusted text as executable HTML; validate URLs by context and reject unsafe schemes such as `javascript:`.
- Capability checks default to deny for sensitive operations when policy cannot be evaluated.
- Client-side checks are not trusted server authorization.
- A hidden admin route, browser-side role flag, or UI button does not create authentication.
- If no trusted identity/backend exists, protected admin capability must be labelled unavailable/planned/requires backend.
- Security errors shown in UI use safe codes; never expose secrets or arbitrary stack traces.

### System and Presentation
- Module Manager is authoritative for Engine lifecycle; System UI is a consumer.
- Preserve System destinations: System configuration, Logs & Audit, Version Logs, Live Information, including mobile `More → System`.
- Preserve Home, Dashboard, Bot Catalog, Bot Details, Admin Profile, navigation, theme, export, keyboard and mobile interactions.
- Show loading, empty, error, unavailable, and success distinctly.
- UI status must reflect actual capability availability and source/timestamp where possible.

## 8. Source mapping and ownership plan

The repository previously had a 44-tracked-file mapping. This table identifies the primary implementation surfaces relevant to the migration; verify all call sites with repository search before editing. Do not assume this table replaces the full tracked-file inventory.

| Priority | Source/path | Target owner | Migration rule |
|---|---|---|---|
| P0 | `assets/js/engine-core.js` | Main Engine, Module Manager, Event Bus, shared runtime adapter | Freeze API/event/registry baseline; refactor additively |
| P0 | `assets/js/catalog-repository.js` | Storage Engine | Preserve public methods and CSV validation |
| P0 | `assets/js/catalog-feature.js` | Catalog/Search UI adapter, metrics presentation | Move behavior only after API/call-site inventory |
| P0 | `data/Telegram_Bot_Master_Catalog_1000.csv` | Storage data source | No content changes in engine migration |
| P0 | catalog validator script(s), workflow(s) | Validation/release gates | Keep and repair checks; never bypass failures |
| P0 | browser regression/smoke scripts and acceptance checklist | Quality gates | Run baseline before and after each migration slice |
| P1 | app shell, shared UI helpers, navigation and page scripts | Presentation adapters | Preserve selectors, routes, rendering and interaction |
| P1 | Admin Profile and System UI scripts | Admin/System presentation | Reflect actual capabilities; do not imply backend auth |
| P1 | CSS/responsive styles and page markup | Presentation | No visual redesign bundled with engine extraction |
| P2 | documentation, prototype architecture/data strategy | Governance/reference | Master plan supersedes conflicting contract details |
| P2 | CI/deployment workflow configuration | Release process | Do not change deployment semantics without explicit reason |

### Required inventory output before source edits
Record each tracked file's current responsibility, imports/globals, public exports, DOM selectors, events published/subscribed, storage keys, test coverage, target owner, and migration status. Mark unverified items `UNKNOWN`; do not infer framework/library use from naming alone.

## 9. Regression baseline — mandatory before implementation

Run the available current-branch checks and record commit SHA, exact commands/workflow run URLs, timestamps, and pass/fail evidence.

### Data and static validation
- CSV parser handles quoted commas, escaped quotes, UTF-8/BOM, line endings, and empty cells.
- Header schema is exact and required fields are present.
- Current row/category counts and per-category counts are reported from the real file.
- IDs are non-empty and unique; duplicate IDs/names are reported separately.
- Do not equate unique names with independently researched or verified live bots.
- JavaScript syntax check for every changed JS file.
- No unhandled console errors on key routes.

### Event Bus and Engine core baseline
Add tests around current behavior before altering it:
1. Publish returns an event with `type`, `at`, `payload`.
2. Exact-type subscriber receives event.
3. Wildcard subscriber receives event.
4. Exact and wildcard order is documented.
5. Multiple subscribers run in registration order.
6. A throwing subscriber does not prevent other subscribers.
7. Invalid callback throws `TypeError`.
8. Unsubscribe prevents later delivery.
9. Duplicate callback subscription behavior is captured.
10. Repeated publish has distinct timestamps/events as expected.
11. Payload reference/mutation behavior is captured.
12. Duplicate Engine registration is rejected and registry remains unchanged.
13. Invalid ID is rejected.
14. Existing registry snapshot shape and System UI are captured.
15. Existing local diagnostics consent/storage failure behavior remains intact.

### Browser, security and accessibility
- Home, Dashboard, Bot Catalog, Bot Details, Admin Profile, System.
- Search, category filter, API/automation filters if present, sorting, pagination, no-results state.
- CSV/export behavior, theme/preferences, browser history and navigation.
- Desktop and narrow mobile viewport; no horizontal overflow.
- XSS payloads in catalog fields, search input, category/name labels, error messages, and Engine metadata are inert.
- No remote script dependency added, no `eval`, `new Function`, or `document.write`.
- Keyboard navigation, focus behavior, and accessible labels for changed controls.
- Browser storage unavailable/blocked behavior.

### CI and deployment
- Data integrity workflow passes.
- Platform audit/maintenance workflow passes or has a documented, reproducible reason and a fix before release.
- Browser regression passes in supported engines (Chromium/Firefox/WebKit if configured).
- Live smoke check is performed against the actual GitHub Pages URL after deployment.
- A successful commit/merge alone is not proof of live deployment.
- Preserve current Pages deployment configuration; if repository settings prevent a deployment change, report the limitation instead of claiming success.

## 10. Test plan for new contracts

### Module Manager tests
- Valid registration; duplicate ID; invalid metadata/semver; required/optional missing dependency.
- Self-cycle, multi-node cycle, dependency chain, diamond graph, incompatible versions.
- Deterministic dependency order.
- Sync throw and async rejection in each lifecycle hook.
- Partial-init cleanup; bounded timeout/retry behavior.
- Start/stop/restart/enable/disable idempotency.
- Stop/disable/unregister with active dependents; explicit cascade.
- Health callback throws or is missing.
- One Engine fails while unrelated Engines remain available.
- Snapshot mutation cannot mutate internal state.
- Legacy definition adapter preserves old public behavior.

### Event Contract tests
- All baseline behaviors in Section 9.
- Registered schema accepts valid payloads and rejects invalid payloads before dispatch.
- Unknown schemas preserve legacy behavior.
- Schema version, publisher, privacy class and consumer declarations are validated.
- Public schema snapshots omit validator callbacks and cannot mutate the internal schema registry.
- Duplicate schema registration is rejected.
- Exact/wildcard order and synchronous delivery remain unchanged.
- Subscriber cleanup during stop/destroy.
- One subscriber failure does not block the next.
- Logging/Event Bus failure cannot recursively publish indefinitely.
- Sensitive data is not persisted or emitted to analytics.
- Schema metadata does not alter `{ type, at, payload }`.

### End-to-end acceptance
- Every existing user-visible feature remains available and behaves as before unless a documented defect is being corrected.
- System UI status derives from Manager snapshots, not hard-coded assumptions.
- The canonical dataset is byte-for-byte unchanged during runtime refactoring.
- Mobile routes, including System's four destinations, remain accessible.
- All release checks pass and live deployment is verified.

## 11. Implementation sequence — code changes start only after baseline evidence

### Phase 0 — Freeze and observe
1. Record main commit SHA and working baseline.
2. Search all `publish`, `subscribe`, `register`, `listEngines`, local-storage key, global `TBMC`, and Engine UI references.
3. Run existing validation and browser/security checks.
4. Add focused tests for current Event Bus and registry behavior before refactoring.
5. Save exact results in PR description/check output; do not create another architecture document.

**Exit gate:** Baseline is reproducible, current event/registry compatibility is known, and failures are classified.

### Phase 1 — Event Bus compatibility hardening
1. Keep the current public methods and envelope.
2. Add focused tests first.
3. Add schema registry/metadata as additive internal functionality only when tests prove legacy behavior.
4. Ensure subscription cleanup is available to lifecycle owners without exposing callbacks publicly.
5. Keep synchronous dispatch and wildcard support.
6. Do not move all consumers in one commit.

**Exit gate:** Existing event consumers pass and no listener leak or ordering regression is observed.

### Phase 2 — Module Manager adapter
1. Preserve legacy `register` and `listEngines` signatures.
2. Add metadata validation and safe snapshots.
3. Add dependency graph resolution as a pure function.
4. Add lifecycle state transitions behind tests.
5. Introduce compatibility-mode records for existing conceptual registrations.
6. Update System UI to display real state only after the registry API is stable.

**Exit gate:** Legacy UI/tests pass; cycle/dependency/lifecycle tests pass; failure in one Engine does not break unrelated Engines.

### Phase 3 — Main Engine bootstrap
1. Bootstrap Event Bus and Module Manager in a deterministic order.
2. Prevent duplicate bootstrap/subscriptions.
3. Expose readiness only after required infrastructure is ready.
4. Implement orderly shutdown/cleanup.
5. Keep existing page initialization behavior.

**Exit gate:** Repeat initialization, navigation, and reload produce no duplicate handlers and no new console errors.

### Phase 4 — Data and feature Engine extraction
Recommended order: Storage → Catalog → Search → History → Analytics → Logging → Security → Admin → System, adjusting only when the verified dependency graph requires it.
For each Engine:
1. Write/extend tests before moving code.
2. Define the actual public API and call sites.
3. Move one bounded responsibility.
4. Keep a compatibility adapter for current consumers.
5. Run targeted tests and full regression.
6. Remove compatibility only after all consumers migrate and only in a reviewed change.

**Exit gate:** Each slice passes targeted tests and full regression before the next Engine is extracted.

### Phase 5 — Release hardening
1. Run full data, static, browser, security, accessibility, mobile, and deployment checks.
2. Review diff for unintended dataset/UI/deployment changes.
3. Confirm rollback commit and steps.
4. Verify live URL and key interactions.
5. Report commit/PR, changed files, tests with exact outcomes, live verification evidence, and known limitations.

## 12. Error model and observability

Use a consistent structured error shape internally:
```js
{
  code: "DEPENDENCY_CYCLE",
  message: "Safe, non-sensitive summary",
  engineId: "catalog",
  details: { dependencyPath: ["catalog", "storage", "catalog"] }
}
```

Required codes include:
- `INVALID_ENGINE_DEFINITION`
- `DUPLICATE_ENGINE_ID`
- `MISSING_REQUIRED_DEPENDENCY`
- `DEPENDENCY_CYCLE`
- `VERSION_INCOMPATIBLE`
- `LIFECYCLE_INVALID_STATE`
- `ENGINE_START_FAILED`
- `ENGINE_STOP_FAILED`
- `EVENT_SCHEMA_INVALID`
- `EVENT_SUBSCRIBER_FAILED`
- `STORAGE_LOAD_FAILED`
- `CAPABILITY_UNAVAILABLE`

Whether public APIs return structured results or throw typed errors must be consistent per API family. Do not mix styles unpredictably. UI receives safe codes and user-safe messages; diagnostics may hold more detail after redaction.

## 13. Rollback and data preservation

- Each phase is a small, reversible commit/PR.
- Keep the prior working public API until all callers are migrated.
- Do not combine architecture migration with catalog content edits, visual redesign, dependency upgrades, or deployment changes.
- On regression, revert the smallest migration slice and restore the last verified behavior.
- The CSV is read-only input for these changes; compare its hash before/after.
- Preserve existing local-storage keys and consent behavior until an explicit migration is tested.
- Keep a compatibility layer until there is evidence it can be removed safely.
- A release may not proceed with unresolved P0 data, security, route, or runtime regressions.

## 14. Definition of done

The migration is complete only when all conditions are evidenced:
- [ ] Master contracts and current source behavior are reconciled.
- [ ] Existing public Event Bus and Engine registry behavior has compatibility tests.
- [ ] Module Manager has tested dependency resolution, lifecycle, failure isolation, and safe snapshots.
- [ ] Main Engine bootstrap/shutdown is deterministic and idempotent.
- [ ] Each Engine has a documented public API in this master document and tested ownership boundary.
- [ ] All existing pages, search/filter/pagination, details, exports, theme, navigation, and System destinations still work.
- [ ] Canonical dataset is unchanged and validation passes.
- [ ] XSS/security, mobile overflow, browser regression, and accessibility checks pass.
- [ ] CI checks pass or any exception is fixed before release; no checks are silently skipped.
- [ ] GitHub Pages live URL is checked after deployment.
- [ ] Final report states exactly what changed, what passed/failed, commit/PR links, live status, and remaining limitations.

## 15. Current execution checklist

- [x] Existing Engine Contract Specification reviewed as an input.
- [x] Existing Module Manager Contract Specification reviewed as an input; its standalone PR #18 is closed as superseded by this master plan.
- [x] Current Event Bus public behavior inspected in `assets/js/engine-core.js`.
- [x] Catalog repository and Catalog UI entry points inspected.
- [x] Baseline main commit recorded: `c3dcc4591ca9afcc1da83690a06584d81b03d32b`.
- [ ] Repository-wide call-site inventory completed.
- [x] Event Bus compatibility and schema-validation tests added and passing on PR head `f88aedd2a1678cfff4dd3b6c0bf0a6ed7eb8052f`.
- [x] First bounded implementation change completed: backward-compatible Event Schema Registry in `assets/js/engine-core.js`.
- [x] Catalog data/static validation passed in workflow run [38851503758](https://github.com/uniquenetworkbd/Telegram-Bot-Master-Catalog/actions/runs/38851503758).
- [x] Browser regression passed in the same run: Chromium, Firefox and WebKit; 1,000 records / 100 categories; search/filter/details/history/pagination/export/theme/System/XSS checks; mobile 390px and desktop 1440px; zero uncaught page errors and local HTTP errors.
- [x] Platform audit passed in workflow run [38851503827](https://github.com/uniquenetworkbd/Telegram-Bot-Master-Catalog/actions/runs/38851503827) after correcting stale checks for absent, unapproved pages.
- [ ] Full regression and live GitHub Pages deployment verified after merge.

**Current state:** the source, tests, workflow correction and master plan are in PR #19. CI passed on the current code/test commit; live deployment is not yet claimed because the PR has not been merged and the live URL has not been verified.

**Next action:** finish the repository-wide call-site inventory, then implement Module Manager dependency/lifecycle behavior in a separate bounded code change. No additional contract/architecture documents are to be created; update this master plan only when a decision genuinely changes.
