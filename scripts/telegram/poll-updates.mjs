import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCsv } from './csv.mjs';
import { handleCatalogQuery } from './bot-modules/catalog-query.mjs';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token || !/^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(token)) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing or malformed.');
}

const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const stateDir = join(workspace, '.telegram-state');
const statePath = join(stateDir, 'offset.json');
const datasetPath = join(workspace, 'data', 'Telegram_Bot_Master_Catalog_1000.csv');

async function telegram(method, body) {
  let response;
  try {
    response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
  } catch (_) {
    throw new Error('Telegram API network request failed; secret values were not logged.');
  }
  let payload;
  try { payload = await response.json(); } catch (_) { payload = null; }
  if (!response.ok || !payload || payload.ok !== true) {
    const description = payload && typeof payload.description === 'string'
      ? payload.description.slice(0, 180)
      : 'Telegram API returned an unreadable response';
    throw new Error('Telegram API ' + method + ' failed: ' + description);
  }
  return payload.result;
}

await mkdir(stateDir, { recursive: true });
const csv = await readFile(datasetPath, 'utf8');
const records = parseCsv(csv);
let offset = null;
try {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  if (Number.isSafeInteger(state.offset) && state.offset >= 0) offset = state.offset;
} catch (_) {}

const request = { timeout: 0, allowed_updates: ['message'], limit: 100 };
if (offset !== null) request.offset = offset;
const updates = await telegram('getUpdates', request);

if (offset === null) {
  const newest = updates.reduce((max, update) =>
    Number.isSafeInteger(update.update_id) ? Math.max(max, update.update_id) : max, -1);
  const nextOffset = newest >= 0 ? newest + 1 : 0;
  await writeFile(statePath, JSON.stringify({ offset: nextOffset, updatedAt: new Date().toISOString() }) + '\n', { mode: 0o600 });
  process.stdout.write(JSON.stringify({
    ok: true,
    mode: 'bootstrap',
    pendingUpdatesDrained: updates.length,
    responsesSent: 0,
    note: 'Initial run advances past pre-existing updates to avoid unexpected backlog replies.'
  }) + '\n');
} else {
  let nextOffset = offset;
  let responsesSent = 0;
  for (const update of updates) {
    if (!Number.isSafeInteger(update.update_id)) continue;
    const response = await handleCatalogQuery(update, records);
    if (response) {
      await telegram('sendMessage', response);
      responsesSent += 1;
    }
    nextOffset = Math.max(nextOffset, update.update_id + 1);
  }
  await writeFile(statePath, JSON.stringify({ offset: nextOffset, updatedAt: new Date().toISOString() }) + '\n', { mode: 0o600 });
  process.stdout.write(JSON.stringify({
    ok: true,
    mode: 'poll',
    updatesReceived: updates.length,
    responsesSent,
    offsetAdvanced: nextOffset > offset,
    rawUpdatesLogged: false
  }) + '\n');
}
