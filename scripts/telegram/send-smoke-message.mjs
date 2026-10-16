const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !/^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(token)) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing or malformed; configure it as a GitHub Actions secret.');
}
if (!chatId || !/^-?\d{1,20}$/.test(chatId)) {
  throw new Error('TELEGRAM_CHAT_ID is missing or malformed; configure it as a GitHub Actions variable.');
}

const endpoint = 'https://api.telegram.org/bot' + token + '/sendMessage';
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    text: 'Telegram Bot Master Catalog: GitHub Actions Telegram API smoke test passed.'
  }),
  signal: AbortSignal.timeout(15000)
});

let payload;
try { payload = await response.json(); } catch (_) { payload = null; }
if (!response.ok || !payload || payload.ok !== true) {
  const description = payload && typeof payload.description === 'string'
    ? payload.description.slice(0, 240)
    : 'Telegram API request failed without a readable response';
  throw new Error('Telegram API smoke test failed: ' + description);
}

const messageId = payload.result && Number.isSafeInteger(payload.result.message_id)
  ? payload.result.message_id
  : null;
process.stdout.write(JSON.stringify({
  ok: true,
  method: 'sendMessage',
  messageId,
  chatIdConfigured: true,
  tokenLogged: false
}) + '\n');