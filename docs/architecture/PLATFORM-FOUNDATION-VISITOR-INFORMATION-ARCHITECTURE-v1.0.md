# Platform Foundation & Visitor Information Architecture Blueprint v1.0

- Project: Telegram Bot Master Catalog
- Repository: uniquenetworkbd/Telegram-Bot-Master-Catalog
- Document status: Proposed implementation specification
- Target architecture: Static frontend + modular Main Engine + Independent Engines; optional backend/API for central persistence
- Production status: This document is a blueprint. It does not claim that the proposed engines, registration, visitor tracking, backend, or database already exist.

## 1. Purpose and scope

This document establishes the architecture, data inventory, privacy rules, engine-management requirements, testing gates, and staged release plan for evolving the existing modular static catalog.

The platform currently uses HTML, CSS, JavaScript, and a canonical CSV catalog. Known current modules are:

- App Shell: navigation, page switching, browser history, theme, and client preferences.
- Catalog Repository: CSV loading, parsing, data validation, and catalog helpers.
- Catalog Feature: search, filters, sorting, pagination, record details, export, and runtime checks.
- Automated validation and GitHub Actions: source/data checks and browser regression checks.
- Current boundary: the static frontend does not by itself provide secure account registration, central database writes, central visitor analytics, or server-controlled engine lifecycle operations.

The catalog contains 1,000 bot concepts across 100 categories. These are concepts, not a claim that all records represent verified, currently available public Telegram bots.

## 2. Architecture principles

1. Design before development: agree on responsibilities, contracts, data lifecycle, security, and acceptance tests before adding feature code.
2. One Main Engine coordinates; it must not absorb every feature's business logic.
3. Each Independent Engine owns a defined subsystem and exposes versioned interfaces.
4. Engines communicate through service interfaces, events, and data contracts—not another Engine's private implementation.
5. User activity, analytics, system logs, error logs, security logs, and audit logs are distinct data domains.
6. Collect the minimum information required for a documented purpose. Technical availability alone is not a sufficient reason to collect data.
7. Do not fabricate visitor counts, sessions, health states, or performance metrics. Mark unavailable data as unavailable.
8. A UI control is not a working capability until the underlying runtime/backend operation exists and is tested.
9. Add capabilities incrementally and preserve existing catalog behavior.
10. A change is complete only after source validation, automated regression, security checks, deployment, and post-deployment live verification pass.

## 3. Target platform architecture

    TELEGRAM BOT MASTER CATALOG
    |
    +-- PLATFORM CORE
    |   +-- Main Engine
    |   +-- Engine Registry
    |   +-- Module Manager
    |   +-- Lifecycle Manager
    |   +-- Service Registry
    |   +-- Event Engine
    |   +-- Configuration Manager
    |   +-- Health Manager
    |
    +-- PRODUCT ENGINES
    |   +-- Catalog Engine
    |   +-- Search & Filter Engine
    |   +-- Details Engine
    |   +-- Export Engine
    |
    +-- USER & INFORMATION ENGINES
    |   +-- User / Account Engine (only when account feature is built)
    |   +-- Activity History Engine
    |   +-- Visitor Analytics Engine
    |   +-- Conversation Engine (only if chat/support exists)
    |   +-- Preferences Engine
    |
    +-- OPERATIONS ENGINES
    |   +-- Logging Engine
    |   +-- Error Engine
    |   +-- Security Engine
    |   +-- Audit Engine
    |   +-- Monitoring & Performance Engine
    |
    +-- DATA LAYER
        +-- Storage Engine
        +-- Repository / Data Access Interfaces
        +-- Cache Adapter (optional)
        +-- API Adapter (when backend exists)
        +-- Database Adapter (when backend exists)
        +-- Backup / Recovery / Retention

### 3.1 Main Engine responsibilities

The Main Engine is the platform coordinator. It initializes the platform, reads registered Engine metadata, validates dependencies, starts Engines in dependency order, coordinates lifecycle and health checks, provides shared configuration access, and reports failures. It must not implement the catalog search algorithm, analytics calculations, or database internals itself.

