(() => {
  'use strict';
  function snapshot() {
    const core = window.TBMC && window.TBMC.engineCore;
    const manager = window.TBMC && window.TBMC.moduleManager;
    const main = window.TBMC && window.TBMC.mainEngine;
    return {
      runtimeState: main && typeof main.getState === 'function' ? main.getState() : 'unavailable',
      engineCount: manager && typeof manager.listEngines === 'function' ? manager.listEngines().length : 0,
      eventSchemaCount: core && typeof core.listEventSchemas === 'function' ? core.listEventSchemas().length : 0,
      localDiagnosticsEnabled: Boolean(core && typeof core.diagnosticsEnabled === 'function' && core.diagnosticsEnabled()),
      diagnosticsStorage: 'session-only when explicitly enabled',
      systemPages: [
        './pages/system-configuration.html',
        './pages/logs-audit.html',
        './pages/version-logs.html',
        './pages/live-information.html'
      ]
    };
  }
  window.TBMC.systemEngine = Object.freeze({
    version: '1.0.0',
    snapshot
  });
})();