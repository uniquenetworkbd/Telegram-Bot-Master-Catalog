# Module Manager Contract Specification v1.0

**Project:** Telegram Bot Master Catalog  
**Repository:** `uniquenetworkbd/Telegram-Bot-Master-Catalog`  
**Document type:** Runtime architecture / module lifecycle contract  
**Status:** Proposed — documentation only; implementation requires baseline tests and contract review  
**Version:** 1.0  
**Depends on:** `docs/architecture/ENGINE-CONTRACT-SPECIFICATION-v1.0.md`

## 1. Purpose and scope

This document defines how the future Module Manager validates, registers, resolves, starts, stops, disables, restarts, monitors, and reports Engines in the Telegram Bot Master Catalog browser runtime.

It is a contract for planned behavior, not a claim that the repository already implements all of these capabilities. The current `assets/js/engine-core.js` has an in-memory `engines` Map, a `register(definition)` method, and `listEngines()`. Registration currently assigns `state: "active"` immediately, defaults missing metadata, and uses a supplied health callback or a default “healthy” response. It does not yet provide a full lifecycle state machine, dependency graph resolver, version compatibility checks, enable/disable controls, or failure isolation.

### Required migration sequence

**Preserve → Isolate → Contract → Migrate → Test → Release**

Do not rewrite the current registry in place without tests. Preserve the existing Event Bus and the current public registry behavior while a compatibility adapter is available. Do not change the canonical catalog dataset as part of this task.

## 2. Goals

The Module Manager must:
1. Maintain one authoritative registry of Engine definitions and runtime records.
2. Reject invalid or duplicate Engine definitions before activation.
3. Validate dependency IDs, version ranges, and required/optional dependency policy.
4. Detect dependency cycles and produce a deterministic startup order.
5. Coordinate lifecycle transitions instead of letting unrelated code assign Engine states.
6. Expose truthful state and health information to the System/Engine Manager UI.
7. Contain a failing Engine as far as possible in the shared browser runtime.
8. Preserve compatibility with existing runtime consumers during migration.
9. Make each decision observable through structured diagnostics without leaking sensitive data.
10. Provide deterministic tests for success, invalid input, and failure paths.

## 3. Non-goals and platform limits

- It does not create separate operating-system processes or sandboxed execution.
- It does not create a backend, database, trusted identity provider, or server-side authorization.
- It does not make client-side Admin UI secure by itself.
- It does not load arbitrary third-party code or execute code from Engine metadata.
- It does not silently persist registry or user data across devices.
- It does not replace the Event Bus; Event Bus contract changes are governed by the separate Event Contract Specification.
- It does not imply that all conceptual Engines are already physically separated into files.

GitHub Pages currently serves a static HTML/CSS/JavaScript application. Engine isolation therefore means logical responsibility and error containment, not a security boundary.

## 4. Authority and ownership

The Module Manager is the sole authority for:
- registry membership;
- definition validation results;
- dependency graph and resolved order;
- lifecycle transition coordination;
- enable/disable state;
- Engine readiness and health aggregation;
- dependency-failure propagation;
- registry snapshots supplied to System UI.

The Module Manager must not own Catalog business logic, Search algorithms, CSV parsing, analytics aggregation, UI layout, or application-specific rendering.

The Main Engine bootstraps the runtime and provides the context in which the Module Manager operates. The Event Bus transports declared events but is not the authoritative registry. The System UI displays manager results and must not fabricate or independently mutate Engine state.

## 5. Module Manager public API

The following is the proposed v1.0 contract. Exact function signatures and return types must be reconciled with current consumers before implementation.

