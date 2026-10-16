(() => {
  'use strict';
  function inspectDocument() {
    const findings = [];
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!csp) findings.push({ code: 'CSP_MISSING', severity: 'error' });
    else {
      const policy = csp.getAttribute('content') || '';
      if (!/script-src\\s+[^;]*'self'/.test(policy)) findings.push({ code: 'SCRIPT_POLICY_MISSING', severity: 'error' });
      if (!/object-src\\s+'none'/.test(policy)) findings.push({ code: 'OBJECT_POLICY_MISSING', severity: 'warning' });
    }
    document.querySelectorAll('script[src]').forEach(script => {
      try {
        if (new URL(script.src, location.href).origin !== location.origin) {
          findings.push({ code: 'CROSS_ORIGIN_SCRIPT', severity: 'error' });
        }
      } catch (_) {
        findings.push({ code: 'INVALID_SCRIPT_URL', severity: 'error' });
      }
    });
    document.querySelectorAll('*').forEach(element => {
      [...element.attributes].forEach(attribute => {
        if (/^on/i.test(attribute.name)) findings.push({ code: 'INLINE_EVENT_HANDLER', severity: 'error' });
      });
    });
    return { passed: findings.length === 0, findings, checkedAt: new Date().toISOString() };
  }

  window.TBMC.securityEngine = Object.freeze({
    version: '1.0.0',
    inspectDocument,
    getBoundary: () => ({
      mode: 'static-browser-audit',
      serverAuthorization: false,
      protectsAgainstAllXSS: false,
      note: 'This audit checks selected document-level controls; it is not a complete security guarantee.'
    })
  });
})();