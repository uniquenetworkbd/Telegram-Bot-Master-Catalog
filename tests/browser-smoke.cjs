const { chromium, firefox, webkit } = require('playwright');
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
    await page.waitForFunction(() => document.querySelector('#homeTotal')?.textContent === '1,000', null, { timeout: 10000 });
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
    const cspResult = await page.evaluate(() => new Promise(resolve => {
      document.addEventListener('securitypolicyviolation', event => resolve(event.violatedDirective), { once: true });
      const injected = document.createElement('script');
      injected.textContent = 'window.__tbmcCspProbe = 1';
      document.head.appendChild(injected);
      setTimeout(() => resolve('no-violation'), 150);
    }));
    assert.match(cspResult, /script-src/i, 'CSP should block injected inline scripts');
    assert.equal(await page.evaluate(() => window.__tbmcCspProbe || 0), 0, 'CSP probe must not execute');

    assert.equal(await page.locator('#page-system').count(), 0, 'System must be a navigation group, not a separate hub page');
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.locator('#tbmcUnifiedNavigation').count(), 1, 'Shared bottom navigation module must load');
    const navToggle = page.locator('.tbmc-bottom-toggle');
    assert.equal(await navToggle.isVisible(), true, 'Main navigation toggle must be visible');
    await navToggle.click();
    assert.equal(await page.locator('#tbmcBottomPanel').isVisible(), true, 'Bottom navigation panel should open upwards');
    assert.deepEqual(await page.locator('#tbmcSystemLinks a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['./pages/system-configuration.html', './pages/logs-audit.html', './pages/version-logs.html', './pages/live-information.html']);
    assert.match((await page.locator('#tbmcSystemLinks').innerText()).replace(/[⚙≋◷◉]/g, ''), /System configuration[\s\S]*Logs & Audit[\s\S]*Version Logs[\s\S]*Live information/);
    await page.locator('.tbmc-system-toggle').click();
    assert.equal(await page.locator('#tbmcSystemLinks').isVisible(), false, 'Shared System submenu should collapse');
    await page.locator('.tbmc-system-toggle').click();
    assert.equal(await page.locator('#tbmcSystemLinks').isVisible(), true, 'Shared System submenu should expand');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#tbmcUnifiedNavigation').count(), 1, 'Same navigation module must remain available on mobile');
    assert.equal(await page.locator('.sidebar, .bottom-nav, #moreMenu').count(), 0, 'Legacy duplicate navigation must be removed');
    assert.ok(await page.evaluate(() => Boolean(window.TBMC && window.TBMC.engineCore)), 'Main Engine runtime should be exposed');
    const engineIds = await page.evaluate(() => window.TBMC.engineCore.listEngines().map(engine => engine.id));
    for (const requiredEngine of ['main-engine', 'engine-registry', 'catalog-data', 'catalog-ui', 'local-activity']) {
      assert.ok(engineIds.includes(requiredEngine), 'Missing registered engine: ' + requiredEngine);
    }
    // Preserve the current synchronous Event Bus API before refactoring it.
    const eventContract = await page.evaluate(() => {
      const core = window.TBMC.engineCore;
      const name = 'test.compatibility_probe';
      const seen = [];
      const payload = { probe: true };
      const offExact = core.subscribe(name, event => seen.push('exact:' + event.type));
      const offWildcard = core.subscribe('*', event => seen.push('wildcard:' + event.type));
      const event = core.publish(name, payload);
      offExact();
      offWildcard();

      const failureTrace = [];
      const offThrow = core.subscribe('test.listener_failure_probe', () => { throw new Error('listener probe'); });
      const offAfterThrow = core.subscribe('test.listener_failure_probe', () => failureTrace.push('continued'));
      core.publish('test.listener_failure_probe', {});
      offThrow();
      offAfterThrow();

      let unsubscribedCalls = 0;
      const offBeforePublish = core.subscribe('test.unsubscribe_probe', () => { unsubscribedCalls += 1; });
      offBeforePublish();
      core.publish('test.unsubscribe_probe', {});

      let duplicateCalls = 0;
      const duplicateCallback = () => { duplicateCalls += 1; };
      const offDuplicateA = core.subscribe('test.duplicate_probe', duplicateCallback);
      const offDuplicateB = core.subscribe('test.duplicate_probe', duplicateCallback);
      offDuplicateA();
      core.publish('test.duplicate_probe', {});
      offDuplicateB();

      let invalidCallback = '';
      try { core.subscribe('test.invalid_callback', null); } catch (error) { invalidCallback = error.name; }
      let duplicateEngine = '';
      try { core.register({ id: 'main-engine', name: 'Duplicate' }); } catch (error) { duplicateEngine = error.message; }
      let invalidEngineId = '';
      try { core.register({ id: 'Invalid Engine ID', name: 'Invalid' }); } catch (error) { invalidEngineId = error.name; }
      return {
        keys: Object.keys(event).sort(),
        type: event.type,
        timestampValid: !Number.isNaN(Date.parse(event.at)),
        payloadSame: event.payload === payload,
        frozen: Object.isFrozen(event),
        seen,
        failureTrace,
        unsubscribedCalls,
        duplicateCalls,
        invalidCallback,
        duplicateEngine,
        invalidEngineId
      };
    });
    assert.deepEqual(eventContract.keys, ['at', 'payload', 'type']);
    assert.equal(eventContract.type, 'test.compatibility_probe');
    assert.equal(eventContract.timestampValid, true);
    assert.equal(eventContract.payloadSame, true);
    assert.equal(eventContract.frozen, true);
    assert.deepEqual(eventContract.seen, ['exact:test.compatibility_probe', 'wildcard:test.compatibility_probe']);
    assert.deepEqual(eventContract.failureTrace, ['continued'], 'One subscriber error must not stop later subscribers');
    assert.equal(eventContract.unsubscribedCalls, 0, 'Unsubscribed callbacks must not receive later events');
    assert.equal(eventContract.duplicateCalls, 1, 'One unsubscribe removes only one duplicate subscription');
    assert.equal(eventContract.invalidCallback, 'TypeError');
    assert.match(eventContract.duplicateEngine, /Duplicate engine id/);
    assert.equal(eventContract.invalidEngineId, 'TypeError');

    const schemaContract = await page.evaluate(() => {
      const core = window.TBMC.engineCore;
      const metadata = core.registerEventSchema('test.schema-probe', {
        version: 1,
        publisher: 'browser-smoke',
        privacy: 'internal',
        consumers: ['test-runner', 'test-runner'],
        validate: payload => Boolean(payload && payload.ok === true)
      });
      const metadataBeforeMutation = {
        ...metadata,
        consumers: [...metadata.consumers]
      };
      metadata.consumers.push('mutated-public-snapshot');
      const safeSnapshot = core.getEventSchema('test.schema-probe');
      const valid = core.validateEvent('test.schema-probe', { ok: true });
      const invalid = core.validateEvent('test.schema-probe', { ok: false });
      const unknown = core.validateEvent('test.unknown-schema', { ok: false });
      let invalidPublish = '';
      let delivered = 0;
      const off = core.subscribe('test.schema-probe', () => { delivered += 1; });
      try { core.publish('test.schema-probe', { ok: false }); } catch (error) { invalidPublish = error.name; }
      const event = core.publish('test.schema-probe', { ok: true });
      off();
      let duplicateSchema = '';
      try {
        core.registerEventSchema('test.schema-probe', {
          version: 1, publisher: 'browser-smoke', privacy: 'internal', consumers: [], validate: () => true
        });
      } catch (error) { duplicateSchema = error.message; }
      return {
        metadata: metadataBeforeMutation,
        valid,
        invalid,
        unknown,
        invalidPublish,
        delivered,
        eventKeys: Object.keys(event).sort(),
        publicMetadataHasValidator: Object.prototype.hasOwnProperty.call(safeSnapshot, 'validate'),
        publicSnapshotIsolated: !safeSnapshot.consumers.includes('mutated-public-snapshot'),
        listed: core.listEventSchemas().some(schema => schema.type === 'test.schema-probe'),
        duplicateSchema
      };
    });
    assert.deepEqual(schemaContract.metadata, {
      type: 'test.schema-probe', version: 1, publisher: 'browser-smoke',
      privacy: 'internal', consumers: ['test-runner']
    });
    assert.equal(schemaContract.valid.valid, true);
    assert.equal(schemaContract.invalid.valid, false);
    assert.deepEqual(schemaContract.invalid.errors, ['INVALID_PAYLOAD']);
    assert.equal(schemaContract.unknown.schemaRegistered, false, 'Unregistered legacy event types remain compatible');
    assert.equal(schemaContract.invalidPublish, 'TypeError');
    assert.equal(schemaContract.delivered, 1, 'Invalid schema payload must not be delivered');
    assert.deepEqual(schemaContract.eventKeys, ['at', 'payload', 'type'], 'Schema metadata must not change the legacy event envelope');
    assert.equal(schemaContract.publicMetadataHasValidator, false, 'Public schema snapshots must not expose validator callbacks');
    assert.equal(schemaContract.publicSnapshotIsolated, true, 'Public metadata mutation must not affect internal schema state');
    assert.equal(schemaContract.listed, true);
    assert.match(schemaContract.duplicateSchema, /Duplicate event schema/);

    const moduleManagerContract = await page.evaluate(async () => {
      const manager = window.TBMC.moduleManager;
      const core = window.TBMC.engineCore;
      if (!manager) return { available: false };
      const trace = [];
      const lifecycle = (name, extra = {}) => ({
        validate: async () => { trace.push(name + ':validate'); },
        init: async () => { trace.push(name + ':init'); },
        start: async context => {
          trace.push(name + ':start');
          if (extra.subscribe) context.subscribe('test.managed.cleanup', () => trace.push(name + ':event'));
          if (extra.fail) throw new Error('intentional startup probe');
        },
        healthCheck: async () => ({ status: 'healthy', detail: name + ' ready' }),
        stop: async () => { trace.push(name + ':stop'); },
        destroy: async () => { trace.push(name + ':destroy'); }
      });
      const definition = (id, dependencies = [], extra = {}) => ({
        id, name: id, version: extra.version || '1.0.0', contractVersion: '1.0.0',
        dependencies, capabilities: ['test.lifecycle'], provides: [], publishes: [], subscribes: [],
        lifecycle: lifecycle(id, extra)
      });

      manager.register(definition('test-mm-dependency', [], { subscribe: true }));
      manager.register(definition('test-mm-consumer', [{ id: 'test-mm-dependency', version: '^1.0.0' }]));
      const plan = manager.resolveDependencies('test-mm-consumer');
      const started = await manager.start('test-mm-consumer');
      const initialDependencyState = manager.getEngine('test-mm-dependency').state;
      const dependencySnapshot = manager.getEngine('test-mm-dependency');
      dependencySnapshot.dependencies.push('mutated-snapshot');
      const snapshotIsolated = !manager.getEngine('test-mm-dependency').dependencies.includes('mutated-snapshot');
      let stopProviderError = '';
      try { await manager.stop('test-mm-dependency'); } catch (error) { stopProviderError = error.code; }
      await manager.stop('test-mm-consumer');
      await manager.stop('test-mm-dependency');
      core.publish('test.managed.cleanup', {});
      const cleanupIsolated = !trace.includes('test-mm-dependency:event');
      const restarted = await manager.restart('test-mm-dependency');
      await manager.disable('test-mm-dependency');
      const disabled = manager.getEngine('test-mm-dependency');
      manager.enable('test-mm-dependency');
      const reenabled = manager.getEngine('test-mm-dependency');

      manager.register(definition('test-mm-missing', [{ id: 'not-present-engine' }]));
      let missingError = '';
      try { manager.validate('test-mm-missing'); } catch (error) { missingError = error.code; }

      manager.register(definition('test-mm-cycle-a', [{ id: 'test-mm-cycle-b' }]));
      manager.register(definition('test-mm-cycle-b', [{ id: 'test-mm-cycle-a' }]));
      let cycleError = '';
      try { manager.resolveDependencies('test-mm-cycle-a'); } catch (error) { cycleError = error.code; }

      manager.register(definition('test-mm-version-provider', [], { version: '1.2.0' }));
      manager.register(definition('test-mm-version-consumer', [{ id: 'test-mm-version-provider', version: '^2.0.0' }]));
      let versionError = '';
      try { manager.validate('test-mm-version-consumer'); } catch (error) { versionError = error.code; }

      manager.register(definition('test-mm-failing', [], { fail: true }));
      let failureCode = '';
      try { await manager.start('test-mm-failing'); } catch (error) { failureCode = error.code; }
      const failedState = manager.getEngine('test-mm-failing').state;
      manager.register(definition('test-mm-unrelated'));
      const unrelated = await manager.start('test-mm-unrelated');

      let duplicateError = '';
      try { manager.register(definition('test-mm-unrelated')); } catch (error) { duplicateError = error.code; }
      let invalidDefinition = '';
      try { manager.register({ id: 'Bad ID', name: 'Invalid', version: '1.0.0', contractVersion: '1.0.0', dependencies: [], capabilities: [], provides: [], publishes: [], subscribes: [], lifecycle: lifecycle('bad') }); }
      catch (error) { invalidDefinition = error.code; }

      return {
        available: true,
        plan: plan.order,
        warnings: plan.warnings,
        started: started.state,
        dependencyState: initialDependencyState,
        snapshotIsolated,
        stopProviderError,
        cleanupIsolated,
        restarted: restarted.state,
        disabled: disabled.state,
        reenabled: reenabled.state,
        missingError,
        cycleError,
        versionError,
        failureCode,
        failedState,
        unrelatedState: unrelated.state,
        duplicateError,
        invalidDefinition,
        trace
      };
    });
    assert.equal(moduleManagerContract.available, true, 'Module Manager API should be loaded');
    assert.deepEqual(moduleManagerContract.plan, ['test-mm-dependency', 'test-mm-consumer']);
    assert.deepEqual(moduleManagerContract.warnings, []);
    assert.equal(moduleManagerContract.started, 'active');
    assert.equal(moduleManagerContract.dependencyState, 'active');
    assert.equal(moduleManagerContract.snapshotIsolated, true);
    assert.equal(moduleManagerContract.stopProviderError, 'DEPENDENTS_ACTIVE');
    assert.equal(moduleManagerContract.cleanupIsolated, true, 'Managed subscriptions must be removed on stop');
    assert.equal(moduleManagerContract.restarted, 'active');
    assert.equal(moduleManagerContract.disabled, 'disabled');
    assert.equal(moduleManagerContract.reenabled, 'registered');
    assert.equal(moduleManagerContract.missingError, 'MISSING_REQUIRED_DEPENDENCY');
    assert.equal(moduleManagerContract.cycleError, 'DEPENDENCY_CYCLE');
    assert.equal(moduleManagerContract.versionError, 'VERSION_INCOMPATIBLE');
    assert.equal(moduleManagerContract.failureCode, 'ENGINE_START_FAILED');
    assert.equal(moduleManagerContract.failedState, 'failed');
    assert.equal(moduleManagerContract.unrelatedState, 'active', 'One failed Engine must not block unrelated Engines');
    assert.equal(moduleManagerContract.duplicateError, 'DUPLICATE_ENGINE_ID');
    assert.equal(moduleManagerContract.invalidDefinition, 'INVALID_ENGINE_DEFINITION');
    assert.deepEqual(moduleManagerContract.trace.slice(0, 8), [
      'test-mm-dependency:validate', 'test-mm-dependency:init', 'test-mm-dependency:start',
      'test-mm-consumer:validate', 'test-mm-consumer:init', 'test-mm-consumer:start',
      'test-mm-consumer:stop', 'test-mm-dependency:stop'
    ]);
    assert.match(await page.locator('#page-profile').innerText(), /Admin authentication is not implemented/i);
    assert.doesNotMatch(await page.locator('body').innerText(), /Data unavailable/i, 'Healthy system must not report unavailable data');
    const configPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    configPage.on('pageerror', error => pageErrors.push('System configuration: ' + error.message));
    await configPage.goto(BASE + '/pages/system-configuration.html', { waitUntil: 'networkidle' });
    assert.match(await configPage.locator('h1').textContent(), /System configuration/i);
    await configPage.locator('#themeSelect').selectOption('light');
    await configPage.locator('#saveSettings').click();
    assert.equal(await configPage.locator('html').getAttribute('data-theme'), 'light');
    await configPage.locator('#resetSettings').click();
    await configPage.close();
    for (const [path, heading] of [['pages/version-logs.html','Version Logs'],['pages/live-information.html','Live information']]) {
      const modulePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      modulePage.on('pageerror', error => pageErrors.push(path + ': ' + error.message));
      await modulePage.goto(BASE + '/' + path, { waitUntil: 'networkidle' });
      assert.match(await modulePage.locator('h1').textContent(), new RegExp(heading, 'i'));
      assert.equal(await modulePage.locator('#tbmcUnifiedNavigation').count(), 1, 'Standalone pages must load the shared bottom navigation');
      await modulePage.locator('.tbmc-bottom-toggle').click();
      assert.equal(await modulePage.locator('#tbmcSystemLinks a').count(), 4, 'Shared System submenu must be available on standalone pages');
      if (path.includes('version-logs')) {
        assert.equal(await modulePage.locator('#releaseCount').textContent(), '2', 'Release count must match the numbered ledger');
        assert.equal(await modulePage.locator('#releaseLatest').textContent(), 'v1.0.1', 'Latest version must match the newest release');
        assert.equal(await modulePage.locator('.release-card').count(), 2, 'Only documented release records should be shown');
        assert.match(await modulePage.locator('#releaseList').innerText(), /#001 · v1\.0\.0[\s\S]*#002 · v1\.0\.1/);
      }
      if (path.includes('live-information')) assert.match(await modulePage.locator('body').innerText(), /Global visitor count[\s\S]*Unavailable/i);
      await modulePage.close();
    }

    await page.evaluate(() => { window.location.hash = '#bot/DOES-NOT-EXIST'; });
    await page.waitForFunction(() => document.querySelector('#page-bot')?.classList.contains('active'));
    assert.match(await page.locator('#botDetail').innerText(), /Bot not found/i);

    const mobileWidths = await page.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(mobileWidths.doc <= mobileWidths.inner + 4 && mobileWidths.body <= mobileWidths.inner + 4,
      `Mobile horizontal overflow: ${JSON.stringify(mobileWidths)}`);

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    desktop.on('pageerror', error => pageErrors.push(error.message));
    await desktop.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    await desktop.waitForFunction(() => document.querySelector('#homeTotal')?.textContent === '1,000', null, { timeout: 10000 });
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
    await badPage.waitForFunction(() => /Data unavailable/i.test(document.querySelector('#dataStatus')?.textContent || ''), null, { timeout: 10000 });
    assert.match(await badPage.locator('#dataStatus').textContent(), /Data unavailable/i);
    assert.match(await badPage.locator('#dataStatus').textContent(), /Data unavailable/i);
    assert.deepEqual(pageErrors, [], 'Uncaught browser errors detected');
    assert.deepEqual(failedLocalResponses, [], 'Unexpected local HTTP errors detected');

    // Cross-engine smoke: the real canonical CSV must work in Firefox and WebKit too.
    for (const [engineName, engineType] of [['Firefox', firefox], ['WebKit', webkit]]) {
      const crossBrowser = await engineType.launch({ headless: true });
      try {
        const crossPage = await crossBrowser.newPage({ viewport: { width: 390, height: 844 } });
        const crossErrors = [];
        const crossHttpErrors = [];
        crossPage.on('pageerror', error => crossErrors.push(error.message));
        crossPage.on('response', response => {
          if (response.url().startsWith(BASE) && response.status() >= 400) crossHttpErrors.push(`${response.status()} ${response.url()}`);
        });
        await crossPage.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
        await crossPage.waitForFunction(() => document.querySelector('#homeTotal')?.textContent === '1,000', null, { timeout: 10000 });
        assert.equal(await crossPage.locator('#homeTotal').textContent(), '1,000', engineName + ': loaded record count');
        assert.equal(await crossPage.locator('#homeCats').textContent(), '100', engineName + ': category count');
        await crossPage.locator('#page-home [data-go="catalog"]').first().click();
        await crossPage.waitForFunction(() => document.querySelectorAll('#category option').length === 101);
        await crossPage.locator('#category').selectOption({ index: 1 });
        assert.equal(await crossPage.locator('#matchStat').textContent(), '10', engineName + ': category filter count');
        await crossPage.locator('#resetFilters').click();
        await crossPage.locator('#search').fill('B001-01');
        assert.equal(await crossPage.locator('#matchStat').textContent(), '1', engineName + ': search');
        await crossPage.locator('#rows [data-bot="B001-01"]').first().click();
        await crossPage.waitForFunction(() => location.hash === '#bot/B001-01');
        assert.match(await crossPage.locator('#botDetail').innerText(), /not a verified live Telegram bot/i);
        const crossWidths = await crossPage.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        assert.ok(crossWidths.doc <= crossWidths.inner + 4 && crossWidths.body <= crossWidths.inner + 4,
          engineName + ': mobile horizontal overflow ' + JSON.stringify(crossWidths));
        assert.deepEqual(crossErrors, [], engineName + ': uncaught browser errors');
        assert.deepEqual(crossHttpErrors, [], engineName + ': local HTTP errors');
        console.log(`${engineName} cross-browser smoke: PASS | ${JSON.stringify(crossWidths)} | JS errors: 0 | HTTP errors: 0`);
      } finally {
        await crossBrowser.close();
      }
    }

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