### 3.2 Engine Registry metadata

Each Engine registration should define:

- Stable Engine ID and display name
- Semantic version and contract/API version
- Description and owner/module boundary
- Lifecycle state: discovered, registered, initializing, running, degraded, failed, stopping, stopped, disabled
- Required and optional dependencies with compatible versions
- Services provided and services required
- Events published and subscribed
- Configuration schema and safe defaults
- Required permissions/capabilities
- Health-check method and failure policy
- Data domains accessed and retention requirements
- Test coverage/compatibility status and last verified build

Registry state is runtime metadata, not a substitute for authorization. A browser-only registry can coordinate client modules, but it cannot securely control server processes.

### 3.3 Module versus Engine

A Module is a code/feature boundary. An Engine is a subsystem with meaningful responsibilities, lifecycle, contracts, health/error behavior, and tests. Do not turn every function or tiny file into an Engine. Promote a module to an Engine when independent ownership, lifecycle, state, integration, or operational control provides real value.

### 3.4 Communication flow

    User action
       |
       v
    Feature Engine
       |
       +---- calls a versioned Service Interface when a result is needed
       |
       +---- publishes a validated Event when something happened
                         |
                         v
                     Event Engine
                      /   |    \
                     v    v     v
                  History Analytics Logging
                     \    |     /
                      Storage Interface
                             |
                             v
                   API / Database (if deployed)

Example: when a visitor opens a bot detail page, Details Engine can publish a bot.viewed event containing a catalog record ID, timestamp, and permitted session reference. History may store a user-visible activity record, Analytics may update aggregate counts, and Logging may record an operational event only when useful. Do not create a verbose system log for every page view by default.

### 3.5 Service and event contracts

- Service calls must define input schema, output schema, error types, timeout expectations, and contract version.
- Events must define event name, event ID, timestamp, schema version, producer, and only the fields required by subscribed consumers.
- Consumers should tolerate duplicate delivery where applicable, validate all input, and avoid assuming that every event is delivered exactly once.
- Avoid event loops; document event ownership and prevent a consumer from endlessly republishing the same event.
- Never put passwords, bot tokens, API keys, session secrets, or unnecessary message content into event payloads.

Recommended initial event names include page.viewed, bot.viewed, search.performed, category.opened, filter.changed, catalog.exported, preference.changed, engine.started, engine.stopped, engine.health_changed, system.error, security.event, and admin.action. Add each event only when the related feature is implemented and its purpose is documented.

## 4. Visitor information without registration

Registration is not required to measure many basic site interactions. An anonymous visitor can generate events before creating an account, but the platform must not pretend to know their real-world identity.

### 4.1 Collection architecture

    Visitor Browser
       |
       v
    Minimal Event Collector
    - checks event schema
    - applies consent/privacy choices
    - strips unneeded fields
       |
       +---- local-only mode: browser storage, limited to that browser
       |
       +---- central mode: HTTPS Analytics API
                                |
                                v
                           Server validation
                           Rate limits / abuse controls
                                |
                                v
                           Storage Engine
                                |
                                v
                       Analytics store / database
                                |
                                v
                       Admin analytics dashboard

The current GitHub Pages frontend is static. It can perform client-side calculations and, if implemented, store limited preferences/history in that browser. It cannot by itself securely write to a private central database. Centralized collection requires a backend/API and storage service, plus operational monitoring and access control.

### 4.2 Recommended anonymous visitor data inventory

Collect only the fields that have a defined purpose and are allowed by the applicable law and privacy policy.

