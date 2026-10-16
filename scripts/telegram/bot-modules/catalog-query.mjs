const COMMAND = /^\/([a-z][a-z0-9_]{0,31})(?:@[a-zA-Z0-9_]{5,32})?(?:\s+([\s\S]*))?$/;

export async function handleCatalogQuery(update, records) {
  const message = update && update.message;
  if (!message || !Number.isSafeInteger(message.chat && message.chat.id) || typeof message.text !== 'string') {
    return null;
  }

  const match = message.text.trim().match(COMMAND);
  if (!match) return null;
  const command = match[1].toLowerCase();
  const argument = (match[2] || '').trim();
  const chat_id = message.chat.id;

  if (command === 'start' || command === 'help') {
    return {
      chat_id,
      text: 'Telegram Bot Master Catalog\nCommands: /search <keyword>, /help\nThis bot searches bot concepts, not a verified directory of live bots.'
    };
  }
  if (command !== 'search') return null;
  if (!argument) return { chat_id, text: 'Usage: /search <keyword>' };

  const needle = argument.toLocaleLowerCase();
  const matches = records.filter(record => Object.values(record).some(value =>
    String(value ?? '').toLocaleLowerCase().includes(needle)
  )).slice(0, 5);

  const lines = matches.map(record => {
    const id = String(record['Bot ID'] || 'ID unavailable').slice(0, 40);
    const name = String(record['Bot Name'] || 'Unnamed concept').slice(0, 100);
    const category = String(record['English Category'] || 'Uncategorized').slice(0, 70);
    return '• ' + name + ' [' + id + '] — ' + category;
  });

  return {
    chat_id,
    text: lines.length
      ? 'Catalog matches for "' + argument.slice(0, 80) + '":\n' + lines.join('\n') + '\n\nResults are concepts, not confirmed live bots.'
      : 'No catalog concepts matched "' + argument.slice(0, 80) + '".'
  };
}
