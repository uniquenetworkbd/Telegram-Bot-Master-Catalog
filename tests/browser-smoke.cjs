const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const PORT = Number(process.env.TBMC_TEST_PORT || 4173);
const BASE = `http://127.0.0.1:${PORT}`;
let server;

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(BASE + '/index.html'); if (r.ok) return; } catch {}
    await delay(250);
  }
  throw new Error('Local static server did not start');
}
async function main() {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const pageErrors = [];
    const failedLocalResponses = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(BASE) && response.status() >= 400) failedLocalResponses.push(`${response.status()} ${response.url()}`);
    });

    const started = Date.now();
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#csvBadge')?.textContent === 'Loaded', { timeout: 10000 });
    const initialLoadMs = Date.now() - started;
    assert.equal(await page.locator('#homeTotal').textContent(), '1,000');
    assert.equal(await page.locator('#homeCats').textContent(), '100');
    assert.ok(initialLoadMs < 10000, `Catalog load exceeded 10s: ${initialLoadMs}ms`);

    await page.locator('[data-go="dashboard"]').click();
    assert.equal(await page.locator('#dashTotal').textContent(), '1,000');
    assert.equal(await page.locator('#dashCats').textContent(), '100');

    await page.locator("#page-dashboard [data-go=\"catalog\"]").click();
    await page.waitForFunction(() => document.querySelectorAll('#category option').length === 101);
    const firstCategory = await page.locator('#category option').nth(1).getAttribute('value');
    await page.locator('#category').selectOption(firstCategory);
    assert.equal(await page.locator('#matchStat').textContent(), '10', 'Each category should have 10 records');
    await page.locator('#resetFilters').click();
    await page.locator('#search').fill('B001-01');
    assert.equal(await page.locator('#matchStat').textContent(), '1');
    await page.locator('#rows [data-bot="B001-01"]').first().click();
    await page.waitForFunction(() => location.hash === '#bot/B001-01');
    assert.match(await page.locator('#botDetail').innerText(), /B001-01/);
    assert.match(await page.locator('#botDetail').innerText(), /not a verified live Telegram bot/i);
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => location.hash === '#catalog' && document.querySelector('#page-catalog').classList.contains('active'));
    assert.equal(await page.locator('#search').inputValue(), 'B001-01', 'Catalog state should survive details/back navigation');

    await page.locator('#resetFilters').click();
    await page.locator('#next').click();
    assert.match(await page.locator('#pageInfo').textContent(), /Page 2/);
    await page.locator('#prev').click();
    assert.match(await page.locator('#pageInfo').textContent(), /Page 1/);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportBtn').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /telegram-bot-catalog-filtered\.csv/);

    await page.locator('#search').fill('<img src=x onerror=window.__tbmcXss=1>');
    assert.equal(await page.locator('#rows img').count(), 0, 'Search text must not become executable HTML');
    assert.equal(await page.evaluate(() => window.__tbmcXss || 0), 0, 'XSS probe must not execute');

    await page.locator('#moreNavBtn').click();
    await page.locator('#moreMenu a[data-route="system"]').click();
    assert.equal(await page.locator('#systemRecords').textContent(), '1,000');
    assert.equal(await page.locator('#systemCategories').textContent(), '100');
    assert.notEqual(await page.locator('#csvBadge').textContent(), 'Failed');
    assert.notEqual(await page.locator('#runtimeOverall').textContent(), 'Attention');
    assert.match(await page.locator('body').innerText(), /Admin authentication[\s\S]*Not implemented/i);
    assert.match(await page.locator('body').innerText(), /Backend server[\s\S]*Not used/i);
    assert.doesNotMatch(await page.locator('body').innerText(), /Data unavailable/i, 'Healthy system must not report unavailable data');
    await page.locator('#themeSelect').selectOption('light');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');

    await page.evaluate(() => { window.location.hash = '#bot/DOES-NOT-EXIST'; });
    await page.waitForFunction(() => document.querySelector('#page-bot')?.classList.contains('active'));
    assert.match(await page.locator('#botDetail').innerText(), /Bot not found/i);

    const mobileWidths = await page.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(mobileWidths.doc <= mobileWidths.inner + 4 && mobileWidths.body <= mobileWidths.inner + 4,
      `Mobile horizontal overflow: ${JSON.stringify(mobileWidths)}`);

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    desktop.on('pageerror', error => pageErrors.push(error.message));
    await desktop.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    await desktop.waitForFunction(() => document.querySelector('#csvBadge')?.textContent === 'Loaded', { timeout: 10000 });
    const desktopWidths = await desktop.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(desktopWidths.doc <= desktopWidths.inner + 4 && desktopWidths.body <= desktopWidths.inner + 4,
      `Desktop horizontal overflow: ${JSON.stringify(desktopWidths)}`);

    // Fail-closed check: a malformed/incomplete dataset must not masquerade as healthy.
    const badPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await badPage.route('**/data/Telegram_Bot_Master_Catalog_1000.csv', route => route.fulfill({
      status: 200, contentType: 'text/csv; charset=utf-8',
      body: 'index,Bot ID,Category No,Category,English Category,Bot Name,What it does,Free/Low-cost Technology,API Required?,Automation Potential,Monetization Potential,Suggested MVP,Notes\n0,B001-01,1,Test,Test,Test Bot,Description,Free,No,Low,No,Test,Test\n'
    }));
    await badPage.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    await badPage.waitForFunction(() => document.querySelector('#csvBadge')?.textContent === 'Failed');
    assert.match(await badPage.locator('#dataStatus').textContent(), /Data unavailable/i);
    assert.notEqual(await badPage.locator('#runtimeOverall').textContent(), 'Healthy');
    assert.deepEqual(pageErrors, [], 'Uncaught browser errors detected');
    assert.deepEqual(failedLocalResponses, [], 'Unexpected local HTTP errors detected');

    console.log('BROWSER REGRESSION: PASS');
    console.log(`Mobile + desktop | initial load: ${initialLoadMs}ms | 1000 records / 100 categories`);
    console.log('Search/filter/category count/details/history/pagination/export/theme/System/XSS probe: PASS');
    console.log(`Responsive widths: mobile ${JSON.stringify(mobileWidths)}; desktop ${JSON.stringify(desktopWidths)}`);
    console.log('Malformed CSV fail-closed check: PASS | uncaught JS errors: 0 | local HTTP errors: 0');
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill('SIGTERM');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