| Data group | Candidate fields | Purpose / notes |
|---|---|---|
| Event identity | Random event ID, event schema version | Deduplication and event validation |
| Time | UTC timestamp, coarse session start/end | Usage and performance trends |
| Page activity | Route/page key, event type | Page views and navigation analysis |
| Catalog activity | Bot ID, category ID, search/filter action | Improve catalog discovery |
| Search terms | Optional, minimized query text or query category | Understand search demand; queries may contain personal data, so minimize or avoid raw storage |
| Session | Random first-party session ID, expiry | Group events within a limited session; do not treat as real-world identity |
| Referrer | Referrer origin/domain where available | Understand traffic sources; avoid retaining full URLs with tokens/query secrets |
| Browser/device | Coarse browser family, OS family, mobile/desktop category | Compatibility and responsive design |
| Viewport | Width/height bucket, not necessarily exact dimensions | Responsive UX testing |
| Language/timezone | Browser language and timezone if useful | Localization and display defaults |
| Performance | Page-load timings and supported Web Vitals | Improve loading speed; collect only needed measurements |
| Errors | Error code, component, sanitized message | Debugging without sensitive payloads |
| Consent state | Consent/policy version, choices, time | Honor and demonstrate user choices when required |
| Security/rate limit | Event rejection reason, aggregate abuse signal | Protect the collector; avoid unnecessary long-term identifiers |

A session ID should be random, first-party, limited in lifetime, and not reused as a cross-site tracking ID. Prefer aggregated metrics when individual event history is not needed.

### 4.3 Server request metadata

If a backend is introduced, ordinary HTTP requests may expose technical metadata such as request timestamp, route, response status, user agent, and IP address to the server or hosting provider. Access to that metadata does not mean the project must retain all of it.

- Keep security/operational request logs separate from analytics events.
- Do not persist full IP addresses for analytics by default. If security requires temporary processing, define access, purpose, retention, and minimization.
- Avoid full referrer URLs that may contain search queries, access tokens, or personal data.
- Configure hosting/proxy logs deliberately and check the provider's own logging/retention behavior.
- Never attempt to bypass browser privacy settings or secretly identify anonymous visitors through fingerprinting.

### 4.4 Information not available from an ordinary anonymous page view

Without voluntary input or a valid account/authentication flow, the platform normally cannot reliably know a visitor's real name, phone number, personal email, home address, account identity, or precise physical location. Do not infer these details or claim they were collected. Browser/device signals are approximate and may be absent or deliberately reduced by privacy protections.

## 5. Registration and registered-user data

Registration should be a separate feature with its own threat model and backend. Suggested minimum account fields:

- Internal user ID
- Email or another chosen login identifier only if required
- Password verifier generated by a reputable password-hashing algorithm; never store plaintext passwords
- Account status and creation/update timestamps
- User-selected display name, language, theme, and preferences
- Consent/privacy choices where applicable
- Authentication/security events with limited retention

Optional features such as favorites, saved searches, and cross-device history require a persistent account-linked data model. Do not collect a phone number, legal name, address, date of birth, or other profile field unless a documented feature genuinely requires it.

Authentication and session management must use secure transport, protected cookies or an equivalent secure mechanism, CSRF protections where applicable, rate limiting, account recovery controls, server-side authorization, and secret management. A public static page cannot securely implement administrator privileges merely by hiding a button or storing a role in localStorage.

## 6. Data domains: keep their purpose separate

### 6.1 Catalog data
Bot concept records, categories, tags, metadata, validation results, and source/research verification details.

### 6.2 User activity history
Page viewed, bot viewed, category opened, search performed, filter changed, favorite changed, export requested, and preferences updated. Keep only the event fields needed to provide history or improve the product.

### 6.3 Visitor analytics
Aggregated page views, sessions, top categories, popular catalog records, search usage, device categories, traffic sources, performance metrics, and trends. Dashboard numbers must be derived from actual collected data and clearly indicate time window, methodology, and missing data.

### 6.4 System logs
Engine startup/shutdown, configuration load, scheduled tasks, integration health, and operational milestones.

### 6.5 Error logs
Sanitized error codes, component/Engine ID, severity, timestamp, correlation ID, and safe diagnostic context.

### 6.6 Security logs
Rate-limit triggers, malformed/unsafe input rejection, authentication failures, authorization denials, and security configuration changes. Restrict access and avoid logging credentials or sensitive request bodies.

### 6.7 Audit logs
Who (account/service identity), when, action, target, result, and change reference for privileged operations. For important changes, consider append-only storage and restricted deletion. A client-side visitor must never be able to forge trusted admin audit records.

