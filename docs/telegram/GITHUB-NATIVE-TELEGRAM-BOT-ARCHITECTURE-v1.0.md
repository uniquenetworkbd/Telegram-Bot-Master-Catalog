# GitHub-native Telegram Bot Architecture v1.0

**Repository:** `uniquenetworkbd/Telegram-Bot-Master-Catalog`  
**Scope:** GitHub-hosted source, GitHub Actions, Telegram Bot API only  
**Status:** Initial modular foundation; API smoke workflow requires repository configuration and has not been live-verified without credentials.

## Current platform boundary

- GitHub Pages remains the static frontend host.
- The browser Bot Engine is a module registry/contract layer, not a secure place for bot credentials.
- `catalog-query` defines `/start`, `/help`, and `/search <keyword>` behavior against the canonical concept catalog through injected services.
- The manual GitHub Actions workflow can send one fixed diagnostic message through Telegram's official `sendMessage` method.
- A scheduled GitHub Actions poller runs every five minutes when `TELEGRAM_BOT_TOKEN` is configured. It calls `getUpdates`, dispatches `/start`, `/help`, and `/search`, replies through `sendMessage`, and saves only the update offset as a GitHub Actions artifact.
- No Telegram token, chat ID, user message, or private configuration belongs in source code, CSV, HTML, browser storage, or logs.

## Required GitHub configuration

1. Create a Telegram bot using Telegram's official BotFather and keep the token private.
2. In repository **Settings → Secrets and variables → Actions → Secrets**, add `TELEGRAM_BOT_TOKEN`.
3. In **Settings → Secrets and variables → Actions → Variables**, add `TELEGRAM_CHAT_ID` for a chat where the bot is allowed to send messages.
4. Open **Actions → Telegram Bot API smoke test → Run workflow**.
5. Verify that the workflow succeeds and that the fixed diagnostic message arrives in the intended chat.

Do not paste the token into issues, pull requests, chat messages, workflow inputs, or source files. If a token is exposed, revoke it with BotFather and replace the GitHub secret.

## Bot module contract

A module has a stable ID, SemVer version, description, command list, capabilities, and a handler. The handler receives a Telegram update and explicitly injected services, then returns a Telegram `sendMessage` payload or `null`. It does not call Telegram directly and never receives the bot token.

## Polling runtime behavior

- The scheduled workflow is a best-effort, five-minute poller, not a real-time webhook. GitHub may delay scheduled runs; it is not a service-level guarantee.
- The first run without a saved offset advances past already-pending updates to avoid unexpectedly replying to old messages. Subsequent runs process new updates.
- Offset state is kept in a GitHub Actions artifact; this is not a transactional database. A failed run can cause a duplicate reply on a retry, so processing is at-least-once rather than exactly-once.
- The bot accepts public catalog search commands from chats that can reach it. It does not store raw message content or chat history. Do not add private or sensitive user workflows without a separate privacy/security review.
- The poller requires that the bot use long-polling rather than a configured webhook, and only one poller should use the token. GitHub Actions restores the offset only from a successful prior run that actually uploaded the offset artifact.

## What is and is not implemented

Implemented in source:
- Browser-side Bot Engine registry and module metadata API.
- Catalog Query module command contract and bounded five-result response.
- Node.js smoke runner using environment variables and Telegram's `sendMessage` API.
- Manual GitHub Actions workflow for the smoke test.
- Node.js `getUpdates` poller and `catalog-query` module for `/start`, `/help`, and `/search`.
- Scheduled GitHub Actions workflow (five-minute best-effort cadence) with update-offset artifacts and no raw-message persistence.
- Automated CSV parser and Telegram module contract tests.

Not implemented or not yet verified:
- No bot token has been supplied through repository settings by this code change. The poller and smoke workflow remain inactive until the secret is configured.
- Neither the scheduled poller nor the smoke workflow has been verified against a real Telegram chat until repository secrets are configured and a successful run is observed.
- The poller provides periodic incoming-update processing, but not real-time delivery, durable conversation state, central user/session storage, private admin authentication, or a production-grade always-on runtime. Those require a later runtime/backend phase. No external hosting/database platform is added in this phase.

## Security and release rules

- Never make Telegram Bot API requests from browser JavaScript.
- Never print request URLs containing the token, request headers, or secret environment values.
- Do not accept arbitrary message text as workflow input; the diagnostic workflow sends a fixed message only.
- Keep the smoke workflow manual-only and read-only on repository contents.
- Treat catalog rows as bot concepts, not verified live bots.
