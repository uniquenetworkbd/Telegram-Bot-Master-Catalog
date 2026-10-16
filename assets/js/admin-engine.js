(() => {
  'use strict';
  function getCapabilities() {
    const profile = document.getElementById('page-profile');
    return {
      mode: 'static-project-profile',
      profilePageAvailable: Boolean(profile),
      authenticationConfigured: false,
      serverAuthorizationEnforced: false,
      editableAdminAccounts: false,
      note: 'This static GitHub Pages project exposes project metadata only; it does not implement authenticated administration.'
    };
  }
  window.TBMC.adminEngine = Object.freeze({
    version: '1.0.0',
    getCapabilities
  });
})();