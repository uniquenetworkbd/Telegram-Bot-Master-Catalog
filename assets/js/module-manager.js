(() => {
  'use strict';

  const core = window.TBMC && window.TBMC.engineCore;
  if (!core) throw new Error('Module Manager requires the Main Engine runtime');

  const records = new Map();
  const HOOK_TIMEOUT_MS = 5000;
  const ID_PATTERN = /^[a-z][a-z0-9.-]{1,63}$/;
  const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
  const RANGE_PATTERN = /^(?:\*|(?:\^|~)?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;
  const HOOKS = ['validate', 'init', 'start', 'healthCheck', 'stop', 'destroy'];

  function managerError(code, message, details) {
    const error = new Error(message);
    error.code = code;
    if (details !== undefined) error.details = details;
    return error;
  }

  function parseVersion(value) {
    const match = String(value || '').match(VERSION_PATTERN);
    return match ? match.slice(1, 4).map(Number) : null;
  }

  function compareVersion(a, b) {
    for (let i = 0; i < 3; i += 1) {
      if (a[i] > b[i]) return 1;
      if (a[i] < b[i]) return -1;
    }
    return 0;
  }

  function versionMatches(actual, constraint) {
    if (constraint === '*') return true;
    if (actual === constraint) return true;
    const actualVersion = parseVersion(actual);
    const prefix = constraint[0];
    const rangeVersion = parseVersion(prefix === '^' || prefix === '~' ? constraint.slice(1) : constraint);
    if (!actualVersion || !rangeVersion || (prefix !== '^' && prefix !== '~')) return false;
    if (compareVersion(actualVersion, rangeVersion) < 0) return false;
    if (prefix === '~') return actualVersion[0] === rangeVersion[0] && actualVersion[1] === rangeVersion[1];
    if (rangeVersion[0] > 0) return actualVersion[0] === rangeVersion[0];
    if (rangeVersion[1] > 0) return actualVersion[0] === 0 && actualVersion[1] === rangeVersion[1];
    return actualVersion[0] === 0 && actualVersion[1] === 0 && actualVersion[2] === rangeVersion[2];
  }

  function normalizeDependencies(value) {
    if (!Array.isArray(value)) throw managerError('INVALID_ENGINE_DEFINITION', 'Dependencies must be an array');
    return value.map(dependency => {
      const item = typeof dependency === 'string' ? { id: dependency } : dependency;
      if (!item || typeof item !== 'object' || !ID_PATTERN.test(item.id || '')) {
        throw managerError('INVALID_ENGINE_DEFINITION', 'Each dependency requires a valid Engine ID');
      }
      const version = item.version === undefined ? '*' : item.version;
      if (typeof version !== 'string' || !RANGE_PATTERN.test(version)) {
        throw managerError('INVALID_ENGINE_DEFINITION', 'Dependency version must be *, exact SemVer, ^SemVer, or ~SemVer');
      }
      return Object.freeze({ id: item.id, version, optional: item.optional === true });
    });
  }

  function normalizeStringArray(value, field) {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
      throw managerError('INVALID_ENGINE_DEFINITION', field + ' must be an array of non-empty strings');
    }
    return Object.freeze([...new Set(value.map(item => item.trim()))]);
  }

  function safeDetail(value, fallback) {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 240);
    return fallback;
  }

  function snapshot(record) {
    return {
      id: record.id,
      name: record.name,
      version: record.version,
      contractVersion: record.contractVersion,
      description: record.description,
      kind: 'managed-engine',
      dependencies: record.dependencies.map(item => item.id),
      capabilities: [...record.capabilities],
      provides: [...record.provides],
      publishes: [...record.publishes],
      subscribes: [...record.subscribes],
      state: record.state,
      enabled: record.enabled,
      health: { ...record.health },
      registeredAt: record.registeredAt,
      startedAt: record.startedAt,
      lastError: record.lastError ? { ...record.lastError } : null
    };
  }

  function setState(record, state, health) {
    record.state = state;
    if (health) record.health = { ...health };
    core.publish('engine.state_changed', {
      id: record.id,
      state: record.state,
      health: record.health.status
    });
  }

  function findLegacy(id) {
    return core.listEngines().find(item => item.id === id && item.kind !== 'managed-engine') || null;
  }

  function register(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition) ||
        !ID_PATTERN.test(definition.id || '')) {
      throw managerError('INVALID_ENGINE_DEFINITION', 'Engine definition requires a valid stable ID');
    }
    if (core.listEngines().some(item => item.id === definition.id)) {
      throw managerError('DUPLICATE_ENGINE_ID', 'Duplicate Engine ID: ' + definition.id);
    }
    if (typeof definition.name !== 'string' || !definition.name.trim()) {
      throw managerError('INVALID_ENGINE_DEFINITION', 'Engine name is required');
    }
    if (typeof definition.version !== 'string' || !VERSION_PATTERN.test(definition.version)) {
      throw managerError('INVALID_ENGINE_DEFINITION', 'Engine version must use SemVer');
    }
    if (typeof definition.contractVersion !== 'string' || !VERSION_PATTERN.test(definition.contractVersion)) {
      throw managerError('INVALID_ENGINE_DEFINITION', 'Engine contractVersion must use SemVer');
    }
    if (!definition.lifecycle || typeof definition.lifecycle !== 'object' ||
        typeof definition.lifecycle.healthCheck !== 'function') {
      throw managerError('INVALID_ENGINE_DEFINITION', 'Engine lifecycle.healthCheck is required');
    }
    for (const hook of HOOKS) {
      if (definition.lifecycle[hook] !== undefined && typeof definition.lifecycle[hook] !== 'function') {
        throw managerError('INVALID_ENGINE_DEFINITION', 'Lifecycle hook must be a function: ' + hook);
      }
    }

    const record = {
      id: definition.id,
      name: definition.name.trim(),
      version: definition.version,
      contractVersion: definition.contractVersion,
      description: String(definition.description || ''),
      dependencies: normalizeDependencies(definition.dependencies || []),
      capabilities: normalizeStringArray(definition.capabilities || [], 'capabilities'),
      provides: normalizeStringArray(definition.provides || [], 'provides'),
      publishes: normalizeStringArray(definition.publishes || [], 'publishes'),
      subscribes: normalizeStringArray(definition.subscribes || [], 'subscribes'),
      lifecycle: Object.freeze({ ...definition.lifecycle }),
      state: 'registered',
      enabled: true,
      health: { status: 'unknown', detail: 'Registered; not started' },
      registeredAt: new Date().toISOString(),
      startedAt: null,
      lastError: null,
      cleanup: []
    };
    records.set(record.id, record);
    core.publish('engine.registered', { id: record.id, version: record.version });
    return snapshot(record);
  }

  function resolveDependencies(id) {
    if (!records.has(id)) throw managerError('ENGINE_NOT_FOUND', 'Managed Engine not found: ' + id);
    const visiting = [];
    const visited = new Set();
    const order = [];
    const warnings = [];

    function visit(currentId) {
      const record = records.get(currentId);
      if (!record) return;
      if (visiting.includes(currentId)) {
        const cycle = visiting.slice(visiting.indexOf(currentId)).concat(currentId);
        throw managerError('DEPENDENCY_CYCLE', 'Engine dependency cycle detected', { dependencyPath: cycle });
      }
      if (visited.has(currentId)) return;
      if (!record.enabled) throw managerError('ENGINE_DISABLED', 'Required Engine is disabled: ' + currentId);
      visiting.push(currentId);

      for (const dependency of record.dependencies) {
        const managedDependency = records.get(dependency.id);
        const legacyDependency = managedDependency ? null : findLegacy(dependency.id);
        if (!managedDependency && !legacyDependency) {
          if (dependency.optional) {
            warnings.push({ code: 'OPTIONAL_DEPENDENCY_MISSING', engineId: currentId, dependencyId: dependency.id });
            continue;
          }
          throw managerError('MISSING_REQUIRED_DEPENDENCY', 'Missing required dependency: ' + dependency.id, {
            engineId: currentId, dependencyId: dependency.id
          });
        }
        const actualVersion = managedDependency ? managedDependency.version : legacyDependency.version;
        if (!versionMatches(actualVersion, dependency.version)) {
          if (dependency.optional) {
            warnings.push({ code: 'OPTIONAL_DEPENDENCY_VERSION_MISMATCH', engineId: currentId, dependencyId: dependency.id });
            continue;
          }
          throw managerError('VERSION_INCOMPATIBLE', 'Dependency version is incompatible: ' + dependency.id, {
            engineId: currentId, dependencyId: dependency.id, actualVersion, requiredVersion: dependency.version
          });
        }
        if (managedDependency) {
          visit(dependency.id);
        } else if (legacyDependency.state !== 'active' || legacyDependency.health?.status !== 'healthy') {
          if (dependency.optional) {
            warnings.push({ code: 'OPTIONAL_DEPENDENCY_NOT_READY', engineId: currentId, dependencyId: dependency.id });
            continue;
          }
          throw managerError('DEPENDENCY_NOT_READY', 'Required dependency is not ready: ' + dependency.id, {
            engineId: currentId, dependencyId: dependency.id
          });
        }
      }

      visiting.pop();
      visited.add(currentId);
      order.push(currentId);
    }

    visit(id);
    return { order, warnings };
  }

  function validate(id) {
    const record = records.get(id);
    if (!record) throw managerError('ENGINE_NOT_FOUND', 'Managed Engine not found: ' + id);
    const plan = resolveDependencies(id);
    return { valid: true, engineId: id, order: [...plan.order], warnings: plan.warnings.map(item => ({ ...item })) };
  }

  function contextFor(record) {
    return Object.freeze({
      engineId: record.id,
      core,
      getEngine,
      publish: (type, payload) => core.publish(type, payload),
      subscribe: (type, callback) => {
        const unsubscribe = core.subscribe(type, callback);
        record.cleanup.push(unsubscribe);
        return unsubscribe;
      }
    });
  }

  async function invokeHook(record, name, context) {
    const hook = record.lifecycle[name];
    if (typeof hook !== 'function') return undefined;
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => hook(context)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(managerError('LIFECYCLE_TIMEOUT', 'Lifecycle hook timed out: ' + name, {
            engineId: record.id, hook: name, timeoutMs: HOOK_TIMEOUT_MS
          })), HOOK_TIMEOUT_MS);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function cleanup(record) {
    const handlers = record.cleanup.splice(0).reverse();
    handlers.forEach(unsubscribe => {
      try { unsubscribe(); } catch (_) {}
    });
  }

  async function startOne(record) {
    if (record.state === 'active' || record.state === 'degraded') return snapshot(record);
    if (!record.enabled) throw managerError('ENGINE_DISABLED', 'Engine is disabled: ' + record.id);
    const context = contextFor(record);
    let initAttempted = false;
    let startAttempted = false;
    try {
      setState(record, 'validated', { status: 'unknown', detail: 'Dependencies validated' });
      await invokeHook(record, 'validate', context);
      initAttempted = true;
      await invokeHook(record, 'init', context);
      setState(record, 'initialized', { status: 'unknown', detail: 'Initialization complete' });
      setState(record, 'starting', { status: 'unknown', detail: 'Start hook in progress' });
      startAttempted = true;
      await invokeHook(record, 'start', context);
      const report = await invokeHook(record, 'healthCheck', context);
      if (!report || !['healthy', 'degraded'].includes(report.status)) {
        throw managerError('ENGINE_HEALTH_CHECK_FAILED', 'Engine health check did not report healthy or degraded', {
          engineId: record.id
        });
      }
      record.startedAt = new Date().toISOString();
      record.lastError = null;
      setState(record, report.status === 'degraded' ? 'degraded' : 'active', {
        status: report.status,
        detail: safeDetail(report.detail, 'Lifecycle completed')
      });
      return snapshot(record);
    } catch (cause) {
      if (startAttempted && typeof record.lifecycle.stop === 'function') {
        try { await invokeHook(record, 'stop', context); } catch (_) {}
      }
      if (initAttempted && typeof record.lifecycle.destroy === 'function') {
        try { await invokeHook(record, 'destroy', context); } catch (_) {}
      }
      cleanup(record);
      record.lastError = {
        code: cause && cause.code ? String(cause.code) : 'ENGINE_START_FAILED',
        message: safeDetail(cause && cause.message, 'Engine startup failed')
      };
      setState(record, 'failed', { status: 'unhealthy', detail: record.lastError.message });
      core.publish('engine.start_failed', { id: record.id, code: record.lastError.code });
      throw managerError('ENGINE_START_FAILED', 'Engine failed to start: ' + record.id, {
        engineId: record.id, causeCode: record.lastError.code
      });
    }
  }

  async function start(id) {
    const plan = resolveDependencies(id);
    for (let index = 0; index < plan.order.length; index += 1) {
      const currentId = plan.order[index];
      const record = records.get(currentId);
      if (!record) continue;
      try {
        await startOne(record);
      } catch (error) {
        for (const dependentId of plan.order.slice(index + 1)) {
          const dependent = records.get(dependentId);
          if (dependent && dependent.state !== 'active' && dependent.state !== 'degraded') {
            setState(dependent, 'blocked', { status: 'unknown', detail: 'A required dependency failed to start' });
          }
        }
        throw error;
      }
    }
    return snapshot(records.get(id));
  }

  function activeDependents(id) {
    return [...records.values()].filter(record =>
      ['active', 'degraded'].includes(record.state) &&
      record.dependencies.some(dependency => dependency.id === id && !dependency.optional)
    );
  }

  function allDependents(id) {
    return [...records.values()].filter(record =>
      record.dependencies.some(dependency => dependency.id === id && !dependency.optional)
    );
  }

  async function stop(id, options = {}) {
    const record = records.get(id);
    if (!record) throw managerError('ENGINE_NOT_FOUND', 'Managed Engine not found: ' + id);
    const dependents = activeDependents(id);
    if (dependents.length && options.cascade !== true) {
      throw managerError('DEPENDENTS_ACTIVE', 'Cannot stop Engine while required dependents are active', {
        engineId: id, dependentIds: dependents.map(item => item.id)
      });
    }
    if (options.cascade === true) {
      for (const dependent of dependents.sort((a, b) => a.id.localeCompare(b.id)).reverse()) {
        await stop(dependent.id, { cascade: true });
      }
    }
    if (!['active', 'degraded', 'failed', 'initialized', 'starting', 'blocked'].includes(record.state)) {
      return snapshot(record);
    }
    setState(record, 'stopping', { status: 'unknown', detail: 'Stopping' });
    const context = contextFor(record);
    try {
      await invokeHook(record, 'stop', context);
      cleanup(record);
      record.startedAt = null;
      setState(record, 'stopped', { status: 'unknown', detail: 'Stopped' });
      return snapshot(record);
    } catch (cause) {
      cleanup(record);
      record.lastError = {
        code: cause && cause.code ? String(cause.code) : 'ENGINE_STOP_FAILED',
        message: safeDetail(cause && cause.message, 'Engine shutdown failed')
      };
      setState(record, 'failed', { status: 'unhealthy', detail: record.lastError.message });
      core.publish('engine.stop_failed', { id: record.id, code: record.lastError.code });
      throw managerError('ENGINE_STOP_FAILED', 'Engine failed to stop: ' + id, {
        engineId: id, causeCode: record.lastError.code
      });
    }
  }

  async function restart(id) {
    const record = records.get(id);
    if (!record) throw managerError('ENGINE_NOT_FOUND', 'Managed Engine not found: ' + id);
    if (['active', 'degraded'].includes(record.state)) await stop(id);
    record.state = 'registered';
    record.health = { status: 'unknown', detail: 'Ready to restart' };
    return start(id);
  }

  function enable(id) {
    const record = records.get(id);
    if (!record) throw managerError('ENGINE_NOT_FOUND', 'Managed Engine not found: ' + id);
    record.enabled = true;
    if (record.state === 'disabled' || record.state === 'blocked') {
      record.state = 'registered';
      record.health = { status: 'unknown', detail: 'Enabled; not started' };
    }
    core.publish('engine.enabled', { id });
    return snapshot(record);
  }

  async function disable(id, options = {}) {
    const record = records.get(id);
    if (!record) throw managerError('ENGINE_NOT_FOUND', 'Managed Engine not found: ' + id);
    const dependents = activeDependents(id);
    if (dependents.length && options.cascade !== true) {
      throw managerError('DEPENDENTS_ACTIVE', 'Cannot disable Engine while required dependents are active', {
        engineId: id, dependentIds: dependents.map(item => item.id)
      });
    }
    if (['active', 'degraded'].includes(record.state)) await stop(id, options);
    record.enabled = false;
    setState(record, 'disabled', { status: 'unknown', detail: 'Disabled by Module Manager' });
    core.publish('engine.disabled', { id });
    return snapshot(record);
  }

  async function unregister(id, options = {}) {
    const record = records.get(id);
    if (!record) throw managerError('ENGINE_NOT_FOUND', 'Managed Engine not found: ' + id);
    const dependents = allDependents(id);
    if (dependents.length && options.cascade !== true) {
      throw managerError('DEPENDENTS_REGISTERED', 'Cannot unregister Engine while required dependents are registered', {
        engineId: id, dependentIds: dependents.map(item => item.id)
      });
    }
    if (options.cascade === true) {
      for (const dependent of dependents.sort((a, b) => a.id.localeCompare(b.id)).reverse()) {
        await unregister(dependent.id, { cascade: true });
      }
    }
    if (['active', 'degraded', 'failed', 'initialized', 'starting', 'blocked'].includes(record.state)) {
      await stop(id, { cascade: options.cascade === true });
    }
    records.delete(id);
    core.publish('engine.unregistered', { id });
    return { id, removed: true };
  }

  function getEngine(id) {
    const record = records.get(id);
    return record ? snapshot(record) : null;
  }

  function listEngines() {
    return [...records.values()].map(snapshot).sort((a, b) => a.id.localeCompare(b.id));
  }

  function getHealth(id) {
    const record = records.get(id);
    return record ? { ...record.health } : null;
  }

  const api = Object.freeze({
    version: '1.0.0',
    register,
    validate,
    resolveDependencies,
    start,
    stop,
    restart,
    enable,
    disable,
    unregister,
    getEngine,
    listEngines,
    getHealth
  });

  window.TBMC.moduleManager = api;
  ['engine.registered', 'engine.state_changed', 'engine.health_changed', 'engine.enabled',
    'engine.disabled', 'engine.unregistered', 'engine.start_failed', 'engine.stop_failed']
    .forEach(type => core.subscribe(type, () => {
      if (typeof core.refreshManager === 'function') core.refreshManager();
    }));
})();