| API | Purpose | Contract expectation |
|---|---|---|
| `register(definition)` | Add a definition | Validates before committing registry entry; rejects duplicates |
| `unregister(id)` | Remove a non-running or safely stopped Engine | Rejects removal while required dependents are active unless a controlled cascade is requested |
| `validate(id)` | Validate one definition and its declared dependencies | Returns structured issues; does not activate the Engine |
| `validateAll()` | Validate the registry | Reports all deterministically discoverable issues |
| `resolveDependencies(id)` | Resolve transitive required dependencies | Returns deterministic topological order or structured failure |
| `start(id)` | Start an Engine and required dependencies | Resolves dependencies, then performs lifecycle steps in order |
| `stop(id)` | Stop an Engine | Handles active dependents according to explicit policy |
| `restart(id)` | Restart an Engine | Uses documented stop/cleanup/start sequence |
| `enable(id)` | Permit an Engine to start | Does not claim active until startup succeeds |
| `disable(id)` | Prevent new activation | Stops it safely or returns a conflict if active dependents would break |
| `getEngine(id)` | Get a safe registry snapshot | Does not expose mutable private record references |
| `listEngines()` | List registry snapshots | Stable shape for Engine Manager UI |
| `getHealth(id)` | Get current health report | Reports unknown when no valid health result exists |
| `getStartupPlan(ids?)` | Inspect planned order | Read-only; no lifecycle side effects |
| `getDiagnostics()` | Return safe manager diagnostics | No secrets or arbitrary stack traces in ordinary UI output |

### 5.1 Return and error conventions

A method must use one documented convention consistently: either a documented return value or a structured error. Do not silently return a healthy-looking default after failure.

For operations where callers need explicit status, use a result contract equivalent to:

```js
{ ok: true, value: /* documented value */ }
// or
{
  ok: false,
  error: {
    code: "DEPENDENCY_NOT_FOUND",
    message: "A required dependency is not registered.",
    engineId: "catalog",
    retryable: false
  }
}
```

This is an illustrative contract shape, not implementation code. The chosen convention must be applied consistently and covered by tests.

## 6. Engine definition validation

A definition must be validated before a registry record is committed.

### 6.1 Required metadata

- `id`: stable, unique identifier matching the repository's agreed identifier grammar.
- `name`: non-empty display name.
- `version`: valid Semantic Version.
- `contractVersion`: valid public contract version.
- `description`: clear responsibility statement.
- `dependencies`: array of declared dependencies.
- `capabilities`: array of unique capability strings.
- `provides`: array of public services/contracts.
- `publishes`: array of declared Event Bus event names.
- `subscribes`: array of declared Event Bus event names.
- `lifecycle`: declared lifecycle hooks and supported semantics.
- `healthCheck`: a valid health-check function or explicitly declared supported fallback.
- `failurePolicy`: required/optional behavior and recovery expectations.

The current runtime accepts a smaller shape. These fields must be introduced through a compatibility layer and staged validation, not by suddenly rejecting existing definitions before they are migrated.

### 6.2 Dependency descriptor

Each dependency must declare:
- `id`: target Engine ID;
- `versionRange`: compatible version range or an explicit exact compatibility rule;
- `optional`: boolean;
- `reason`: why the dependency is needed, where useful.

Rules:
1. Unknown required dependency → validation failure.
2. Unknown optional dependency → warning plus documented fallback.
3. Self-dependency → validation failure.
4. Duplicate dependency descriptors → validation failure or deterministic normalization with an explicit rule.
5. Invalid version range → validation failure.
6. Version mismatch → `VERSION_INCOMPATIBLE`.
7. Dependency declaration must not execute code or load a URL.

### 6.3 Registration atomicity

Registration is transactional at the registry level:
1. Validate the input shape.
2. Validate ID uniqueness.
3. Validate metadata and declared fields.
4. Check dependency declarations and current registry constraints.
5. Construct an internal record without mutating the registry.
6. Commit the record only if required validation passes.
7. Publish the agreed registration event only after the record is committed.

If a step fails, no active/ready record may remain behind. If the project permits temporarily registered definitions with unresolved dependencies, their state must be explicitly `registered` or `blocked`, never `active`.

## 7. Registry record and immutability

The internal record may contain:
- immutable definition metadata;
- lifecycle state;
- enablement preference;
- health snapshot;
- resolved dependency IDs;
- registration/start/stop timestamps;
- safe last error code;
- runtime generation or instance identifier;
- cleanup/subscription handles held privately by the manager.

