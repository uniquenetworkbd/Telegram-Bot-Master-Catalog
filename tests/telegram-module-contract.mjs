import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../scripts/telegram/csv.mjs';
import { handleCatalogQuery } from '../scripts/telegram/bot-modules/catalog-query.mjs';

test('CSV parser handles quoted commas, escaped quotes and multiline fields', () => {
  const csv = [
    '\uFEFFBot ID,Bot Name,English Category,Notes',
    'B001,"Alpha, Helper",Utilities,"Says ""hello""',
    'and works"'
  ].join('\r\n') + '\r\n';
  const records = parseCsv(csv);
  assert.equal(records.length, 1);
  assert.equal(records[0]['Bot Name'], 'Alpha, Helper');
  assert.equal(records[0].Notes, 'Says "hello"\nand works');
});

test('CSV parser rejects unclosed quotes and duplicate headers', () => {
  assert.throws(() => parseCsv('id,name\n1,"broken'), /unclosed quoted field/);
  assert.throws(() => parseCsv('id,id\n1,2'), /duplicate field/);
});

test('catalog module answers start/help and limits search results to five', async () => {
  const records = Array.from({ length: 7 }, (_, index) => ({
    'Bot ID': 'B' + index,
    'Bot Name': 'Alpha Helper ' + index,
    'English Category': 'Utilities'
  }));
  const start = await handleCatalogQuery({ message: { chat: { id: 123 }, text: '/start' } }, records);
  assert.equal(start.chat_id, 123);
  assert.ok(start.text.includes('/search'));

  const usage = await handleCatalogQuery({ message: { chat: { id: 123 }, text: '/search' } }, records);
  assert.equal(usage.text, 'Usage: /search <keyword>');

  const results = await handleCatalogQuery({ message: { chat: { id: 123 }, text: '/search alpha' } }, records);
  assert.equal(results.chat_id, 123);
  assert.equal((results.text.match(/\[B\d+\]/g) || []).length, 5);
  assert.match(results.text, /not confirmed live bots/);
});

test('catalog module ignores unsupported and malformed updates', async () => {
  assert.equal(await handleCatalogQuery({ message: { chat: { id: 1 }, text: 'hello' } }, []), null);
  assert.equal(await handleCatalogQuery({ message: { chat: { id: 1 }, text: '/unknown' } }, []), null);
  assert.equal(await handleCatalogQuery({ message: { text: '/start' } }, []), null);
});
