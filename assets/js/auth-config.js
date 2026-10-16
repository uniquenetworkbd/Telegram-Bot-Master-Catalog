(() => {
  'use strict';
  // Set apiBaseUrl to the deployed Worker origin, e.g. https://auth.example.com.
  // Leave blank until a real backend has been deployed. No demo OTP or local-only auth is provided.
  window.TBMC_AUTH_CONFIG = Object.freeze({
    apiBaseUrl: '',
    botUsername: ''
  });
})();
