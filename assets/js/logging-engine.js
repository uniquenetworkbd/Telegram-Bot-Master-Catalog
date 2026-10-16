(() => {
  'use strict';

  const core = window.TBMC && window.TBMC.engineCore;
  if (!core) throw new Error('Logging Engine requires Engine Core');

  const SESSION_KEY = 'tbmc-local-activity-v1';
  const CONSENT_KEY = 'tbmc-local-diagnostics-enabled';
  const ALLOWED_TYPES = new Set(['page_view', 'catalog_search_used', 'bot_details_opened']);
  const ALLOWED_ROUTES = new Set(['home', 'dashboard', 'catalog', 'bot', 'profile', 'system']);

  function safeRead(storage, key, fallback) {
    try {
      const value = storage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function safeWrite(storage, key, value) {
    try { storage.setItem(key, value); return true; } catch (_) { return false; }
  }

  function isEnabled() {
    return safeRead(window.localStorage, CONSENT_KEY, 'false') === 'true';
  }

  function readEvents() {
    try {
      const parsed = JSON.parse(safeRead(window.sessionStorage, SESSION_KEY, '[]'));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(event =>
        event && typeof event === 'object' && ALLOWED_TYPES.has(event.type) &&
        typeof event.at === 'string' && typeof event.route === 'string'
      ).slice(-100);
    } catch (_) {
      return [];
    }
  }

  function currentRoute() {
    if (window.TBMC.historyEngine) return window.TBMC.historyEngine.parseLocation(
      ['home', 'dashboard', 'catalog', 'bot', 'profile', 'system']
    )[0];
    const raw = window.location.hash.replace(/^#/, '');
    const route = raw.startsWith('bot/') ? 'bot' : raw;
    return ALLOWED_ROUTES.has(route) ? route : 'home';
  }

  function recordLocal(type, route) {
    if (!isEnabled() || !ALLOWED_TYPES.has(type)) return false;
    const events = readEvents();
    const safeRoute = ALLOWED_ROUTES.has(route) ? route : 'other';
    events.push({ type, at: new Date().toISOString(), route: safeRoute });
    safeWrite(window.sessionStorage, SESSION_KEY, JSON.stringify(events.slice(-100)));
    core.publish('activity.recorded', { type, route: safeRoute });
    if (typeof core.refreshManager === 'function') core.refreshManager();
    return true;
  }

  function setEnabled(enabled) {
    const value = Boolean(enabled);
    safeWrite(window.localStorage, CONSENT_KEY, String(value));
    if (!value) {
      try { window.sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    } else {
      recordLocal('page_view', currentRoute());
    }
    core.publish('diagnostics.preference_changed', { enabled: value });
    if (typeof core.refreshManager === 'function') core.refreshManager();
    return value;
  }

  function clearEvents() {
    try { window.sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    core.publish('activity.cleared');
    if (typeof core.refreshManager === 'function') core.refreshManager();
    return true;
  }

  function snapshot() {
    const events = readEvents();
    return {
      enabled: isEnabled(),
      count: events.length,
      events: events.map(event => ({ type: event.type, at: event.at, route: event.route }))
    };
  }

  const api = Object.freeze({
    version: '1.0.0',
    isEnabled,
    readEvents,
    recordLocal,
    setEnabled,
    clearEvents,
    snapshot
  });

  window.TBMC.loggingEngine = api;
  recordLocal('page_view', currentRoute());
})();