### 6.8 Performance and health metrics
Engine lifecycle/health, catalog-load duration, search latency, API latency, storage usage, error rate, deployment version, and resource metrics. A static browser cannot report private server resource metrics it cannot access.

### 6.9 Conversation history
Only implement this domain if a support chat, conversation, or AI assistant feature is actually added. If implemented, define conversation ID, owner/session, message ID, sender type, timestamp, content type, retention, access rights, export/deletion rules, and attachment metadata. Do not silently treat ordinary browsing as a conversation.

## 7. Retention, privacy, and legal safeguards

This blueprint is engineering guidance, not a legal opinion. Before enabling production collection, document the purposes and check applicable Bangladesh law, any applicable laws where visitors are located, hosting-provider terms, and requirements for cookies/identifiers, security logs, user rights, and cross-border data handling. Seek qualified legal advice where needed.

Required policy decisions before launch:

1. Publish a clear privacy notice that identifies the controller/operator, data categories, purposes, sharing/hosting arrangements, retention, user choices, and contact method.
2. Determine whether consent is required for each tracking technology or purpose; provide meaningful choices and honor withdrawal where applicable.
3. Do not make non-essential tracking a hidden condition of basic catalog access.
4. Use purpose limitation and data minimization; prefer aggregate analytics over identifiable event trails when sufficient.
5. Set explicit retention periods for anonymous events, raw request logs, security logs, audit logs, and account data. Do not retain forever by default.
6. Provide a workable process for access, correction, export, and deletion where applicable; explain legal/security exceptions.
7. Restrict staff/admin access by role; record privileged actions and review access periodically.
8. Encrypt transport; protect stored data and backups; rotate secrets; patch dependencies; test restore procedures.
9. Keep secrets out of browser bundles, CSV data, events, screenshots, logs, and repository commits.
10. Document incident handling, breach triage, backups, deletion propagation, and vendor responsibilities.
11. Use age-appropriate safeguards if the service is intended for or likely to be used by children.
12. Do not use browser fingerprinting, covert tracking, or collection of unrelated sensitive personal data as a substitute for registration.

## 8. Storage Engine and data access

    Product / Information Engines
               |
               v
       Versioned Storage Interface
       - create / read / query / update / delete
       - validation and authorization
       - retention and deletion semantics
               |
               v
          Storage Engine
          /             \
         v               v
    Browser adapter    API / database adapter
    local-only state   central persistence

- localStorage: small preferences such as theme; not an authority for account permissions.
- IndexedDB: larger browser-local structured state; still tied to a browser/device and can be cleared.
- API + database: central accounts, cross-device history, central analytics, and durable records.
- Cache: performance optimization only, not the authoritative data source.
- Backups: encrypted, access-controlled, tested for restoration, and subject to documented retention/deletion rules.

Choose a database only after documenting query patterns, write volume, transactions, access control, operating cost, backup, and recovery requirements. Do not claim central persistence before a working API/database has been deployed and tested.

## 9. Admin Panel and System Panel: Engine Manager

Every registered Engine's details page should show:

- Engine ID, name, version, description, and contract version
- Actual lifecycle status with timestamp and source of status
- Required/optional dependencies and compatibility
- Registered services and their interface versions
- Events published and subscribed
- Configuration schema, current safe settings, and permissions
- Health checks, recent sanitized errors, and failure reason
- Performance metrics with a defined time window
- Related logs, filtered by Engine ID and correlation ID
- Data domains accessed and retention policy
- Build/test/deployment compatibility status
- Enable/disable/restart controls only if the runtime/backend can actually perform the operation

Conceptual layout:

    SYSTEM
      |
      +-- Engine Manager
      |     +-- Registry
      |     +-- Dependency graph
      |     +-- Lifecycle controls
      |     +-- Health and compatibility
      |     +-- Services and event contracts
      |
      +-- Information Center
      |     +-- Visitor analytics (aggregated)
      |     +-- Activity history (authorized)
      |     +-- System / error logs
      |     +-- Security / audit logs
      |
      +-- Data & Privacy
            +-- Storage health
            +-- Retention configuration
            +-- Consent/policy version
            +-- Export/deletion workflows

