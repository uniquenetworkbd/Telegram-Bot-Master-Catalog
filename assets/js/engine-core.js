(() => {
  'use strict';

  const VERSION = '1.0.0';
  const listeners = new Map();
  const engines = new Map();
  const eventSchemas = new Map();
  const sessionEventsKey = 'tbmc-local-activity-v1';
  const consentKey = 'tbmc-local-diagnostics-enabled';
  const now = () => new Date().toISOString();
  const eventTypePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9_]+)*$/;
  const eventPrivacyClasses = new Set(['public', 'internal', 'usage', 'security', 'configuration']);

  function publicEventSchema(schema) {
    return Object.freeze({
      type: schema.type,
      version: schema.version,
      publisher: schema.publisher,
      privacy: schema.privacy,
      consumers: [...schema.consumers]
    });
  }

  function registerEventSchema(type, definition) {
    if (typeof type !== 'string' || !eventTypePattern.test(type)) {
      throw new TypeError('Event schema requires a valid event type');
    }
    if (eventSchemas.has(type)) throw new Error('Duplicate event schema: ' + type);
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new TypeError('Event schema definition must be an object');
    }
    const version = definition.version === undefined ? 1 : definition.version;
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new TypeError('Event schema version must be a positive integer');
    }
    if (typeof definition.publisher !== 'string' || !definition.publisher.trim()) {
      throw new TypeError('Event schema publisher is required');
    }
    if (!eventPrivacyClasses.has(definition.privacy)) {
      throw new TypeError('Event schema privacy must be public, internal, usage, security, or configuration');
    }
    if (!Array.isArray(definition.consumers) ||
        definition.consumers.some(consumer => typeof consumer !== 'string' || !consumer.trim())) {
      throw new TypeError('Event schema consumers must be an array of non-empty strings');
    }
    if (typeof definition.validate !== 'function') {
      throw new TypeError('Event schema validate must be a function');
    }
    const schema = Object.freeze({
      type,
      version,
      publisher: definition.publisher.trim(),
      privacy: definition.privacy,
      consumers: Object.freeze([...new Set(definition.consumers.map(consumer => consumer.trim()))]),
      validate: definition.validate
    });
    eventSchemas.set(type, schema);
    return publicEventSchema(schema);
  }

  function validateEvent(type, payload) {
    const schema = eventSchemas.get(type);
    if (!schema) return { valid: true, schemaRegistered: false, errors: [] };
    try {
      const result = schema.validate(payload);
      if (result === true) return { valid: true, schemaRegistered: true, version: schema.version, errors: [] };
      return {
        valid: false,
        schemaRegistered: true,
        version: schema.version,
        errors: [result === false ? 'INVALID_PAYLOAD' : 'VALIDATOR_MUST_RETURN_BOOLEAN']
      };
    } catch (_) {
      return { valid: false, schemaRegistered: true, version: schema.version, errors: ['VALIDATOR_FAILED'] };
    }
  }

  function getEventSchema(type) {
    const schema = eventSchemas.get(type);
    return schema ? publicEventSchema(schema) : null;
  }

  function listEventSchemas() {
    return [...eventSchemas.values()]
      .map(publicEventSchema)
      .sort((a, b) => a.type.localeCompare(b.type));
  }
  const safeRead = (store, key, fallback) => {
    try { const value = store.getItem(key); return value === null ? fallback : value; }
    catch (_) { return fallback; }
  };
  const safeWrite = (store, key, value) => {
    try { store.setItem(key, value); return true; } catch (_) { return false; }
  };

  function publish(type, payload = {}) {
    const validation = validateEvent(type, payload);
    if (!validation.valid) {
      throw new TypeError('Invalid payload for event "' + type + '": ' + validation.errors.join(', '));
    }
    const event = Object.freeze({ type, at: now(), payload });
    (listeners.get(type) || []).slice().forEach(fn => {
      try { fn(event); } catch (error) { console.error('[TBMC event listener]', error); }
    });
    (listeners.get('*') || []).slice().forEach(fn => {
      try { fn(event); } catch (error) { console.error('[TBMC event listener]', error); }
    });
    return event;
  }

  function subscribe(type, callback) {
    if (typeof callback !== 'function') throw new TypeError('Event subscriber must be a function');
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(callback);
    return () => {
      const list = listeners.get(type) || [];
      const index = list.indexOf(callback);
      if (index >= 0) list.splice(index, 1);
    };
  }

  function register(definition) {
    if (!definition || !/^[a-z][a-z0-9.-]{1,63}$/.test(definition.id || '')) {
      throw new TypeError('Engine definition requires a valid stable id');
    }
    if (engines.has(definition.id)) throw new Error('Duplicate engine id: ' + definition.id);
    const record = Object.freeze({
      id: definition.id,
      name: String(definition.name || definition.id),
      version: String(definition.version || VERSION),
      description: String(definition.description || ''),
      kind: String(definition.kind || 'engine'),
      dependencies: Object.freeze([...(definition.dependencies || [])]),
      capabilities: Object.freeze([...(definition.capabilities || [])]),
      state: 'active',
      health: typeof definition.health === 'function' ? definition.health : () => ({ status: 'healthy', detail: 'Registered in browser runtime' }),
      registeredAt: now()
    });
    engines.set(record.id, record);
    publish('engine.registered', { id: record.id, version: record.version });
    return record;
  }

  function listEngines() {
    return [...engines.values()].map(engine => {
      let health;
      try { health = engine.health(); } catch (_) { health = { status: 'error', detail: 'Health check threw an exception' }; }
      return {
        id: engine.id, name: engine.name, version: engine.version,
        description: engine.description, kind: engine.kind,
        dependencies: [...engine.dependencies], capabilities: [...engine.capabilities],
        state: engine.state, health: health || { status: 'unknown', detail: 'No health result' }
      };
    });
  }

  function diagnosticsEnabled() {
    return safeRead(localStorage, consentKey, 'false') === 'true';
  }

  function readEvents() {
    try {
      const parsed = JSON.parse(safeRead(sessionStorage, sessionEventsKey, '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function recordLocal(type, route) {
    if (!diagnosticsEnabled()) return;
    const allowed = new Set(['page_view', 'catalog_search_used', 'bot_details_opened']);
    if (!allowed.has(type)) return;
    const events = readEvents();
    events.push({ type, at: now(), route: ['home','dashboard','catalog','bot','profile','system'].includes(route) ? route : 'other' });
    safeWrite(sessionStorage, sessionEventsKey, JSON.stringify(events.slice(-100)));
    publish('activity.recorded', { type, route });
    renderManager();
  }

  function currentRoute() {
    const raw = location.hash.replace(/^#/, '');
    const route = raw.startsWith('bot/') ? 'bot' : raw;
    return ['home','dashboard','catalog','bot','profile','system'].includes(route) ? route : 'home';
  }

  function ensureManager() {
    const system = document.getElementById('page-system');
    if (!system || document.getElementById('tbmc-engine-manager')) return;
    const manager = document.createElement('section');
    manager.id = 'tbmc-engine-manager';
    manager.className = 'card';
    manager.style.margin = '0 0 15px';
    manager.innerHTML = `
      <div class="runtime-headline">
        <div><strong>Main Engine & Engine Registry</strong><p>Browser runtime registry · Version ${VERSION}</p></div>
        <span class="tag green" id="tbmc-engine-health">Checking</span>
      </div>
      <p class="sub">Engines below are runtime registrations, not separate servers. Browser-only activity stays on this device and is never sent to a central server.</p>
      <div class="profilemeta" id="tbmc-engine-list" aria-live="polite"></div>
      <div class="notice" style="margin-top:12px">
        <strong>Optional local diagnostics</strong>
        <p>Off by default. If enabled, this browser session stores only coarse page-view and interaction counts in session storage. Search terms, bot IDs, IP addresses, names, contact details and full referrer URLs are not recorded. This is not central visitor analytics.</p>
        <label style="display:flex;align-items:center;gap:9px;margin-top:10px">
          <input type="checkbox" id="tbmc-diagnostics-toggle">
          <span>Enable anonymous local diagnostics on this device</span>
        </label>
        <div class="sub" id="tbmc-activity-summary" style="margin-top:8px">Local diagnostics are off.</div>
        <button type="button" class="button" id="tbmc-clear-activity" style="margin-top:10px">Clear local activity</button>
      </div>`;
    const split = system.querySelector('.grid.split');
    system.insertBefore(manager, split || null);
    const toggle = document.getElementById('tbmc-diagnostics-toggle');
    toggle.checked = diagnosticsEnabled();
    toggle.addEventListener('change', () => {
      safeWrite(localStorage, consentKey, String(toggle.checked));
      if (!toggle.checked) {
        try { sessionStorage.removeItem(sessionEventsKey); } catch (_) {}
      } else {
        recordLocal('page_view', currentRoute());
      }
      publish('diagnostics.preference_changed', { enabled: toggle.checked });
      renderManager();
    });
    document.getElementById('tbmc-clear-activity').addEventListener('click', () => {
      try { sessionStorage.removeItem(sessionEventsKey); } catch (_) {}
      renderManager();
      publish('activity.cleared');
    });
    renderManager();
  }

  function renderManager() {
    const list = document.getElementById('tbmc-engine-list');
    if (!list) return;
    const entries = listEngines();
    const unhealthy = entries.filter(item => item.health.status !== 'healthy').length;
    const health = document.getElementById('tbmc-engine-health');
    health.textContent = unhealthy ? 'Review required' : 'Healthy';
    health.className = 'tag ' + (unhealthy ? 'amber' : 'green');
    list.innerHTML = entries.map(item => {
      const deps = item.dependencies.length ? item.dependencies.join(', ') : 'None';
      const capabilities = item.capabilities.length ? item.capabilities.join(' · ') : '—';
      const status = item.health.status === 'healthy' ? 'green' : 'amber';
      return '<div class="metarow" style="align-items:flex-start;gap:12px"><div style="min-width:0;flex:1"><strong>' +
        escapeHTML(item.name) + '</strong><div class="sub">' + escapeHTML(item.id) + ' · v' + escapeHTML(item.version) +
        '</div><div class="sub">' + escapeHTML(item.description) + '</div><div class="sub">Dependencies: ' +
        escapeHTML(deps) + '</div><div class="sub">Capabilities: ' + escapeHTML(capabilities) +
        '</div></div><span class="tag ' + status + '">' + escapeHTML(item.health.status) + '</span></div>';
    }).join('');
    const summary = document.getElementById('tbmc-activity-summary');
    const events = readEvents();
    if (summary) summary.textContent = diagnosticsEnabled()
      ? events.length + ' local event(s) in this browser tab session. Nothing has been uploaded.'
      : 'Local diagnostics are off. No activity events are being recorded.';
    const toggle = document.getElementById('tbmc-diagnostics-toggle');
    if (toggle) toggle.checked = diagnosticsEnabled();
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  register({
    id: 'main-engine',
    name: 'Main Engine',
    version: VERSION,
    kind: 'core',
    description: 'Coordinates the browser runtime registry and event bus.',
    capabilities: ['engine registry', 'event bus', 'health summary'],
    health: () => ({ status: 'healthy', detail: 'Core registry and event bus available' })
  });
  register({
    id: 'engine-registry',
    name: 'Engine Registry',
    version: VERSION,
    kind: 'core-service',
    dependencies: ['main-engine'],
    description: 'Registers engine metadata, dependencies and health checks.',
    capabilities: ['registration', 'metadata', 'health checks'],
    health: () => ({ status: 'healthy', detail: engines.size + ' engine registrations' })
  });
  register({
    id: 'catalog-data',
    name: 'Catalog Data Engine',
    version: VERSION,
    kind: 'engine',
    dependencies: ['engine-registry'],
    description: 'Existing CSV repository integration.',
    capabilities: ['CSV dataset', 'data validation'],
    health: () => ({
      status: window.TBMC && window.TBMC.catalogRepository ? 'healthy' : 'error',
      detail: 'Catalog repository ' + (window.TBMC && window.TBMC.catalogRepository ? 'is available' : 'is not loaded')
    })
  });
  register({
    id: 'catalog-ui',
    name: 'Catalog Experience Engine',
    version: VERSION,
    kind: 'engine',
    dependencies: ['catalog-data', 'main-engine'],
    description: 'Existing catalog search, filtering, sorting and detail routes.',
    capabilities: ['search', 'filters', 'pagination', 'details'],
    health: () => ({
      status: window.TBMC && window.TBMC.catalog ? 'healthy' : 'starting',
      detail: 'Catalog feature ' + (window.TBMC && window.TBMC.catalog ? 'is available' : 'initializing')
    })
  });
  register({
    id: 'local-activity',
    name: 'Local Activity Engine',
    version: VERSION,
    kind: 'optional-engine',
    dependencies: ['main-engine'],
    description: 'Consent-gated, session-only coarse activity counters; no network upload.',
    capabilities: ['local page-view count', 'local interaction count', 'clear session history'],
    health: () => ({ status: 'healthy', detail: diagnosticsEnabled() ? 'Enabled by local preference' : 'Disabled by default' })
  });

  window.TBMC = window.TBMC || {};
  window.TBMC.engineCore = Object.freeze({
    version: VERSION,
    publish,
    subscribe,
    registerEventSchema,
    validateEvent,
    getEventSchema,
    listEventSchemas,
    register,
    listEngines,
    diagnosticsEnabled,
    clearLocalActivity: () => { try { sessionStorage.removeItem(sessionEventsKey); } catch (_) {} }
  });

  document.addEventListener('DOMContentLoaded', ensureManager, { once: true });
  if (document.readyState !== 'loading') ensureManager();
  let lastRoute = currentRoute();
  recordLocal('page_view', lastRoute);
  window.addEventListener('hashchange', () => {
    const route = currentRoute();
    if (route !== lastRoute || route === 'bot') recordLocal('page_view', route);
    lastRoute = route;
    publish('navigation.changed', { route });
    if (route === 'system') renderManager();
  });
  document.addEventListener('input', event => {
    if (event.target && event.target.id === 'search') {
      publish('catalog.search_used', { hasQuery: Boolean(event.target.value.trim()) });
      recordLocal('catalog_search_used', 'catalog');
    }
  });
  document.addEventListener('click', event => {
    const botLink = event.target.closest('[data-bot]');
    if (botLink) recordLocal('bot_details_opened', 'bot');
  });
})();