Public snapshots must not expose:
- mutable internal Maps or Sets;
- callbacks or private runtime handles;
- raw secrets or tokens;
- unrestricted internal error objects;
- arbitrary Engine-owned mutable objects.

The public `getEngine` and `listEngines` methods return defensive snapshots. The UI may display the snapshot but cannot directly mutate the registry record.

## 8. Lifecycle state machine

### 8.1 States

| State | Meaning |
|---|---|
| `registered` | Definition is recorded but not yet fully validated |
| `validated` | Metadata and dependency checks passed |
| `initialized` | Initialization completed; not yet accepting normal work |
| `starting` | Start hook is in progress |
| `active` | Required lifecycle steps completed and required dependencies are ready |
| `degraded` | Operating with a declared non-fatal limitation |
| `failed` | A lifecycle or required runtime check failed |
| `stopping` | Stop hook is in progress |
| `stopped` | Stopped cleanly; definition remains registered |
| `disabled` | Manager policy prevents activation |
| `blocked` | A required dependency or policy prevents activation |
| `destroyed` | Runtime resources released; reinitialization requires a defined transition |

### 8.2 Allowed transitions

```text
registered → validated → initialized → starting → active
                                      ↘ failed
active ↔ degraded
active → stopping → stopped
degraded → stopping → stopped
failed → stopped (after cleanup) → initialized → starting
validated → disabled
stopped → disabled
disabled → validated (enable + revalidation)
registered/validated → blocked (dependency/policy issue)
blocked → validated (issue resolved + revalidation)
active/stopped → destroyed (only when the selected removal policy permits it)
```

This is a proposed transition model. Implementation must refine ambiguous transitions and test them. Any transition not explicitly allowed must return `LIFECYCLE_INVALID_STATE` without corrupting the record.

### 8.3 Idempotency

- Repeated `start(id)` on an active Engine returns the existing active snapshot or a documented no-op result.
- Repeated `stop(id)` on a stopped Engine is a documented no-op.
- Repeated `enable(id)` and `disable(id)` do not duplicate work.
- A failed start must clean up subscriptions/resources acquired during that start.
- A second initialization must not duplicate DOM listeners, timers, or Event Bus subscriptions.
- Stop/destroy operations must be safe when partial initialization occurred.

## 9. Dependency graph and startup ordering

### 9.1 Graph rules

- Edges point from consumer to dependency.
- Required dependencies must be available before the consumer starts.
- Optional dependencies may be absent only when the consumer declares a working fallback.
- Circular dependencies are prohibited.
- Startup order must be deterministic for the same registry and requested start set.
- A cycle error must include the involved Engine IDs where possible.
- A partial topological result must not be treated as a successful full startup plan.

### 9.2 Resolution algorithm requirements

A valid resolver must:
1. Collect the transitive dependency closure.
2. Validate all required nodes and compatible versions.
3. Detect cycles.
4. Produce dependency-first order.
5. Preserve a deterministic tie-breaker (for example, stable Engine ID ordering).
6. Report optional missing dependencies separately from fatal issues.
7. Return a plan without mutating lifecycle state.
8. Be tested with zero dependencies, chains, diamonds, missing nodes, cycles, optional nodes, and incompatible versions.

### 9.3 Example

```text
main-engine
  ├── event-bus
  └── module-manager
        ├── storage
        │     └── catalog
        │            └── search
        ├── history
        ├── analytics
        ├── logging
        ├── security
        ├── admin
        └── system
```

This is a conceptual dependency map only. Exact dependency edges must be confirmed per Engine. The graph must not be copied as an implementation truth without validating actual contracts.

## 10. Start orchestration

For `start(id)`:
1. Confirm the definition exists and is enabled.
2. Validate the target and required dependency closure.
3. Resolve a dependency-first plan.
4. For each required dependency in order, validate and initialize if needed.
5. Run each Engine's initialization hook once for the current runtime generation.
6. Run the start hook.
7. Run health/readiness check.
8. Mark the Engine active only if all required conditions pass.
9. Publish state/health changes after committed state transitions.
10. Return a safe snapshot.