All privileged controls require server-side authorization, validation, audit records, and failure handling. In a static-only deployment, the UI may show a clearly labelled read-only capability status but must not imply that it can operate server processes.

## 10. Recommended initial data contracts

Use stable, versioned schemas and validate them at collection time.

### 10.1 Anonymous event (conceptual example)

    {
      "eventId": "random-unique-id",
      "schemaVersion": 1,
      "eventName": "bot.viewed",
      "occurredAt": "UTC timestamp",
      "sessionId": "short-lived-random-session-id-or-null",
      "route": "bot-details",
      "catalogRecordId": "catalog-record-id-or-null",
      "consentState": "applicable-choice-state"
    }

This is a schema illustration, not a real visitor record. Do not include IP address, name, email, raw full URL, credentials, or message content unless a separately justified and reviewed requirement exists.

### 10.2 Engine registry record (conceptual example)

    {
      "engineId": "catalog",
      "name": "Catalog Engine",
      "version": "1.0.0",
      "contractVersion": 1,
      "lifecycleState": "registered",
      "dependsOn": ["storage-interface"],
      "providesServices": ["catalog.read"],
      "publishesEvents": ["catalog.loaded", "bot.viewed"],
      "healthCheck": "configured-check-reference"
    }

Registry values must reflect the actual runtime. Never hard-code "healthy" for an Engine that has not been initialized or tested.

## 11. Testing and live verification gates

Do not report PASS unless the named test actually ran and the evidence is available.

### Gate A — Repository and data
- HTML structure and page/module wiring
- JavaScript syntax and lint/static checks as configured
- CSV integrity: 1,000 records, 100 categories, ten records per category, unique IDs/names, required fields
- No secret/token patterns or accidental personal data in committed files
- No unsafe dynamic HTML execution or newly introduced injection paths

### Gate B — Main Engine and lifecycle
- Registry rejects duplicate Engine IDs and invalid metadata
- Dependency ordering and missing-dependency behavior
- Start/stop/disable/re-enable transitions
- Failed initialization, timeout, retry, and degraded-state behavior
- Unknown Engine and incompatible contract behavior
- Event validation, duplicate events, handler failure, and loop prevention
- Service permission checks and safe error responses

### Gate C — Visitor collection
- Anonymous page view works without registration
- No events are sent before the required privacy choice where consent is required
- Consent withdrawal is honored
- Collection minimizes fields and avoids secrets/full sensitive URLs
- Blocked API, offline mode, malformed events, and rate limits behave safely
- Retention and deletion are tested against real stored records
- Dashboard metrics reconcile to a known test dataset and are labelled accurately
- Browser storage clearing and cross-device limitations are documented

### Gate D — Account and admin security
- Registration/login/logout/recovery, if implemented
- Server-side role and permission enforcement
- Unauthenticated users cannot invoke admin controls
- CSRF/session protections and rate limits as applicable
- No secrets in frontend bundles or logs
- Audit logs capture privileged actions without leaking sensitive values

### Gate E — Browser and responsive regression
- Chromium, Firefox, and WebKit where supported by CI
- Mobile and desktop viewport checks
- Search, category filter, sorting, pagination, details routing, browser Back, CSV export, theme, and error states
- Zero unexpected console errors and local resource failures in the tested path
- No mobile horizontal overflow
- Keyboard accessibility and form error states for new controls

### Gate F — Deployment and live verification
- Required CI checks pass on the exact release commit
- Deploy the exact validated commit
- Confirm the public URL returns success and serves the expected version
- Run post-deployment browser smoke tests against the live URL
- Confirm catalog counts and core interactions
- For analytics, create clearly identified test events and verify the API/database/dashboard path end-to-end
- Confirm no real visitor data is fabricated or accidentally included in test reports
- Record commit SHA, workflow run, timestamp, checks, failures, and known limitations

