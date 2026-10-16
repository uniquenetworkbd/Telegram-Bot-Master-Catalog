# Engine Contract Specification v1.0

**Project:** Telegram Bot Master Catalog  
**Repository:** `uniquenetworkbd/Telegram-Bot-Master-Catalog`  
**Document type:** Architecture and interface contract  
**Status:** Proposed — implementation must not begin until contracts are reviewed against the current source and regression baseline  
**Version:** 1.0  
**Scope:** Main Engine, Module Manager, Event Bus, and the Catalog, Search, History, Analytics, Logging, Security, Storage, Admin, and System Engines.

## 1. Purpose

This specification establishes responsibility boundaries and stable public contracts for the platform's proposed modular runtime. It is intended to guide a controlled migration, not to claim that every Engine already exists as an independent implementation.

The repository currently remains a static HTML/CSS/JavaScript application. The existing `assets/js/engine-core.js` contains an in-memory event listener map, an Engine registry, registration metadata, and local diagnostics behavior. Those facilities are a starting point. Registration metadata is not, by itself, a complete lifecycle manager, dependency resolver, security sandbox, backend, or independently deployed service.

### Non-negotiable migration rule

**Preserve → Isolate → Contract → Migrate → Test → Release**

Do not remove or regress existing functionality while introducing contracts. Do not change the canonical dataset as a side effect of architectural migration. Existing behavior must be measured before implementation, and changes must pass the repository's data, browser, security, mobile, and deployment checks.