If a dependency or lifecycle hook fails:
- stop further startup of dependents;
- run best-effort cleanup for the failing Engine;
- mark the failing Engine `failed`;
- mark dependents `blocked` or `degraded` according to the explicit required/optional policy;
- keep unrelated Engines running;
- report a structured error and safe diagnostic code;
- never report the failed Engine as active/healthy.

The manager must not automatically roll back unrelated Engines that were already active unless the declared transaction/rollback policy requires it.

## 11. Stop, disable, restart, and unregister policies

### Stop
- Stop hooks run in reverse dependency order for a requested dependency group.
- The manager must determine whether active dependents would be broken.
- If stopping a provider would leave active required consumers, either reject the operation or require an explicit, documented cascade.
- A stop timeout/failure must be recorded; cleanup continues best-effort without claiming successful shutdown.

### Disable
- Disable prevents future activation.
- Disabling an active Engine must first resolve the active-dependent impact.
- Default policy: reject disable when required dependents are active unless the caller explicitly requests a controlled cascade.
- A disabled Engine is not deleted from the registry.

### Restart
- Restart means stop → cleanup → revalidate → initialize → start → health check.
- Restart must not duplicate subscriptions or listeners.
- If restart fails, the state must reflect the failure, not the prior active state.

### Unregister
- Default policy: an active Engine cannot be unregistered directly.
- The manager must stop it first and check for required dependents.
- Unregistering a required dependency with active dependents is rejected unless a controlled cascade is explicitly requested.
- The registry record is removed only after cleanup succeeds or a documented forced-removal policy is applied.
- Forced removal must be auditable in diagnostics and must not be a normal UI default.

## 12. Health contract

Each health report contains:
- `engineId`;
- `state`;
- `health`: `healthy`, `degraded`, `unhealthy`, or `unknown`;
- `checkedAt`;
- safe `reasonCode` / `detail`;
- required dependency readiness;
- optional dependency warnings;
- contract/implementation version.

Rules:
- Health callback exceptions become a safe unhealthy/unknown result and must not crash the registry view.
- A missing health callback is not automatically proof of health; any fallback must be explicitly identified as a basic registration check.
- An active state and a healthy state are different facts.
- Dependency health changes trigger a recomputation of dependent readiness.
- Health checks must not perform destructive mutations.
- Do not run unbounded health polling loops; scheduling policy belongs to runtime/System contract.
- System UI must display the source and timestamp where available.

## 13. Failure isolation and error handling

The Module Manager operates in a shared JavaScript runtime; it cannot guarantee hard isolation from a malicious or non-terminating Engine. It can, however, isolate ordinary synchronous exceptions, rejected promises, and contract failures.

Required behaviors:
- Catch exceptions at each lifecycle boundary.
- Detect rejected async lifecycle hooks.
- Ensure one Engine's lifecycle failure does not prevent unrelated Engine registration or startup.
- Do not swallow failures without updating state and diagnostics.
- Avoid recursively publishing errors when the Event Bus or Logging Engine itself fails.
- Bound retries and do not retry non-retryable validation errors.
- Do not run retry loops from the UI render path.
- Use safe error codes in UI; keep detailed diagnostics limited to appropriate developer/admin contexts.
- Do not expose stack traces, secret-bearing configuration, or arbitrary payloads in normal UI.

## 14. Event Bus integration

The Module Manager must preserve current Event Bus compatibility during migration. Current runtime events use the shape `{ type, at, payload }`. Existing `publish(type, payload)` returns the event, `subscribe(type, callback)` returns an unsubscribe function, wildcard subscribers are supported, and individual listener exceptions are caught.

Proposed Module Manager events:
- `engine.registered`
- `engine.validated`
- `engine.state_changed`
- `engine.health_changed`
- `engine.start_failed`
- `engine.stop_failed`
- `engine.enabled`
- `engine.disabled`
- `engine.unregistered`
- `module_manager.dependency_cycle_detected`

Every event requires a schema, privacy classification, publisher, version policy, and subscriber-failure semantics in the separate Event Contract Specification.

