# GitHub-Native Server-Side Architecture v1.0

## Decision

The Telegram Bot Master Catalog will use **GitHub only** as its platform boundary. No Supabase, Firebase, Cloudflare, third-party database, external authentication provider, or separate hosting platform will be introduced.

## GitHub-native building blocks

- **GitHub Pages** — public static application and dedicated pages.
- **Git repository** — versioned persistent application/data/configuration storage.
- **GitHub Actions** — server-side job execution, validation, scheduled maintenance and controlled repository updates.
- **GITHUB_TOKEN** — short-lived workflow identity for permitted repository operations; never exposed to browser JavaScript.
- **Issues / Pull Requests** — human-facing operational records where appropriate.
- **Workflow artifacts** — temporary build/test evidence; not the permanent analytics database.

## Critical capability boundary

GitHub Pages is not a conventional application backend. Browser JavaScript cannot safely receive a repository write token. Therefore a feature is not marked `LIVE VERIFIED` merely because a GitHub API exists.

### Visitor analytics

True automatic visitor analytics requires a browser-to-server ingestion path. In this GitHub-only architecture, no secret-bearing direct GitHub API call is allowed from the public page. Until a concrete GitHub-native ingestion trigger is implemented and tested, visitor analytics remains `PLANNED`.

### Accounts

GitHub identity can support maintainer/admin operations through GitHub itself, but GitHub Pages does not become a general-purpose application session server. A separate application account database is therefore not claimed as implemented.

### History and audit

Repository commits, pull requests, workflow runs and controlled generated records provide durable GitHub-native maintenance history. These are different from a per-visitor activity database.

### Server-side controls

GitHub Actions can perform controlled jobs on push, pull request, schedule or manual dispatch. They are suitable for validation, maintenance, aggregation and deployment automation, but they are not a continuously running web server.

## Page separation

The platform keeps distinct concerns on distinct pages:

- `pages/engine-manager.html` — runtime engine registry and health.
- `pages/platform-status.html` — GitHub-native platform capability/status boundary.
- Future dedicated pages: Visitor Analytics, Users & Accounts, Activity History, Logs & Audit, Privacy & Data Controls.

## Release states

`PLANNED → IMPLEMENTED → TESTED → LIVE VERIFIED`

No feature may skip the evidence required for its state.
