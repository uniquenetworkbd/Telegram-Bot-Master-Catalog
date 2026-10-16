(() => {
  'use strict';

  const VERSION = '1.0.0';
  const modules = new Map();
  const ID_PATTERN = /^[a-z][a-z0-9.-]{1,63}$/;
  const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
  const COMMAND_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

  function snapshot(record) {
    return Object.freeze({
      id: record.id,
      name: record.name,
      version: record.version,
      description: record.description,
      commands: [...record.commands],
      capabilities: [...record.capabilities],
      implementation: record.implementation,
      status: record.status,
      registeredAt: record.registeredAt
    });
  }

  function registerModule(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new TypeError('Bot module definition must be an object');
    }
    if (!ID_PATTERN.test(definition.id || '')) throw new TypeError('Bot module requires a valid stable ID');
    if (modules.has(definition.id)) throw new Error('Duplicate bot module ID: ' + definition.id);
    if (typeof definition.name !== 'string' || !definition.name.trim()) throw new TypeError('Bot module name is required');
    if (!SEMVER_PATTERN.test(definition.version || '')) throw new TypeError('Bot module version must use SemVer');
    if (typeof definition.description !== 'string' || !definition.description.trim()) throw new TypeError('Bot module description is required');
    if (typeof definition.handler !== 'function') throw new TypeError('Bot module handler is required');
    const commands = definition.commands || [];
    const capabilities = definition.capabilities || [];
    if (!Array.isArray(commands) || commands.some(command => typeof command !== 'string' || !COMMAND_PATTERN.test(command))) {
      throw new TypeError('Bot module commands must be valid lowercase command names');
    }
    if (!Array.isArray(capabilities) || capabilities.some(item => typeof item !== 'string' || !item.trim())) {
      throw new TypeError('Bot module capabilities must be non-empty strings');
    }
    const record = {
      id: definition.id,
      name: definition.name.trim(),
      version: definition.version,
      description: definition.description.trim(),
      commands: Object.freeze([...new Set(commands)]),
      capabilities: Object.freeze([...new Set(capabilities)]),
      implementation: String(definition.implementation || 'browser-contract'),
      status: 'registered',
      handler: definition.handler,
      registeredAt: new Date().toISOString()
    };
    modules.set(record.id, record);
    const core = window.TBMC && window.TBMC.engineCore;
    if (core) {
      try { core.publish('bot.module_registered', { id: record.id, version: record.version }); } catch (_) {}
    }
    return snapshot(record);
  }

  function unregisterModule(id) {
    return modules.delete(id);
  }

  function getModule(id) {
    const record = modules.get(id);
    return record ? snapshot(record) : null;
  }

  function listModules() {
    return [...modules.values()].map(snapshot).sort((a, b) => a.id.localeCompare(b.id));
  }

  async function dispatch(moduleId, update, overrides = {}) {
    const record = modules.get(moduleId);
    if (!record) throw new Error('Unknown bot module: ' + moduleId);
    if (!update || typeof update !== 'object' || Array.isArray(update)) throw new TypeError('Telegram update must be an object');
    const services = {
      catalogRepository: window.TBMC && window.TBMC.catalogRepository,
      searchEngine: window.TBMC && window.TBMC.searchEngine,
      ...(overrides.services || {})
    };
    const result = await record.handler({ update, services });
    if (result !== null && result !== undefined &&
        (typeof result !== 'object' || Array.isArray(result))) {
      throw new TypeError('Bot module handler must return a message object or null');
    }
    return result ? Object.freeze({ ...result }) : null;
  }

  function getStatus() {
    return Object.freeze({
      version: VERSION,
      moduleCount: modules.size,
      runtime: 'browser-module-contract',
      telegramApiConfigured: false,
      tokenAvailableToBrowser: false,
      persistentRuntime: false,
      note: 'The browser registry stores module contracts only. Telegram credentials and API calls belong in a GitHub Actions runner or a future server runtime.'
    });
  }

  window.TBMC = window.TBMC || {};
  window.TBMC.botEngine = Object.freeze({
    version: VERSION,
    registerModule,
    unregisterModule,
    getModule,
    listModules,
    dispatch,
    getStatus
  });
})();