Rules:
- Publish only after the corresponding registry/state change is committed.
- Event subscribers cannot mutate private manager records through payload references.
- Event delivery failure must not undo an already committed state transition.
- Do not change the event envelope implicitly.
- If the Event Bus is unavailable, the manager must preserve correct local state and use a safe fallback diagnostic route.

## 15. Compatibility and staged migration

The existing runtime currently:
- exposes `register(definition)`;
- rejects invalid ID syntax and duplicate IDs;
- defaults some metadata fields;
- marks registered records active immediately;
- exposes `listEngines()` with a health callback result;
- publishes `engine.registered`;
- registers several conceptual runtime records;
- renders a registry/status section in System UI.

A safe migration must not suddenly remove these behaviors or silently change the returned object shape.

### Compatibility stages

**Stage 0 — Baseline**
- Capture current registration IDs, list shape, event shape, event order, health output, and System UI behavior.
- Run existing catalog, browser, mobile, security, and deployment tests.

**Stage 1 — Additive validation**
- Introduce a validator that can report missing v1 metadata without breaking legacy definitions.
- Mark legacy records explicitly as compatibility-mode definitions.

**Stage 2 — Dual contract**
- Accept current definitions through a legacy adapter.
- Normalize new definitions into the v1 contract.
- Keep the existing public `register`, `listEngines`, `publish`, and `subscribe` behavior until consumers are migrated.

**Stage 3 — Controlled lifecycle**
- Add lifecycle state tracking and dependency resolution behind tests.
- Register existing records in a documented order.
- Avoid marking records active until their actual startup/readiness requirements pass; update the UI only with accurate status.

**Stage 4 — Consumer migration**
- Move System UI to safe registry snapshots.
- Replace direct registry assumptions with documented APIs.
- Test each consumer and route before removing compatibility code.

**Stage 5 — Deprecation decision**
- Remove legacy compatibility only in a separately reviewed breaking change with an explicit migration note. Do not combine it with an unrelated feature release.

## 16. System / Engine Manager UI contract

The UI is a consumer, not the manager itself.

It should display:
- Engine ID and human-readable name;
- implementation and contract version where available;
- state and health as separate fields;
- required dependencies and their readiness;
- capabilities and declared services;
- safe last error/reason code;
- enabled/disabled status;
- last check/start timestamps where available.

UI rules:
- Never label every registered Engine “healthy” just because a default callback exists.
- Do not infer health from green styling alone.
- Display unknown/unavailable values honestly.
- Disable actions that are invalid in the current state, but still validate every operation in the manager.
- Confirm potentially disruptive cascade stop/disable actions.
- Do not expose stack traces, private runtime handles, secrets, or unredacted payloads.
- On mobile, preserve the existing System navigation and four System destinations.

## 17. Security and privacy requirements

- Engine IDs, names, descriptions, and error text are untrusted display data and must be rendered safely.
- The manager must never execute code supplied as a metadata string.
- Only declared capabilities are exposed through public contracts.
- Browser-side enable/disable controls are runtime controls, not authorization.
- Admin-only operations require a trusted server/identity boundary when they protect real data or privileged operations.
- Registry and diagnostic snapshots must exclude secrets and unnecessary personal information.
- Local diagnostics remain consent-gated and local; the manager must not relabel them as central visitor analytics.
- Do not persist new registry/history data unless a storage and retention policy explicitly permits it.

## 18. Required test matrix

