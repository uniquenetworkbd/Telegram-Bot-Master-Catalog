# Authentication & OTP Bot Engine v1.0

## Current deployment state

This is an implementation branch, not a live authentication service yet. The web UI deliberately fails closed until `assets/js/auth-config.js` contains the deployed API origin. Do not enable authentication links as production-ready until the Worker, D1 database, Telegram webhook, origin/CORS, and browser session behavior have all been tested.

## Modules

- `login.html` — Telegram username + OTP login.
- `register.html` — account registration with verified Telegram identity; role is assigned server-side as `user`.
- `logout.html` — revokes the server-side session and clears the cookie.
- `assets/js/auth-engine.js` — frontend API client, challenge restoration, session check and logout.
- `assets/js/auth-config.js` — non-secret API URL configuration; must remain blank until the backend is deployed.
- `worker/auth-engine/index.js` — Cloudflare Worker API and Telegram webhook.
- `worker/auth-engine/schema.sql` — D1 user, challenge and session tables.

## Login/registration sequence

1. The browser requests a short-lived challenge from `POST /api/auth/start`.
2. The user opens the OTP bot from the generated Telegram deep link and presses Start.
3. Telegram sends the bot update to `POST /api/telegram/webhook`, authenticated by Telegram's `secret_token` header.
4. The Worker checks that the Telegram username and Telegram user ID match the requested account. For registration, it also checks uniqueness.
5. The Worker sends a six-digit OTP to that Telegram chat. OTP lifetime is 10 minutes; five failed attempts lock the challenge.
6. `POST /api/auth/verify` validates the code and creates a user (registration) or authenticates the existing user (login).
7. The Worker sets a Secure, HttpOnly session cookie and stores only a hash of the session token in D1. The 30-day session expiry slides on authenticated `/api/auth/me` requests. Reloading the page does not itself require a new OTP.
8. `POST /api/auth/logout` revokes the session in D1 and clears the cookie.

## Deploy prerequisites

You need a Cloudflare account with Workers and D1 enabled, and a Telegram bot whose token is stored as a Cloudflare Worker secret. GitHub Actions secrets do not automatically become Cloudflare Worker secrets; do not copy any secret into a tracked file.

1. Copy `worker/auth-engine/wrangler.toml.example` to `wrangler.toml` at the repository root (or run Wrangler with the equivalent config). Replace the D1 database ID with the ID created in your own Cloudflare account.
2. Install/configure Wrangler in a trusted local or CI environment and authenticate to Cloudflare.
3. Create the D1 database named `tbmc-auth-engine`; apply `worker/auth-engine/schema.sql`.
4. Configure non-secret Worker variables:
   - `TELEGRAM_OTP_BOT_USERNAME` — exact OTP bot username without `@`.
   - `ALLOWED_ORIGIN` — exact deployed frontend origin, including scheme, e.g. `https://your-site.example`.
5. Add Worker secrets using the Cloudflare secret mechanism:
   - `TELEGRAM_OTP_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET` — high-entropy random value accepted by Telegram as the webhook secret token.
   - `OTP_PEPPER` — independent high-entropy random secret used to hash OTPs.
6. Set the Telegram webhook URL to `https://YOUR_AUTH_API_ORIGIN/api/telegram/webhook` and set Telegram's `secret_token` to the same value as `TELEGRAM_WEBHOOK_SECRET`. Verify webhook status and confirm a real update is accepted.
7. Set `assets/js/auth-config.js` `apiBaseUrl` to the Worker origin. If the UI and Worker are on different sites, third-party-cookie restrictions may block persistent cookies. Prefer hosting the frontend and API on the same site/custom domain; otherwise test real Android browsers and cookie policy before production.
8. Update the frontend CSP `connect-src` to the exact API origin (avoid a broad `https:` rule for production). The current auth page policy allows HTTPS only as an interim configuration template.
9. Run automated checks, then real Telegram registration, login, wrong-code, expiry, refresh, idle return, logout, suspended-user and browser-cookie tests.

## API contract

- `POST /api/auth/start`: `{ "action": "register"|"login", "telegramUsername": "...", "displayName": "..." }`
- `POST /api/auth/verify`: `{ "challengeId": "...", "otp": "123456" }`
- `GET /api/auth/me`: returns the signed-in user's safe public profile or 401.
- `POST /api/auth/logout`: revokes current session.
- `POST /api/telegram/webhook`: Telegram Bot API update endpoint.

## Security boundaries and known production hardening

- Never place bot tokens, OTP pepper, webhook secret, session token or OTP values in source control, browser JavaScript, logs or screenshots.
- All authorization for protected data/actions must be enforced by the backend on every request. Hiding buttons in the frontend is not authorization.
- Admin role is never accepted from registration input. A trusted owner-controlled provisioning process must assign admin privileges.
- Before production, add edge-level/IP rate limiting, monitoring/alerting, account recovery policy, privacy/retention policy, deletion/export policy and an incident response process.
- Configure an appropriate same-site deployment origin to avoid browser third-party cookie blocking.
- The current UI/backend is not live until a Worker deployment and real Telegram OTP tests are confirmed. No fake OTP or localStorage-based authentication is used.
