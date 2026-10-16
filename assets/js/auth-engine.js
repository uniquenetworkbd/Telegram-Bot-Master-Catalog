(() => {
  'use strict';

  const config = window.TBMC_AUTH_CONFIG || {};
  const apiBase = String(config.apiBaseUrl || '').replace(/\/$/, '');
  const statusNode = document.querySelector('[data-auth-status]');
  const formStart = document.querySelector('[data-auth-start-form]');
  const formVerify = document.querySelector('[data-auth-verify-form]');
  const startButton = document.querySelector('[data-auth-start]');
  const verifyButton = document.querySelector('[data-auth-verify]');
  const logoutButton = document.querySelector('[data-auth-logout]');
  const challengeStoreKey = 'tbmc.auth.challenge.v1';
  let currentChallenge = null;

  function setStatus(message, kind = 'info') {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.dataset.kind = kind;
    statusNode.hidden = false;
  }
  function setBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = label || 'Please wait…';
    } else if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }
  function endpoint(path) { return (apiBase || '') + path; }
  async function request(path, options = {}) {
    if (!apiBase) {
      const error = new Error('AUTH_BACKEND_NOT_CONFIGURED');
      error.code = error.message;
      throw error;
    }
    let response;
    try {
      response = await fetch(endpoint(path), {
        method: options.method || 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (_) {
      const error = new Error('AUTH_SERVICE_UNREACHABLE');
      error.code = error.message;
      throw error;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || 'AUTH_REQUEST_FAILED');
      error.code = data.error || 'AUTH_REQUEST_FAILED';
      error.status = response.status;
      error.details = data;
      throw error;
    }
    return data;
  }
  function humanError(error) {
    const messages = {
      AUTH_BACKEND_NOT_CONFIGURED: 'Authentication is not live yet: the secure OTP backend URL has not been configured.',
      AUTH_SERVICE_NOT_CONFIGURED: 'The secure authentication backend is missing required configuration. Contact the project administrator.',
      AUTH_SERVICE_UNREACHABLE: 'Could not reach the authentication service. Check the connection or try again later.',
      INVALID_TELEGRAM_USERNAME: 'Enter a valid Telegram username (5–32 letters, numbers or underscores).',
      DISPLAY_NAME_REQUIRED: 'Enter a display name with at least two characters.',
      TOO_MANY_REQUESTS: 'Too many requests. Wait a few minutes before trying again.',
      INVALID_CODE: 'That OTP is not correct. Check the latest code sent by the OTP bot.',
      CHALLENGE_EXPIRED: 'This verification request expired. Start again to get a new code.',
      TOO_MANY_ATTEMPTS: 'Too many incorrect codes. Start a new verification request.',
      UNAUTHORIZED: 'This request could not be authorized. Start again from the website.'
    };
    return messages[error.code] || (error.message && !/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'Authentication failed. Please try again.');
  }
  function storeChallenge(challenge) {
    currentChallenge = challenge;
    try { sessionStorage.setItem(challengeStoreKey, JSON.stringify(challenge)); } catch (_) {}
  }
  function restoreChallenge() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(challengeStoreKey) || 'null');
      if (saved && saved.challengeId && saved.expiresAt > Date.now()) currentChallenge = saved;
      else sessionStorage.removeItem(challengeStoreKey);
    } catch (_) { currentChallenge = null; }
    return currentChallenge;
  }
  function clearChallenge() {
    currentChallenge = null;
    try { sessionStorage.removeItem(challengeStoreKey); } catch (_) {}
  }
  function showVerification(challenge) {
    const verifyPanel = document.querySelector('[data-auth-verify-panel]');
    if (verifyPanel) verifyPanel.hidden = false;
    const startPanel = document.querySelector('[data-auth-start-panel]');
    if (startPanel) startPanel.hidden = true;
    const link = document.querySelector('[data-auth-bot-link]');
    if (link) {
      link.href = challenge.botStartUrl;
      link.hidden = false;
    }
    const target = document.querySelector('[data-auth-target]');
    if (target) target.textContent = '@' + challenge.telegramUsername;
    setStatus('Step 1: open the OTP bot and press Start. Step 2: enter the six-digit code it sends you.', 'success');
  }
  async function startChallenge(event) {
    event.preventDefault();
    if (!formStart) return;
    const action = formStart.dataset.action;
    const formData = new FormData(formStart);
    const telegramUsername = String(formData.get('telegramUsername') || '').trim().replace(/^@/, '');
    const displayName = String(formData.get('displayName') || '').trim();
    setBusy(startButton, true, 'Preparing verification…');
    try {
      const challenge = await request('/api/auth/start', {
        method: 'POST',
        body: { action, telegramUsername, ...(action === 'register' ? { displayName } : {}) }
      });
      challenge.telegramUsername = telegramUsername;
      challenge.expiresAt = Date.now() + Number(challenge.expiresInSeconds || 600) * 1000;
      storeChallenge(challenge);
      showVerification(challenge);
    } catch (error) {
      setStatus(humanError(error), 'error');
    } finally { setBusy(startButton, false); }
  }
  async function verifyChallenge(event) {
    event.preventDefault();
    const challenge = currentChallenge || restoreChallenge();
    if (!challenge) {
      setStatus('No active verification request. Start again to request a new OTP.', 'error');
      return;
    }
    const input = formVerify && formVerify.querySelector('[name="otp"]');
    const otp = String(input && input.value || '').trim();
    setBusy(verifyButton, true, 'Verifying OTP…');
    try {
      const result = await request('/api/auth/verify', {
        method: 'POST',
        body: { challengeId: challenge.challengeId, otp }
      });
      clearChallenge();
      setStatus('OTP verified. Your secure session is active.', 'success');
      const destination = new URLSearchParams(window.location.search).get('next');
      const safeDestination = destination && destination.startsWith('./') && !destination.startsWith('//') ? destination : './index.html';
      window.location.assign(safeDestination);
      return result;
    } catch (error) {
      setStatus(humanError(error), 'error');
      if (['CHALLENGE_EXPIRED', 'TOO_MANY_ATTEMPTS'].includes(error.code)) clearChallenge();
    } finally { setBusy(verifyButton, false); }
  }
  async function logout() {
    if (logoutButton) setBusy(logoutButton, true, 'Signing out…');
    try {
      if (!apiBase) throw Object.assign(new Error('AUTH_BACKEND_NOT_CONFIGURED'), { code: 'AUTH_BACKEND_NOT_CONFIGURED' });
      await request('/api/auth/logout', { method: 'POST', body: {} });
      setStatus('Signed out. This browser session has been cleared by the authentication service.', 'success');
      window.location.assign('./login.html');
    } catch (error) {
      setStatus(humanError(error), 'error');
      if (logoutButton) setBusy(logoutButton, false);
    }
  }
  async function loadSession() {
    const node = document.querySelector('[data-auth-user]');
    if (!node) return;
    try {
      const result = await request('/api/auth/me');
      if (!result.authenticated) throw new Error('NOT_AUTHENTICATED');
      const user = result.user || {};
      node.textContent = (user.displayName || 'User') + ' (@' + (user.telegramUsername || '') + ')';
      const role = document.querySelector('[data-auth-role]');
      if (role) role.textContent = user.role || 'user';
      setStatus('You are signed in. Your server-managed session is active.', 'success');
    } catch (_) {
      setStatus('No valid login session was found. Please verify your Telegram account.', 'error');
      window.setTimeout(() => window.location.assign('./login.html'), 1200);
    }
  }
  function init() {
    if (!apiBase) setStatus('Backend not configured. OTP verification is deliberately disabled until a real authentication API is deployed.', 'error');
    if (formStart) formStart.addEventListener('submit', startChallenge);
    if (formVerify) formVerify.addEventListener('submit', verifyChallenge);
    if (logoutButton) logoutButton.addEventListener('click', logout);
    if (formVerify) {
      const challenge = restoreChallenge();
      if (challenge) showVerification(challenge);
    }
    if (document.querySelector('[data-auth-user]')) loadSession();
  }
  document.addEventListener('DOMContentLoaded', init);
  window.TBMCAuthEngine = Object.freeze({
    version: '1.0.0',
    status: () => ({ configured: Boolean(apiBase), challengeActive: Boolean(currentChallenge) }),
    getSession: () => request('/api/auth/me'),
    health: () => request('/api/auth/health'),
    logout
  });
})();