Existing tests for the static catalog do not prove that the future Main Engine, registration, central analytics API, database, or privacy flows work. Those capabilities need new tests after implementation.

## 12. Staged implementation plan

### Phase 0 — Baseline audit and requirements
Inventory the existing modules, routes, test scripts, workflow triggers, hosting mode, current security controls, and data boundaries. Record a baseline before modifying behavior.

### Phase 1 — Architecture contracts
Create the Engine interface, registry schema, lifecycle state machine, event envelope, service contract rules, error model, configuration schema, permission model, and versioning policy. Keep these contracts independent of a premature database choice.

### Phase 2 — Minimal Main Engine
Implement a small browser-compatible coordinator and registry for client-side Engines. Register current Catalog/Feature modules behind adapters. Preserve the current static catalog experience. Clearly mark client-side status as browser runtime status, not server health.

### Phase 3 — Engine Manager UI
Add read-only registry, dependency, service, event, lifecycle, health, and compatibility views. Add controls only after their operations are implemented and permission-protected.

### Phase 4 — Local information prototype
Add an opt-in, local-only history/analytics prototype for functional testing. Clearly disclose that data remains in the current browser and may be erased. Do not present local-only data as central visitor analytics.

### Phase 5 — Backend and central storage decision
Choose and deploy a suitable backend/API and database only after a threat model, data model, privacy policy, access-control design, backup/restore plan, and operating-cost assessment. Implement server-side event validation and rate limiting before enabling central collection.

### Phase 6 — Anonymous analytics
Implement the minimal event collector, consent/preference enforcement where required, retention/deletion, aggregation, and dashboard. Test with synthetic test traffic labelled as test data before production traffic is enabled.

### Phase 7 — Registration and account-linked history
Add registration only if required. Implement secure authentication, account data minimization, favorites/saved searches, and account history. Keep anonymous and account-linked data separate unless a transparent, justified, user-authorized linking flow is designed.

### Phase 8 — Production readiness
Run all testing gates, deploy the exact validated commit, verify the public site and real backend paths, review privacy notice and retention configuration, and publish an evidence-based release report.

## 13. Release status template

Every release report must state:

- Release commit SHA and branch
- Files/features changed
- CI workflow/run IDs and actual result
- Unit/integration/browser/security test results
- Public URL and live smoke result
- Anonymous analytics end-to-end result, if enabled
- Account/security result, if registration exists
- Privacy/retention configuration reviewed
- Known failures and limitations
- Rollback/recovery plan

Allowed status labels:

- NOT IMPLEMENTED — no working implementation exists.
- PLANNED — requirement is documented but not built.
- IMPLEMENTED — code exists but acceptance tests may not be complete.
- TESTED — the named tests ran with recorded evidence.
- LIVE VERIFIED — deployed behavior was tested on the public endpoint.
- BLOCKED — a dependency, permission, or configuration prevents verification.

Never use "complete" to conceal a failed test, missing backend, unavailable hosting setting, or unverified production behavior.

## 14. Acceptance criteria for this blueprint

This document is accepted as an implementation specification when the team agrees that:

- Main Engine and Independent Engine boundaries are defined.
- Engine Registry, lifecycle, events, services, contracts, errors, and health metadata are specified.
- Anonymous collection is limited to purpose-bound, privacy-reviewed fields.
- Registration is separate from anonymous visitor measurement.
- User history, analytics, system/error/security/audit logs, and conversation history remain distinct.
- Storage and backend requirements are explicit.
- Engine Manager requirements and operational limits are explicit.
- Testing and release gates require evidence from the exact commit and live deployment.
- The current catalog continues to work throughout incremental migration.

## 15. Final decision

The recommended direction is to build the platform foundation and contracts first, then migrate the current catalog modules into registered Engines, then add Engine Manager, then introduce visitor analytics and central persistence only after backend and privacy controls are ready.

The objective is not to collect the maximum possible amount of information. The objective is to collect the minimum information that genuinely helps improve the platform, make its behavior observable, protect it, and provide useful user-facing features—while maintaining transparency, access control, retention limits, and verifiable live testing.
