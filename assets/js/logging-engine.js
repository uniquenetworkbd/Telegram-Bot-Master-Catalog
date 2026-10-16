(() => {
  'use strict';
  const core = window.TBMC && window.TBMC.engineCore;
  if (!core) throw new Error('Logging Engine requires Engine Core');
  const entries = [];
  const MAX_ENTRIES = 100;
  let listening = false;
  let unsubscribe = null;

  function record(event) {
    if (!event || typeof event.type !== 'string') return;
    const schema = core.getEventSchema(event.type);
    entries.push({
      type: event.type,
      at: typeof event.at === 'string' ? event.at : new Date().toISOString(),
      publisher: schema ? schema.publisher : 'runtime',
      privacy: schema ? schema.privacy : 'internal'
    });
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  }

  window.TBMC.loggingEngine = Object.freeze({
    version: '1.0.0',
    listRecent: (limit = 25) => entries.slice(-Math.max(0, Math.min(100, Number(limit) || 25))).map(entry => ({ ...entry })),
    clear: () => { entries.length = 0; },
    start: context => {
      if (listening) return;
      if (!context || typeof context.subscribe !== 'function') throw new TypeError('Logging Engine requires a managed subscription context');
      unsubscribe = context.subscribe('*', record);
      listening = true;
    },
    stop: () => {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      listening = false;
    },
    getStatus: () => ({ listening, entryCount: entries.length, capacity: MAX_ENTRIES, persistence: 'memory-only' })
  });
})();