## 2. Architecture boundaries

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
└── Shared navigation, styles, and controls
```

This is a logical modular architecture. On GitHub Pages, these JavaScript components run in the same browser runtime unless the deployment architecture changes. Separate files or Engine IDs do not create process isolation, a server, or a security sandbox.

## 3. Shared Engine Definition Contract

Every Engine definition must declare:

| Field | Requirement | Meaning |
|---|---|---|
| `id` | Required, stable, unique | Machine-readable Engine identity |
| `name` | Required | Display name |
| `version` | Required | Implementation version using SemVer |
| `contractVersion` | Required | Public API contract version |
| `description` | Required | Responsibility summary |
| `dependencies` | Required array | Required/optional dependencies and compatible versions |
| `capabilities` | Required array | Operations the Engine offers |
| `provides` | Required array | Public services/contracts |
| `publishes` | Required array | Events published |
| `subscribes` | Required array | Events consumed |
| `lifecycle` | Required | Supported lifecycle hooks |
| `healthCheck` | Required | Health/readiness behavior |
| `failurePolicy` | Required | Failure and recovery behavior |
| `dataClassification` | Where applicable | Data/privacy classification |

Illustrative definition (contract example only; not executable implementation):

```js
{
  id: "catalog",
  name: "Catalog Engine",
  version: "1.0.0",
  contractVersion: "1.0.0",
  dependencies: [
    { id: "storage", version: "^1.0.0", optional: false }
  ],
  capabilities: ["catalog.read", "catalog.getById", "catalog.getCategories"],
  provides: ["catalogService"],
  publishes: ["catalog.loaded"],
  subscribes: [],
  lifecycle: ["validate", "init", "start", "healthCheck", "stop", "destroy"]
}
```

Rules:
- Duplicate IDs are rejected.
- Required metadata must be validated before an Engine is considered ready.
- Consumers use public contracts, never another Engine's private implementation.
- Required dependencies must exist and satisfy compatibility constraints.
- Optional dependencies must have documented fallback behavior.
- An invalid Engine must not be displayed as active/healthy.
- No secrets belong in Engine metadata, events, browser storage, or logs.

## 4. Lifecycle Contract

### 4.1 States

`registered`, `validated`, `initialized`, `active`, `degraded`, `failed`, `stopping`, `stopped`, `disabled`, `destroyed`.

Only Module Manager may coordinate Engine lifecycle transitions. State transitions must be validated rather than assigned arbitrarily.

### 4.2 Lifecycle hooks

- `validate(context)`: validate metadata, contract, and dependencies.
- `init(context)`: prepare internal state and resources.
- `start(context)`: begin normal operation.
- `healthCheck(context)`: report health/readiness with a reason.
- `stop(context)`: stop accepting work and shut down safely.
- `destroy(context)`: release listeners and runtime resources.

Hooks may have documented no-op defaults where safe. Their supported status and fallback semantics must still be explicit.

### 4.3 Transition and cleanup rules

- Startup order follows a dependency-resolved acyclic graph.
- A repeated start must not create duplicate listeners or subscriptions.
- Stop and destroy must be idempotent where practicable.
- A destroyed Engine must not continue receiving events.
- A required dependency failure makes dependent Engines unavailable or degraded; it must never be reported as healthy.
- An optional Engine failure must not stop unrelated Engines.
- Restart, if supported, follows a defined stop/cleanup/reinitialize/start sequence.
- Infinite retries are prohibited; retries must be bounded and observable.

## 5. Main Engine Contract

**ID:** `main-engine`

Responsibilities:
- Bootstrap and initialize the runtime.
- Establish the Event Bus and Module Manager.
- Coordinate application readiness and orderly shutdown.
- Provide the global runtime error boundary and runtime information.
- Avoid owning catalog, search, analytics, or UI business logic.

Proposed public API:
- `bootstrap(config)`
- `getRuntimeInfo()`
- `getState()`
- `shutdown(options)`

Acceptance:
- Repeated bootstrap does not create duplicate runtime instances.
- Readiness is not reported before required infrastructure is available.
- Unhandled failures are surfaced to the defined diagnostics path.
- Shutdown follows a documented cleanup order.

## 6. Module Manager Contract

**ID:** `module-manager`

Responsibilities:
- Register and validate Engine definitions.
- Detect duplicate IDs, missing dependencies, version conflicts, and dependency cycles.
- Resolve dependency order.
- Coordinate initialize/start/stop/restart/enable/disable.
- Track health and isolate failures as far as the shared runtime permits.
- Supply authoritative registry information to System UI.

Proposed public API:
- `register(definition)`
- `unregister(id)`
- `validate(id)`
- `resolveDependencies(id)`
- `start(id)`
- `stop(id)`
- `restart(id)`
- `enable(id)`
- `disable(id)`
- `getEngine(id)`
- `listEngines()`
- `getHealth(id)`

Required validation:
1. Stable, unique Engine ID.
2. Valid metadata and contract version.
3. Dependencies exist and satisfy declared versions.
4. No cycle in the required dependency graph.
5. Required capabilities and event declarations are valid.
6. Unsupported lifecycle transitions are rejected with structured errors.

Failure policy:
- Failed registration does not create an active record.
- Dependency cycles reject the affected startup graph.
- Optional Engine failures do not stop unrelated Engines.
- Required dependency failure propagates to dependent readiness.
- Failure and recovery reasons are available to diagnostics without leaking sensitive data.

## 7. Event Bus Contract

**ID:** `event-bus`

The existing Event Bus behavior must be inspected and preserved before being extended. Current source exposes `publish(type, payload)` and `subscribe(type, callback)`, returns an event from publish, and returns an unsubscribe function from subscribe. Listener exceptions are caught individually and sent to console diagnostics. Do not silently break these compatibility behaviors.

Proposed API evolution:
- `publish(eventName, payload, metadata)`
- `subscribe(eventName, handler, options)`
- `unsubscribe(subscriptionId)` (if stable subscription IDs are adopted)
- `validateEvent(eventName, payload)`
- `listSubscriptions()` (diagnostic-only, subject to privacy rules)

### 7.1 Event envelope

```js
{
  name: "catalog.loaded",
  version: 1,
  eventId: "runtime-generated-id",
  timestamp: "ISO-8601 timestamp",
  publisher: "storage",
  correlationId: null,
  privacy: "internal",
  payload: {}
}
```

This envelope is proposed. Migration must account for the current `{ type, at, payload }` shape and existing consumers before adopting a new shape. A compatibility adapter or a major contract change may be required; do not change this implicitly.

### 7.2 Initial event catalog

| Event | Publisher | Potential consumers | Classification |
|---|---|---|---|
| `engine.registered` | Module Manager | System, Logging | Internal |
| `engine.state_changed` | Module Manager | System, Logging | Internal |
| `engine.health_changed` | Module Manager | System, Logging | Internal |
| `navigation.changed` | Navigation adapter | History | Local activity |
| `catalog.loaded` | Storage | Catalog, Analytics | Internal |
| `catalog.search_used` | Search | Analytics | Usage metadata |
| `catalog.filter_changed` | Search | Analytics | Usage metadata |
| `catalog.details_opened` | Catalog/UI adapter | History, Analytics | Usage metadata |
| `storage.load_failed` | Storage | Logging, System | Internal |
| `security.validation_failed` | Security | Logging, System | Security event |
| `system.configuration_changed` | System | Logging | Configuration metadata |

Each event requires a schema, publisher, allowed consumers, privacy class, version policy, and failure semantics before use. This is a proposed catalog, not a claim that every event is currently emitted.

### 7.3 Event rules

- Invalid payloads are rejected or reported according to the event schema.
- A failing subscriber must not prevent unrelated subscribers from receiving the event.
- Duplicate subscription behavior must be defined and tested.
- Unsubscribe must prevent subsequent delivery.
- Event dispatch ordering and synchronous/asynchronous behavior must be documented and tested before changes.
- Sensitive personal information, secrets, and full records must not be sent to analytics by default.
- Logging failure must not create recursive event/log loops.
- Events carry data, not arbitrary executable code.

## 8. Storage Engine Contract

**ID:** `storage`

Responsibilities:
- Hide the physical source format from features.
- Load, parse, normalize, and validate the canonical CSV.
- Provide read-only record and category access plus dataset metadata.
- Leave room for future adapters without forcing them into the current static deployment.

Proposed API:
- `loadCatalog()`
- `getRecordById(id)`
- `getAllRecords()`
- `getCategories()`
- `getDatasetMetadata()`
- `validateDataset(data)`

Canonical CSV fields to preserve:
`index`, `Bot ID`, `Category No`, `Category`, `English Category`, `Bot Name`, `What it does`, `Free/Low-cost Technology`, `API Required?`, `Automation Potential`, `Monetization Potential`, `Suggested MVP`, `Notes`.

Rules:
- Search must not parse the CSV itself.
- Catalog must not depend on a hard-coded physical source path.
- Invalid data must not produce a misleading partial-success state.
- Architectural migration must not silently rewrite the canonical dataset.
- Future adapters must satisfy the same normalized record contract.

## 9. Catalog Engine Contract

**ID:** `catalog`

Responsibilities: record model, Bot Details lookup, category access, catalog state, and export semantics.

Proposed API:
- `getCatalogSummary()`
- `getBotById(id)`
- `getBotsByCategory(categoryId)`
- `getCategories()`
- `exportCatalog(options)`

Rules:
- Uses Storage public APIs.
- Does not parse raw CSV or own search matching/filter algorithms.
- Returns a defined not-found result for unknown IDs.
- Export field mapping and supported format must be preserved by regression tests.
- Presentation is responsible for context-appropriate safe rendering.

## 10. Search Engine Contract

**ID:** `search`

Responsibilities: text matching, category/API/automation filters, sorting, pagination criteria, and normalized search state.

Proposed API:
- `search(query, options)`
- `filter(records, filters)`
- `sort(records, sortOptions)`
- `paginate(records, pagination)`
- `normalizeQuery(query)`
- `getSearchState()`

Rules:
- Preserve current search, filter, sort, pagination, and URL/hash behavior.
- Query values are data, never HTML.
- Empty query, no results, invalid filters, and invalid page values have explicit behavior.
- Result counts and pagination stay consistent after every filter change.
- Existing user-visible behavior must be captured in regression tests before rebinding the UI.

## 11. History Engine Contract

**ID:** `history`

Responsibilities: navigation history, session-scoped local activity, and future separate boundaries for visitor/user/admin history.

Proposed API:
- `recordNavigation(entry)`
- `getNavigationHistory(options)`
- `recordActivity(activity)`
- `getActivityHistory(options)`
- `clearLocalHistory(options)`
- `getHistoryPolicy()`

Privacy rules:
- Visitor, authenticated-user, and admin history are separate concepts and must not be conflated.
- Browser-local storage does not imply cross-device history or central analytics.
- Do not add persistent tracking before consent/retention policy is defined.
- Clear-history actions must actually clear the documented scope.
- Storage unavailability must have a safe fallback.
- Do not claim authenticated identity or server-side history in a static-only deployment.

## 12. Analytics Engine Contract

**ID:** `analytics`

Responsibilities: dataset-derived metrics, permitted aggregate usage metrics, and dashboard view models.

Proposed API:
- `getCatalogMetrics()`
- `getUsageMetrics(options)`
- `getDashboardSummary(options)`
- `processEvent(event)`
- `getAnalyticsPolicy()`

Rules:
- Dataset metrics derive from the validated dataset.
- Analytics is distinct from diagnostic logging.
- Local diagnostic events must not be described as central/server analytics.
- Missing data is shown as unavailable, not replaced by fabricated counts.
- Duplicate event handling and aggregation windows must be specified.
- Do not collect unnecessary personal information.

## 13. Logging Engine Contract

**ID:** `logging`

Responsibilities: application/Engine diagnostics, error reports, security events, audit events, and presentation of repository/workflow audit data.

Proposed API:
- `log(level, message, context)`
- `logError(error, context)`
- `logAudit(action, context)`
- `getLogs(query)`
- `clearLogs(options)`

Levels: `debug`, `info`, `warn`, `error`; `audit` is a distinct audit category, not merely a severity level.

Rules:
- Redact secrets, tokens, passwords, and unnecessary personal data.
- Clearly distinguish browser-local logs from GitHub workflow/commit records.
- Browser-local logs are not tamper-proof audit trails.
- Logging failures must not cause recursive logging or crash unrelated functionality.
- Retention and clearing permissions must be explicit.

## 14. Security Engine Contract

**ID:** `security`

Responsibilities: input validation, safe rendering policy, URL checks, capability/permission policy, privacy enforcement, and security event reporting.

Proposed API:
- `validateInput(value, schema)`
- `sanitizeForContext(value, context)`
- `checkCapability(subject, capability)`
- `validateConfiguration(config)`
- `reportSecurityEvent(event)`

Rules:
- Never render untrusted text as executable HTML.
- HTML escaping and URL validation are context-specific.
- Unsafe URL schemes such as `javascript:` are rejected.
- Sensitive actions default to deny when policy cannot be evaluated.
- Client-side checks are not equivalent to trusted server-side authorization.
- A password field or hidden admin route in a static site does not create secure authentication.
- Preserve and run existing XSS/security regression checks.

## 15. Admin Engine Contract

**ID:** `admin`

Responsibilities: admin capability boundary, configuration/moderation operations, authorization decisions, and administrative audit events.

Proposed API:
- `getAdminCapabilities(subject)`
- `authorizeAction(subject, action)`
- `validateAdminOperation(operation)`
- `recordAdminAction(action, context)`

Rules:
- A visible UI control does not imply authorization.
- Authentication and authorization must be backed by a trusted identity provider/server when protected operations require it.
- If no backend/provider exists, the UI must clearly label the capability as unavailable/planned/requires-backend.
- Do not invent authenticated users or claim secure server-side account management.
- Record permitted administrative actions through the audit contract when supported.

## 16. System Engine Contract

**ID:** `system`

Responsibilities: platform/runtime status, Engine health presentation data, configuration, version information, diagnostics, and feature availability.

Proposed API:
- `getPlatformStatus()`
- `getSystemConfiguration()`
- `validateSystemConfiguration(config)`
- `getVersionInformation()`
- `getDiagnostics(options)`
- `getFeatureAvailability()`

Rules:
- Module Manager remains the authority for Engine lifecycle.
- System UI must not invent health states independently of runtime data.
- Missing source information must be shown as unavailable.
- Repository, workflow, and browser-runtime status must be identified separately.
- Preserve the System navigation structure and its four destinations: System configuration, Logs & Audit, Version Logs, and Live Information, including the mobile `More → System` route.

## 17. Presentation Layer Contract

The Presentation Layer is not an Engine. It includes Home, Dashboard, Bot Catalog, Bot Details, Admin Profile, System UI, shared navigation, controls, and CSS.

Rules:
1. Do not parse raw CSV in UI code.
2. Use public Engine APIs and event contracts; do not mutate private Engine state.
3. Render loading, empty, error, unavailable, and success states distinctly.
4. Use safe text/URL rendering.
5. Preserve routes, browser history, theme/preferences, export, responsive layout, and keyboard/mobile interactions.
6. UI status must reflect actual available capabilities; do not imply a backend feature exists when it does not.

## 18. Dependency Contract

| Consumer | Provider | Purpose |
|---|---|---|
| Module Manager | Main Engine runtime | bootstrap/lifecycle coordination |
| Event Bus | Main Engine runtime | event infrastructure |
| Storage | Security validation where applicable | validate source/config inputs |
| Catalog | Storage | normalized records |
| Search | Catalog data contract | search/filter input |
| History | Event Bus and storage abstraction | local navigation/activity |
| Analytics | Catalog and approved events | metrics/aggregates |
| Logging | runtime/Event Bus diagnostics | logs and errors |
| Admin | Security and Logging | authorization boundary and audit |
| System | Module Manager, Logging, configuration service | status and diagnostics |

Dependency cycles are forbidden. Logging should be an optional diagnostic sink where feasible so its failure cannot disable the whole application. Analytics must not read private History storage directly; use approved events or a public service. Admin must not mutate Module Manager's private registry structures.

## 19. Health and Error Contract

A health report must include at least:
- Engine ID
- State
- Health: `healthy`, `degraded`, `unhealthy`, or `unknown`
- Check timestamp
- Safe diagnostic reason/code
- Required dependency status

Proposed structured error shape:

```js
{
  ok: false,
  error: {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "A required dependency is unavailable.",
    engineId: "catalog",
    retryable: true
  }
}
```

Error codes include:
`INVALID_CONTRACT`, `DUPLICATE_ENGINE_ID`, `DEPENDENCY_NOT_FOUND`, `DEPENDENCY_CYCLE`, `VERSION_INCOMPATIBLE`, `LIFECYCLE_INVALID_STATE`, `STORAGE_LOAD_FAILED`, `DATA_VALIDATION_FAILED`, `EVENT_PAYLOAD_INVALID`, `PERMISSION_DENIED`, `UNSUPPORTED_CAPABILITY`, and `UNKNOWN_ENGINE_ERROR`.

Rules:
- Do not expose stack traces or secrets in ordinary user-facing messages.
- Retries are bounded.
- Error-reporting failure must not create recursive failures.
- Health checks must not perform unsafe mutations.
- A missing health source is `unknown`, not automatically `healthy`.

## 20. Version and Compatibility Policy

Use Semantic Versioning: `MAJOR.MINOR.PATCH`.

- MAJOR: backward-incompatible public contract change.
- MINOR: backward-compatible capability addition.
- PATCH: backward-compatible fix.
- Engine implementation version and contract version are distinct.
- Removing or changing a required public API is a breaking change.
- Event payload changes must be checked against all consumers; incompatible event changes require an explicit version strategy.
- Module Manager must reject incompatible required dependencies before activation.
- CI must validate contracts and dependency graph before release.

## 21. Testing and Release Contract

| Test layer | Required checks |
|---|---|
| Unit | each Engine's public API |
| Contract | schema, return shape, version compatibility |
| Lifecycle | valid/invalid transitions and cleanup |
| Dependency | missing dependency, cycle, version conflict |
| Event | payload validation, delivery, unsubscribe, subscriber failure |
| Integration | cross-Engine contracts |
| Browser | current UI flows and navigation |
| Mobile | responsive layout and mobile navigation |
| Security | XSS, unsafe URLs, permission boundaries |
| Data integrity | CSV schema, counts, uniqueness, required fields |
| Deployment | validation workflow and live smoke test |

Release checklist:
- [ ] Home and Dashboard load.
- [ ] Catalog data and category counts match the validated dataset.
- [ ] Search, filters, sorting, and pagination work.
- [ ] Bot Details resolves the correct record.
- [ ] History behavior is preserved.
- [ ] Export and theme/preferences work.
- [ ] All four System submenu destinations work on desktop and mobile.
- [ ] Engine Manager reports actual registry state.
- [ ] Missing analytics/live/backend data is not fabricated.
- [ ] Desktop and mobile have no horizontal overflow.
- [ ] XSS probes do not execute.
- [ ] No unexpected JavaScript or local-resource errors.
- [ ] Dataset validation, browser smoke, and live smoke pass.

Any important regression rejects the migration release.

## 22. Initial Repository Mapping

| Existing path | Contract owner | Priority |
|---|---|---|
| `assets/js/engine-core.js` | Main Engine / Module Manager / Event Bus | P0 |
| `assets/js/catalog-repository.js` | Storage | P0 |
| `assets/js/catalog-feature.js` | Catalog / Search integration | P0 |
| `assets/js/app-shell.js` | Bootstrap integration / Navigation / UI state | P1 |
| `assets/js/global-bottom-nav.js` | Navigation presentation | P1 |
| `assets/js/system-configuration.js` | System configuration | P2 |
| `assets/js/logs-audit.js` | Logging/audit presentation | P2 |
| `assets/js/version-logs.js` | System/version information | P2 |
| `assets/js/live-information.js` | System/live information | P2 |
| `pages/engine-manager.html` | Module Manager/System UI | P0 |
| `pages/activity-history.html` | History UI | P1 |
| `pages/visitor-analytics.html` | Analytics UI | P1 |
| `pages/users-accounts.html` | Admin/Security boundary | P1 |
| `pages/privacy-data-controls.html` | History/Security policy | P1 |
| Canonical CSV | Storage source contract | P0 — protected |
| `scripts/validate_catalog.py` | Data integrity contract | P0 |
| Browser/live smoke tests | Regression and release contract | P0 |

This is an initial ownership map. Exact function-level migration must be confirmed against current source before moving code.

## 23. Migration Gates

### Gate A — Baseline
Record the target commit and run current data, browser, security, mobile, and deployment tests.

### Gate B — Contract lock
Finalize Engine metadata, Module Manager lifecycle, Event Bus schema/dispatch behavior, health/error semantics, and compatibility policy.

### Gate C — Module Manager
Introduce validation and dependency resolution while preserving current registration and Event Bus behavior.

### Gate D — Feature migration
Migrate in dependency order: Storage → Catalog → Search → History → Analytics → Logging → Security → Admin → System.

### Gate E — UI rebinding
Move UI consumers to public APIs without changing user-visible behavior unnecessarily.

### Gate F — Release
Run unit → contract → integration → browser → mobile → security → deployment checks. Roll back or fix if any important feature fails.

## 24. Acceptance Criteria for this Specification

- [ ] All Engine responsibilities and boundaries are defined.
- [ ] Public APIs and expected result/error semantics are reviewed against source.
- [ ] Dependency graph is acyclic.
- [ ] Lifecycle transitions and cleanup rules are defined.
- [ ] Event schemas, versioning, privacy, and failure semantics are defined.
- [ ] Health/error/version policies are defined.
- [ ] History, Analytics, Admin, and Security boundaries are explicit.
- [ ] Existing functionality has regression acceptance criteria.
- [ ] Existing versus planned versus backend-dependent capabilities are distinguished.
- [ ] No implementation starts before current behavior is captured by tests.

## 25. Decision and next step

This document establishes the proposed public boundaries for modularization. It does not itself implement the Engines or assert that backend-dependent capabilities exist.

**Next document:** Module Manager Contract Specification v1.0, covering registration validation, dependency graph resolution, lifecycle orchestration, enable/disable, health, compatibility, and failure isolation. Event Contract Specification v1.0 follows and must align with this document.

Before implementation, verify the proposed APIs and event envelope against the exact current source and tests. In particular, the existing Event Bus currently uses `{ type, at, payload }`; migration must preserve compatibility or explicitly version the breaking change.
