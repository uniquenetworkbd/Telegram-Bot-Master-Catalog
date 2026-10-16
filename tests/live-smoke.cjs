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
        await page.waitForFunction(() => document.querySelector('#homeTotal')?.textContent === '1,000', null, { timeout: 10000 });
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

    const widths = await page.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(widths.doc <= widths.inner + 4 && widths.body <= widths.inner + 4, `Mobile overflow: ${JSON.stringify(widths)}`);
    assert.equal(await page.locator('#page-system').count(), 0, 'System must be a navigation group, not a separate hub page');
    assert.equal(await page.locator('#tbmcUnifiedNavigation').count(), 1, 'Shared bottom navigation module must load');
    await page.locator('.tbmc-bottom-toggle').click();
    assert.equal(await page.locator('#tbmcBottomPanel').isVisible(), true, 'Main navigation panel must open');
    assert.equal(await page.locator('#tbmcSystemLinks a').count(), 4, 'System submenu must expose four links');
    assert.deepEqual(await page.locator('#tbmcSystemLinks a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['./pages/system-configuration.html', './pages/logs-audit.html', './pages/version-logs.html', './pages/live-information.html']);
    assert.match((await page.locator('#tbmcSystemLinks').innerText()).replace(/[⚙≋◷◉]/g, ''), /System configuration[\\s\\S]*Logs & Audit[\\s\\S]*Version Logs[\\s\\S]*Live information/);
    await page.locator('.tbmc-system-toggle').click();
    assert.equal(await page.locator('#tbmcSystemLinks').isVisible(), false, 'System submenu should collapse');
    await page.locator('.tbmc-system-toggle').click();
    assert.equal(await page.locator('#tbmcSystemLinks').isVisible(), true, 'System submenu should expand');
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.locator('#tbmcUnifiedNavigation').count(), 1, 'Shared navigation must persist at desktop width');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#tbmcUnifiedNavigation').count(), 1, 'Shared navigation must persist at mobile width');
    for (const [path, heading] of [
      ['pages/system-configuration.html', 'System configuration'],
      ['pages/version-logs.html', 'Version Logs'],
      ['pages/live-information.html', 'Live information']
    ]) {
      const modulePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      modulePage.on('pageerror', e => pageErrors.push(path + ': ' + e.message));
      modulePage.on('response', r => {
        if (r.url().startsWith(new URL(BASE).origin) && r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
      });
      await modulePage.goto(new URL(path, BASE).href, { waitUntil: 'networkidle', timeout: 30000 });
      assert.match(await modulePage.locator('h1').textContent(), new RegExp(heading, 'i'));
      assert.equal(await modulePage.locator('#tbmcUnifiedNavigation').count(), 1, path + ': shared navigation missing');
      await modulePage.locator('.tbmc-bottom-toggle').click();
      assert.equal(await modulePage.locator('#tbmcSystemLinks a').count(), 4, path + ': System submenu links missing');
      const moduleWidths = await modulePage.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(moduleWidths.doc <= moduleWidths.inner + 4 && moduleWidths.body <= moduleWidths.inner + 4, path + ': mobile overflow ' + JSON.stringify(moduleWidths));
      if (path.includes('system-configuration')) {
        await modulePage.locator('#themeSelect').selectOption('dark');
        await modulePage.locator('#saveSettings').click();
        assert.equal(await modulePage.locator('html').getAttribute('data-theme'), 'dark');
        await modulePage.locator('#resetSettings').click();
      } else if (path.includes('version-logs')) {
        assert.equal(await modulePage.locator('#releaseCount').textContent(), '2', 'Release count must match the numbered ledger');
        assert.equal(await modulePage.locator('#releaseLatest').textContent(), 'v1.0.1', 'Latest version must match the newest release');
        assert.equal(await modulePage.locator('.release-card').count(), 2, 'Only documented release records should be shown');
        assert.match(await modulePage.locator('#releaseList').innerText(), /#001 · v1\.0\.0[\s\S]*#002 · v1\.0\.1/);
        await modulePage.locator('.release-card').first().locator('summary').click();
        assert.equal(await modulePage.locator('.release-card').first().evaluate(el => el.open), true, 'Release cards must expand');
      } else {
        await modulePage.waitForFunction(() => document.querySelector('#sessionDuration')?.textContent !== '0s' && document.querySelector('#repoStatus')?.textContent !== 'Checking', null, { timeout: 20000 });
        assert.notEqual(await modulePage.locator('#runtimeStatus').textContent(), '');
        assert.match(await modulePage.locator('body').innerText(), /Global visitor count[\s\S]*Unavailable/i);
      }
      await modulePage.close();
    }

    const auditPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    auditPage.on('pageerror', e => pageErrors.push('Logs & Audit: ' + e.message));
    auditPage.on('response', r => {
      if (r.url().startsWith(new URL(BASE).origin) && r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
    });
    await auditPage.goto(new URL('pages/logs-audit.html', BASE).href, { waitUntil: 'networkidle', timeout: 30000 });
    assert.match(await auditPage.locator('h1').textContent(), /Logs & Audit/i);
    assert.match(await auditPage.locator('body').innerText(), /LIVE GITHUB DATA/i);
    await auditPage.waitForFunction(() => {
      const workflows = document.querySelector('#workflowList');
      const commits = document.querySelector('#commitList');
      return workflows?.querySelector('.audit-item, .audit-empty') && commits?.querySelector('.audit-item, .audit-empty');
    }, null, { timeout: 20000 });
    assert.ok(await auditPage.locator('#workflowList .audit-item').count() > 0, 'Live workflow runs were not rendered');
    assert.ok(await auditPage.locator('#commitList .audit-item').count() > 0, 'Live commits were not rendered');
    await auditPage.locator('#auditFilter').selectOption('success');
    assert.ok(await auditPage.locator('#workflowList .audit-item').count() > 0, 'Workflow status filter returned no successful runs');
    const auditWidths = await auditPage.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(auditWidths.doc <= auditWidths.inner + 4 && auditWidths.body <= auditWidths.inner + 4, `Logs & Audit mobile overflow: ${JSON.stringify(auditWidths)}`);
    assert.deepEqual(pageErrors, [], 'Live pages have uncaught JavaScript errors');
    assert.deepEqual(badResponses, [], 'Live site pages have HTTP errors');

    console.log('LIVE DEPLOYMENT BROWSER SMOKE: PASS');
    console.log(`URL: ${page.url()} | loaded records: 1000 | categories: 100`);
    console.log('Concept disclosure, search, details, nested System navigation, responsive width: PASS');
    console.log(`Mobile widths: ${JSON.stringify(widths)} | uncaught JS errors: 0 | HTTP errors: 0`);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
