(() => {
  'use strict';

  const VERSION = '1.0.0';
  const core = window.TBMC && window.TBMC.engineCore;
  const manager = window.TBMC && window.TBMC.moduleManager;
  const repository = window.TBMC && window.TBMC.catalogRepository;
  if (!core || !manager || !repository) throw new Error('Main Engine requires Engine Core, Module Manager and Storage API');

  const state = {
    status: 'idle',
    startedAt: null,
    readyAt: null,
    shutdownAt: null,
    lastError: null,
    bootstrapPromise: null,
    shutdownPromise: null
  };

  function safeMessage(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 240) : fallback;
  }

  function runtimeInfo() {
    const engines = manager.listEngines();
    return {
      version: VERSION,
      status: state.status,
      startedAt: state.startedAt,
      readyAt: state.readyAt,
      shutdownAt: state.shutdownAt,
      lastError: state.lastError ? { ...state.lastError } : null,
      managedEngineCount: engines.length,
      activeManagedEngineCount: engines.filter(engine => ['active', 'degraded'].includes(engine.state)).length,
      eventSchemaCount: core.listEventSchemas().length,
      managedEngines: engines.map(engine => ({
        id: engine.id,
        state: engine.state,
        health: engine.health.status,
        enabled: engine.enabled
      }))
    };
  }

  function ensureStorageEngine() {
    if (manager.getEngine('storage-engine')) return;
    manager.register({
      id: 'storage-engine',
      name: 'Storage Engine',
      version: VERSION,
      contractVersion: VERSION,
      description: 'Loads and validates the canonical CSV dataset for the browser runtime.',
      dependencies: [],
      capabilities: ['CSV loading', 'dataset schema validation', 'category integrity'],
      provides: ['catalog.records', 'catalog.categories'],
      publishes: ['catalog.loaded', 'storage.load_failed'],
      subscribes: [],
      lifecycle: {
        validate: () => typeof repository.load === 'function',
        init: async () => {},
        start: async () => {
          try {
            const dataset = await repository.load();
            core.publish('catalog.loaded', {
              records: dataset.records.length,
              categories: Object.keys(dataset.categoryCounts).length
            });
          } catch (_) {
            core.publish('storage.load_failed', { code: 'STORAGE_LOAD_FAILED' });
            throw managerError('STORAGE_LOAD_FAILED', 'Canonical catalog could not be loaded');
          }
        },
        healthCheck: async () => {
          const dataset = await repository.load();
          const categoryCount = Object.keys(dataset.categoryCounts).length;
          return dataset.records.length === 1000 && categoryCount === 100
            ? { status: 'healthy', detail: '1,000 records and 100 categories validated' }
            : { status: 'unhealthy', detail: 'Dataset integrity does not match the release contract' };
        },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function managerError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function ensureAnalyticsEngine() {
    if (manager.getEngine('analytics-engine')) return;
    manager.register({
      id: 'analytics-engine',
      name: 'Analytics Engine',
      version: VERSION,
      contractVersion: VERSION,
      description: 'Computes aggregate catalog counts and chart data without persisting visitor queries.',
      dependencies: [{ id: 'storage-engine', version: '^1.0.0' }],
      capabilities: ['record counts', 'category metrics', 'API requirement metrics', 'automation metrics'],
      provides: ['catalog.analytics', 'catalog.facets-metrics'],
      publishes: [],
      subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMC.analyticsEngine && typeof window.TBMC.analyticsEngine.summarize === 'function'),
        init: async () => {},
        start: async () => {},
        healthCheck: async () => {
          if (!window.TBMC.analyticsEngine || typeof window.TBMC.analyticsEngine.summarize !== 'function') {
            return { status: 'unhealthy', detail: 'Analytics Engine API is unavailable' };
          }
          const dataset = await repository.load();
          const summary = window.TBMC.analyticsEngine.summarize(dataset.records);
          return summary.totalRecords === 1000 && summary.totalCategories === 100
            ? { status: 'healthy', detail: 'Aggregate metrics match the validated catalog dataset' }
            : { status: 'unhealthy', detail: 'Aggregate metrics do not match the catalog release contract' };
        },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function ensureHistoryEngine() {
    if (manager.getEngine('history-engine')) return;
    manager.register({
      id: 'history-engine',
      name: 'History Engine',
      version: VERSION,
      contractVersion: VERSION,
      description: 'Owns URL hash parsing, safe route encoding and browser history pushState integration.',
      dependencies: [{ id: 'main-engine', version: '^1.0.0' }],
      capabilities: ['route parsing', 'safe bot detail URLs', 'browser back/forward support'],
      provides: ['navigation.history'],
      publishes: ['navigation.changed'],
      subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMC.historyEngine &&
          typeof window.TBMC.historyEngine.parseLocation === 'function' &&
          typeof window.TBMC.historyEngine.push === 'function'),
        init: async () => {},
        start: async () => {},
        healthCheck: async () => Boolean(window.TBMC.historyEngine &&
          typeof window.TBMC.historyEngine.snapshot === 'function')
          ? { status: 'healthy', detail: 'Browser route history API is available' }
          : { status: 'unhealthy', detail: 'History Engine API is unavailable' },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function ensureSearchEngine() {
    if (manager.getEngine('search-engine')) return;
    manager.register({
      id: 'search-engine',
      name: 'Search Engine',
      version: VERSION,
      contractVersion: VERSION,
      description: 'Owns full-text matching, category/API/automation filters, sorting and search facets.',
      dependencies: [{ id: 'storage-engine', version: '^1.0.0' }],
      capabilities: ['full-text search', 'category filter', 'API filter', 'automation filter', 'sorting', 'facets'],
      provides: ['catalog.search', 'catalog.search-facets'],
      publishes: [],
      subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMC.searchEngine &&
          typeof window.TBMC.searchEngine.filter === 'function' &&
          typeof window.TBMC.searchEngine.getFacets === 'function'),
        init: async () => {},
        start: async () => {},
        healthCheck: async () => Boolean(window.TBMC.searchEngine &&
          typeof window.TBMC.searchEngine.filter === 'function' &&
          typeof window.TBMC.searchEngine.getFacets === 'function')
          ? { status: 'healthy', detail: 'Search and filter operations are available' }
          : { status: 'unhealthy', detail: 'Search Engine API is unavailable' },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function ensureCatalogEngine() {
    if (manager.getEngine('catalog-engine')) return;
    manager.register({
      id: 'catalog-engine',
      name: 'Catalog Engine',
      version: VERSION,
      contractVersion: VERSION,
      description: 'Adapts the existing Catalog feature to the managed runtime lifecycle.',
      dependencies: [{ id: 'storage-engine', version: '^1.0.0' }, { id: 'search-engine', version: '^1.0.0' }],
      capabilities: ['catalog route', 'record details', 'catalog metrics'],
      provides: ['catalog.ui', 'catalog.details'],
      publishes: [],
      subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMC.catalog && typeof window.TBMC.catalog.runtime === 'function' &&
          window.TBMC.searchEngine && typeof window.TBMC.searchEngine.filter === 'function' &&
          window.TBMC.appShell && typeof window.TBMC.appShell.go === 'function'),
        init: async () => {},
        start: async () => {
          if (window.TBMC.catalog && typeof window.TBMC.catalog.runtime === 'function') {
            window.TBMC.catalog.runtime();
          }
        },
        healthCheck: async () => Boolean(window.TBMC.catalog && typeof window.TBMC.catalog.apply === 'function')
          ? { status: 'healthy', detail: 'Catalog UI and record operations are available' }
          : { status: 'unhealthy', detail: 'Catalog UI API is unavailable' },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function ensureLoggingEngine() {
    if (manager.getEngine('logging-engine')) return;
    manager.register({
      id: 'logging-engine', name: 'Logging Engine', version: VERSION, contractVersion: VERSION,
      description: 'Keeps a bounded, in-memory event index without storing event payloads or uploading activity.',
      dependencies: [], capabilities: ['event-type log', 'schema publisher metadata', 'bounded in-memory history'],
      provides: ['runtime.logs'], publishes: [], subscribes: ['*'],
      lifecycle: {
        validate: () => Boolean(window.TBMC.loggingEngine &&
          typeof window.TBMC.loggingEngine.start === 'function' &&
          typeof window.TBMC.loggingEngine.listRecent === 'function'),
        init: async () => {},
        start: async context => window.TBMC.loggingEngine.start(context),
        healthCheck: async () => window.TBMC.loggingEngine.getStatus().listening
          ? { status: 'healthy', detail: 'Bounded in-memory event index is listening; payloads are not retained' }
          : { status: 'unhealthy', detail: 'Logging subscription is not active' },
        stop: async () => window.TBMC.loggingEngine.stop(),
        destroy: async () => window.TBMC.loggingEngine.stop()
      }
    });
  }

  function ensureSecurityEngine() {
    if (manager.getEngine('security-engine')) return;
    manager.register({
      id: 'security-engine', name: 'Security Engine', version: VERSION, contractVersion: VERSION,
      description: 'Audits selected document-level CSP, script-origin and inline-handler controls.',
      dependencies: [], capabilities: ['CSP check', 'same-origin script check', 'inline event-handler check'],
      provides: ['runtime.security-audit'], publishes: [], subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMC.securityEngine && typeof window.TBMC.securityEngine.inspectDocument === 'function'),
        init: async () => {},
        start: async () => {},
        healthCheck: async () => {
          const report = window.TBMC.securityEngine.inspectDocument();
          return report.passed
            ? { status: 'healthy', detail: 'Document-level policy checks passed; this is not a complete security guarantee' }
            : { status: 'unhealthy', detail: 'Document security audit found: ' + report.findings.map(item => item.code).join(', ') };
        },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function ensureAdminEngine() {
    if (manager.getEngine('admin-engine')) return;
    manager.register({
      id: 'admin-engine', name: 'Admin Engine', version: VERSION, contractVersion: VERSION,
      description: 'Reports static project-profile capabilities; does not claim authenticated admin access.',
      dependencies: [{ id: 'storage-engine', version: '^1.0.0' }],
      capabilities: ['project metadata profile', 'admin capability disclosure'],
      provides: ['admin.profile-capabilities'], publishes: [], subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMC.adminEngine && typeof window.TBMC.adminEngine.getCapabilities === 'function'),
        init: async () => {},
        start: async () => {},
        healthCheck: async () => {
          const capabilities = window.TBMC.adminEngine.getCapabilities();
          return capabilities.mode === 'static-project-profile' &&
            capabilities.authenticationConfigured === false &&
            capabilities.serverAuthorizationEnforced === false
            ? { status: 'healthy', detail: 'Static-project capability contract is consistent; authenticated administration is explicitly not configured' }
            : { status: 'unhealthy', detail: 'Admin capability boundary is inconsistent' };
        },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function ensureSystemEngine() {
    if (manager.getEngine('system-engine')) return;
    manager.register({
      id: 'system-engine', name: 'System Engine', version: VERSION, contractVersion: VERSION,
      description: 'Provides a consolidated runtime snapshot and truthful static-platform capability boundaries.',
      dependencies: [
        { id: 'logging-engine', version: '^1.0.0' },
        { id: 'security-engine', version: '^1.0.0' }
      ],
      capabilities: ['runtime snapshot', 'event schema count', 'local diagnostics status', 'system module inventory'],
      provides: ['system.runtime-snapshot'], publishes: [], subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMC.systemEngine && typeof window.TBMC.systemEngine.snapshot === 'function'),
        init: async () => {},
        start: async () => {},
        healthCheck: async () => {
          const snapshot = window.TBMC.systemEngine.snapshot();
          return snapshot.runtimeState === 'starting' || snapshot.runtimeState === 'ready' || snapshot.runtimeState === 'degraded'
            ? { status: 'healthy', detail: 'Runtime and local System capability snapshot are available' }
            : { status: 'unhealthy', detail: 'Main runtime is not in a startable state' };
        },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function ensureBotEngine() {
    if (manager.getEngine('bot-engine')) return;
    manager.register({
      id: 'bot-engine',
      name: 'Bot Engine',
      version: VERSION,
      contractVersion: VERSION,
      description: 'Registers bot modules and dispatches Telegram updates through injected services; no bot token is exposed to the browser.',
      dependencies: [
        { id: 'storage-engine', version: '^1.0.0' },
        { id: 'security-engine', version: '^1.0.0' }
      ],
      capabilities: ['bot module registry', 'Telegram update contract', 'catalog query module'],
      provides: ['bot.module-registry', 'bot.update-dispatch'],
      publishes: ['bot.module_registered'],
      subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMC.botEngine &&
          typeof window.TBMC.botEngine.listModules === 'function' &&
          typeof window.TBMC.botEngine.dispatch === 'function' &&
          window.TBMC.botEngine.listModules().some(module => module.id === 'catalog-query')),
        init: async () => {},
        start: async () => {},
        healthCheck: async () => {
          const api = window.TBMC.botEngine;
          const status = api && api.getStatus();
          const moduleReady = api && api.listModules().some(module => module.id === 'catalog-query');
          return status && moduleReady && status.tokenAvailableToBrowser === false
            ? { status: 'healthy', detail: 'Bot module registry and Catalog Query contract are available; Telegram credentials remain outside the browser' }
            : { status: 'unhealthy', detail: 'Bot module contract is missing or violates the credential boundary' };
        },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  function ensureAuthEngine() {
    if (manager.getEngine('auth-otp-engine')) return;
    manager.register({
      id: 'auth-otp-engine',
      name: 'Authentication & OTP Bot Engine',
      version: VERSION,
      contractVersion: VERSION,
      description: 'Coordinates Telegram OTP login, registration, session restoration and logout through a server-side authentication API; it never stores bot credentials in the browser.',
      dependencies: [
        { id: 'bot-engine', version: '^1.0.0' },
        { id: 'security-engine', version: '^1.0.0' }
      ],
      capabilities: ['OTP login', 'OTP registration', 'server-managed sessions', 'logout and session revocation', 'authentication service health'],
      provides: ['auth.otp-verification', 'auth.registration', 'auth.session', 'auth.logout'],
      publishes: ['auth.session_checked', 'auth.backend_unavailable'],
      subscribes: [],
      lifecycle: {
        validate: () => Boolean(window.TBMCAuthEngine &&
          typeof window.TBMCAuthEngine.status === 'function' &&
          typeof window.TBMCAuthEngine.getSession === 'function' &&
          typeof window.TBMCAuthEngine.health === 'function'),
        init: async () => {},
        start: async () => {
          const status = window.TBMCAuthEngine.status();
          if (!status.configured) core.publish('auth.backend_unavailable', { code: 'AUTH_BACKEND_NOT_CONFIGURED' });
        },
        healthCheck: async () => {
          const status = window.TBMCAuthEngine.status();
          if (!status.configured) {
            return { status: 'degraded', detail: 'Authentication pages and module contracts are loaded, but secure OTP backend URL is not configured; real login is disabled.' };
          }
          try {
            const result = await window.TBMCAuthEngine.health();
            return result.ready
              ? { status: 'healthy', detail: 'D1 database, Telegram OTP token and webhook health checks passed' }
              : { status: 'degraded', detail: 'Authentication API is reachable but one or more backend health checks failed' };
          } catch (_) {
            return { status: 'degraded', detail: 'Authentication API health could not be confirmed; login must not be treated as live' };
          }
        },
        stop: async () => {},
        destroy: async () => {}
      }
    });
  }

  async function bootstrap() {
    if (state.status === 'ready' || state.status === 'degraded') return runtimeInfo();
    if (state.bootstrapPromise) return state.bootstrapPromise;
    state.status = 'starting';
    state.startedAt = state.startedAt || new Date().toISOString();
    state.lastError = null;
    core.publish('runtime.starting', { version: VERSION });
    core.refreshManager();

    state.bootstrapPromise = (async () => {
      ensureStorageEngine();
      ensureHistoryEngine();
      ensureSearchEngine();
      ensureCatalogEngine();
      ensureAnalyticsEngine();
      ensureLoggingEngine();
      ensureSecurityEngine();
      ensureAdminEngine();
      ensureSystemEngine();
      ensureBotEngine();
      ensureAuthEngine();
      await manager.start('catalog-engine');
      await manager.start('history-engine');
      await manager.start('analytics-engine');
      await manager.start('admin-engine');
      await manager.start('system-engine');
      await manager.start('bot-engine');
      await manager.start('auth-otp-engine');
      const storage = manager.getEngine('storage-engine');
      const catalog = manager.getEngine('catalog-engine');
      const requiredIds = ['storage-engine', 'search-engine', 'catalog-engine', 'history-engine', 'analytics-engine', 'logging-engine', 'security-engine', 'admin-engine', 'system-engine', 'bot-engine'];
      const required = requiredIds.map(id => manager.getEngine(id));
      const unhealthy = required.filter(engine => !engine || !['active', 'degraded'].includes(engine.state) || !['healthy', 'degraded'].includes(engine.health.status));
      if (!storage || !catalog || unhealthy.length) {
        throw managerError('RUNTIME_NOT_READY', 'Required Engines are not ready: ' + unhealthy.map(engine => engine ? engine.id : 'missing-engine').join(', '));
      }
      state.status = required.some(engine => engine.state === 'degraded' || engine.health.status === 'degraded') ? 'degraded' : 'ready';
      state.readyAt = new Date().toISOString();
      core.publish('runtime.ready', {
        version: VERSION,
        engineCount: manager.listEngines().length,
        readyAt: state.readyAt
      });
      core.refreshManager();
      return runtimeInfo();
    })().catch(cause => {
      state.status = 'failed';
      state.lastError = {
        code: cause && cause.code ? String(cause.code) : 'RUNTIME_BOOTSTRAP_FAILED',
        message: safeMessage(cause && cause.message, 'Runtime bootstrap failed')
      };
      core.publish('runtime.failed', { code: state.lastError.code });
      core.refreshManager();
      throw managerError('RUNTIME_BOOTSTRAP_FAILED', state.lastError.message);
    }).finally(() => {
      state.bootstrapPromise = null;
    });
    return state.bootstrapPromise;
  }

  async function shutdown() {
    if (state.status === 'stopped') return runtimeInfo();
    if (state.shutdownPromise) return state.shutdownPromise;
    state.status = 'stopping';
    core.publish('runtime.shutdown_started', { version: VERSION });
    state.shutdownPromise = (async () => {
      const failures = [];
      for (const id of ['auth-otp-engine', 'bot-engine', 'system-engine', 'admin-engine', 'history-engine', 'catalog-engine', 'search-engine', 'analytics-engine', 'security-engine', 'logging-engine', 'storage-engine']) {
        const engine = manager.getEngine(id);
        if (!engine || !['active', 'degraded', 'failed', 'initialized', 'starting', 'blocked'].includes(engine.state)) continue;
        try { await manager.stop(id); }
        catch (error) { failures.push(error); }
      }
      if (failures.length) {
        state.status = 'failed';
        state.lastError = {
          code: 'RUNTIME_SHUTDOWN_FAILED',
          message: safeMessage(failures[0].message, 'One or more managed Engines failed to stop')
        };
        core.publish('runtime.shutdown_failed', { code: state.lastError.code });
        core.refreshManager();
        throw managerError('RUNTIME_SHUTDOWN_FAILED', state.lastError.message);
      }
      state.status = 'stopped';
      state.shutdownAt = new Date().toISOString();
      core.publish('runtime.shutdown_complete', { version: VERSION, shutdownAt: state.shutdownAt });
      core.refreshManager();
      return runtimeInfo();
    })().finally(() => {
      state.shutdownPromise = null;
    });
    return state.shutdownPromise;
  }

  const api = Object.freeze({
    version: VERSION,
    bootstrap,
    getRuntimeInfo: runtimeInfo,
    getState: () => state.status,
    shutdown
  });

  window.TBMC.mainEngine = api;
  bootstrap().catch(() => {});
})();
