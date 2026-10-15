const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');

const BASE = process.env.TBMC_LIVE_URL || 'https://uniquenetworkbd.github.io/Telegram-Bot-Master-Catalog/';
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    const badResponses = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('response', r => {
      if (r.url().startsWith(new URL(BASE).origin) && r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
    });
    let loaded = false, lastError = null;
    for (let attempt = 1; attempt <= 12; attempt++) {
      try {
        await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForFunction(() => document.querySelector('#csvBadge')?.textContent === 'Loaded', null, { timeout: 10000 });
        loaded = true;
        break;
      } catch (error) {
        lastError = error;
        await delay(2000);
      }
    }
    assert.ok(loaded, `Live site did not become healthy: ${lastError}`);
    assert.equal(await page.locator('#homeTotal').textContent(), '1,000');
    assert.equal(await page.locator('#homeCats').textContent(), '100');

    await page.locator('[data-go="catalog"]').first().click();
    await page.waitForFunction(() => document.querySelectorAll('#category option').length === 101);
    assert.match(await page.locator('#page-catalog').innerText(), /not a verified directory of live Telegram bots/i);
    await page.locator('#search').fill('B001-01');
    assert.equal(await page.locator('#matchStat').textContent(), '1');
    await page.locator('#rows [data-bot="B001-01"]').first().click();
    await page.waitForFunction(() => location.hash === '#bot/B001-01');
    assert.match(await page.locator('#botDetail').innerText(), /not a verified live Telegram bot/i);

    await page.locator('#moreNavBtn').click();
    await page.locator('#moreMenu a[data-route="system"]').click();
    assert.equal(await page.locator('#systemRecords').textContent(), '1,000');
    assert.equal(await page.locator('#systemCategories').textContent(), '100');
    assert.notEqual(await page.locator('#csvBadge').textContent(), 'Failed');
    assert.doesNotMatch(await page.locator('body').innerText(), /Data unavailable/i);
    assert.match(await page.locator('body').innerText(), /Admin authentication[\s\S]*Not implemented/i);
    const widths = await page.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(widths.doc <= widths.inner + 4 && widths.body <= widths.inner + 4, `Mobile overflow: ${JSON.stringify(widths)}`);
    assert.deepEqual(pageErrors, [], 'Live page has uncaught JavaScript errors');
    assert.deepEqual(badResponses, [], 'Live page has HTTP errors');

    console.log('LIVE DEPLOYMENT BROWSER SMOKE: PASS');
    console.log(`URL: ${page.url()} | loaded records: 1000 | categories: 100`);
    console.log('Concept disclosure, search, details, System, admin boundary, responsive width: PASS');
    console.log(`Mobile widths: ${JSON.stringify(widths)} | uncaught JS errors: 0 | HTTP errors: 0`);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