| ID | Scenario | Expected result |
|---|---|---|
| MM-001 | Register valid definition | One registered record |
| MM-002 | Register duplicate ID | `DUPLICATE_ENGINE_ID`; registry unchanged |
| MM-003 | Invalid ID/metadata/version | `INVALID_CONTRACT`; no active record |
| MM-004 | Missing required dependency | Blocked/validation failure |
| MM-005 | Missing optional dependency | Warning plus documented fallback |
| MM-006 | Direct self-dependency | `DEPENDENCY_CYCLE` or specific self-dependency error |
| MM-007 | Multi-node cycle | Startup plan rejected with cycle IDs |
| MM-008 | Dependency chain | Dependency-first startup order |
| MM-009 | Diamond dependency | Shared dependency starts once |
| MM-010 | Incompatible dependency version | `VERSION_INCOMPATIBLE` |
| MM-011 | Lifecycle hook throws | Failed state; safe cleanup attempted |
| MM-012 | Async lifecycle hook rejects | Failed state; rejection handled |
| MM-013 | One Engine fails | Unrelated Engine remains usable |
| MM-014 | Start active Engine twice | No duplicate listeners or subscriptions |
| MM-015 | Stop active Engine | Reverse-order cleanup and stopped state |
| MM-016 | Stop provider with active required dependent | Rejected or explicit cascade |
| MM-017 | Disable active Engine with dependent | Rejected or explicit cascade |
| MM-018 | Restart Engine | Defined stop/start sequence; no duplicate resources |
| MM-019 | Unsubscribe during cleanup | No later event delivery to stopped Engine |
| MM-020 | Health callback throws | Safe health report; UI still renders |
| MM-021 | Missing health callback | Unknown/basic-check label, not falsely healthy |
| MM-022 | Logging/Event Bus failure | No recursive failure; manager state remains consistent |
| MM-023 | Snapshot mutation attempt | Internal registry remains unchanged |
| MM-024 | Unsafe metadata text | Rendered as text; no script execution |
| MM-025 | Legacy definitions | Existing registry/event/UI compatibility preserved |
| MM-026 | Canonical dataset regression | Counts/schema/content unchanged by manager work |
| MM-027 | Mobile System UI | No horizontal overflow; routes still work |
| MM-028 | Full release | Data, browser, security, mobile, deployment tests pass |

## 19. Release gates

### Gate A — Source and baseline verification
- Verify exact `engine-core.js` behavior and all consumers.
- Record baseline commit.
- Run data validation, browser smoke, mobile, XSS/security, and live smoke checks.
- Capture current event and registry compatibility expectations.

### Gate B — Contract approval
- Confirm definition schema and version-range semantics.
- Confirm state machine and invalid-transition behavior.
- Confirm required versus optional dependency semantics.
- Confirm stop/disable/unregister cascade policy.
- Confirm health and error shapes.
- Confirm Event Bus compatibility and event schemas.

### Gate C — Implementation readiness
- Unit tests for validation, graph resolution, lifecycle transitions, and cleanup exist before moving current registrations.
- System UI is prepared to display non-active, blocked, unknown, degraded, and failed states.
- Rollback path is documented.

### Gate D — Release acceptance
- All required tests in Section 18 pass.
- No important current feature regresses.
- Canonical dataset remains unchanged.
- Deployment is verified from the live URL, not inferred from a successful merge.

## 20. Decisions required before coding

These decisions must be explicit in the implementation plan:
1. Whether Module Manager APIs return structured results or throw typed errors; choose one consistent pattern.
2. Whether lifecycle hooks may be asynchronous; recommended: yes, with rejection handling and bounded timeouts.
3. The SemVer range syntax supported for dependencies.
4. Whether stop/disable/unregister defaults reject active dependents or require an explicit cascade; recommended default is reject.
5. The deterministic tie-breaker for independent Engines.
6. Whether definitions can be registered before all dependencies exist; recommended: allow a non-active registered/blocked state, then validate the graph before start.
7. How health checks are triggered and throttled.
8. How legacy definitions are marked and when compatibility mode can be removed.
9. Which manager events are required for v1 and their exact payload schemas.
10. What a startup failure should do to previously started dependencies; recommended: keep successfully started shared dependencies active unless the release explicitly chooses transactional rollback.

## 21. Next step

**Next document:** Event Contract Specification v1.0.

It must specify event naming, payload schemas, versioning, synchronous/asynchronous dispatch, wildcard compatibility, subscription cleanup, privacy classification, publisher/consumer declarations, listener failure isolation, and backward compatibility with the existing `{ type, at, payload }` envelope.

No Engine implementation should begin until the Module Manager contract decisions above and Event Contract Specification are reviewed against the actual repository baseline.
