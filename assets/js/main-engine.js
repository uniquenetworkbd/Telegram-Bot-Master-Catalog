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
      await manager.start('catalog-engine');
      await manager.start('history-engine');
      const storage = manager.getEngine('storage-engine');
      const catalog = manager.getEngine('catalog-engine');
      if (!storage || !catalog || !['active', 'degraded'].includes(storage.state) ||
          !['active', 'degraded'].includes(catalog.state)) {
        throw managerError('RUNTIME_NOT_READY', 'Required Storage and Catalog Engines are not ready');
      }
      state.status = storage.state === 'degraded' || catalog.state === 'degraded' ? 'degraded' : 'ready';
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
      for (const id of ['history-engine', 'catalog-engine', 'search-engine', 'storage-engine']) {
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
