(() => {
  'use strict';

  const engine = window.TBMC && window.TBMC.botEngine;
  if (!engine) throw new Error('Catalog Query Bot Module requires Bot Engine');

  engine.registerModule({
    id: 'catalog-query',
    name: 'Catalog Query Bot Module',
    version: '1.0.0',
    description: 'Handles /start, /help and /search against the canonical catalog through injected public services.',
    commands: ['start', 'help', 'search'],
    capabilities: ['telegram-command-routing', 'catalog-read', 'bounded-results'],
    implementation: 'assets/js/bot-modules/catalog-query.js',
    handler: async ({ update, services }) => {
      const message = update.message;
      if (!message || !Number.isSafeInteger(message.chat && message.chat.id) ||
          typeof message.text !== 'string') return null;
      const text = message.text.trim();
      const match = text.match(/^\/([a-z][a-z0-9_]{0,31})(?:@([a-zA-Z0-9_]{5,32}))?(?:\s+([\s\S]*))?$/);
      if (!match) return null;
      const command = match[1].toLowerCase();
      const argument = (match[3] || '').trim();
      if (command === 'start' || command === 'help') {
        return { chat_id: message.chat.id, text: 'Telegram Bot Master Catalog\nCommands: /search <keyword>, /help\nThis bot searches bot concepts, not a verified directory of live bots.' };
      }
      if (command !== 'search') return null;
      if (!argument) return { chat_id: message.chat.id, text: 'Usage: /search <keyword>' };
      if (!services.catalogRepository || !services.searchEngine) {
        return { chat_id: message.chat.id, text: 'Catalog search is temporarily unavailable.' };
      }
      const dataset = await services.catalogRepository.load();
      const records = services.searchEngine.filter(dataset.records, { query: argument });
      const lines = records.slice(0, 5).map(record => {
        const id = record['Bot ID'] || record['Bot ID '] || 'ID unavailable';
        const name = record['Bot Name'] || 'Unnamed concept';
        const category = record['English Category'] || record['Category'] || 'Uncategorized';
        return '• ' + String(name).slice(0, 100) + ' [' + String(id).slice(0, 40) + '] — ' + String(category).slice(0, 70);
      });
      return {
        chat_id: message.chat.id,
        text: lines.length
          ? 'Catalog matches for "' + argument.slice(0, 80) + '":\n' + lines.join('\n') + '\n\nResults are concepts, not confirmed live bots.'
          : 'No catalog concepts matched "' + argument.slice(0, 80) + '".'
      };
    }
  });
})();