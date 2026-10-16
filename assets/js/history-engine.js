(() => {
  'use strict';

  const core = window.TBMC && window.TBMC.engineCore;
  if (!core) throw new Error('History Engine requires Engine Core');

  function parseHash(hash, routes) {
    const allowed = Array.isArray(routes) ? routes : ['home', 'dashboard', 'catalog', 'bot', 'profile'];
    const raw = String(hash || '').replace(/^#/, '');
    if (raw.startsWith('bot/')) {
      let botId = raw.slice(4);
      try { botId = decodeURIComponent(botId); } catch (_) {}
      return ['bot', botId];
    }
    return [allowed.includes(raw) ? raw : 'home', null];
  }

  function parseLocation(routes) {
    return parseHash(window.location.hash, routes);
  }

  function buildHash(route, botId, routes) {
    const allowed = Array.isArray(routes) ? routes : ['home', 'dashboard', 'catalog', 'bot', 'profile'];
    const safeRoute = allowed.includes(route) ? route : 'home';
    return safeRoute === 'bot' && botId
      ? '#bot/' + encodeURIComponent(String(botId))
      : '#' + safeRoute;
  }

  function push(route, botId, routes) {
    const hash = buildHash(route, botId, routes);
    if (window.location.hash !== hash) {
      window.history.pushState({ route, botId: botId || null }, '', hash);
      core.publish('navigation.changed', { route: parseLocation(routes)[0] });
    }
    return hash;
  }

  function snapshot(routes) {
    const parsed = parseLocation(routes);
    return {
      hash: window.location.hash,
      historyLength: window.history.length,
      route: parsed[0],
      botId: parsed[1]
    };
  }

  window.TBMC.historyEngine = Object.freeze({
    version: '1.0.0',
    parseLocation,
    parseHash,
    buildHash,
    push,
    snapshot
  });
})();
