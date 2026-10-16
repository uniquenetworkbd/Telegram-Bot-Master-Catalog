(() => {
  'use strict';

  const box = document.getElementById('engines');
  const summary = document.getElementById('runtime-summary');
  const notice = document.getElementById('operation-result');
  const core = window.TBMC && window.TBMC.engineCore;
  const manager = window.TBMC && window.TBMC.moduleManager;
  const main = window.TBMC && window.TBMC.mainEngine;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function activeDependents(id) {
    return manager.listEngines().filter(engine =>
      engine.id !== id &&
      engine.dependencies.includes(id) &&
      ['active', 'degraded', 'starting', 'initialized'].includes(engine.state)
    );
  }

  function button(id, action, label, disabled, title) {
    return '<button type="button" class="button" data-engine-action="' + esc(action) +
      '" data-engine-id="' + esc(id) + '"' + (disabled ? ' disabled' : '') +
      (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(label) + '</button>';
  }

  function renderEngine(engine) {
    const managed = engine.kind === 'managed-engine';
    const state = engine.state || 'unknown';
    const health = engine.health && engine.health.status || 'unknown';
    const dependents = managed ? activeDependents(engine.id) : [];
    const blocked = dependents.length > 0;
    let controls = '<span class="sub">Core registry entry · observation only</span>';
    if (managed) {
      const actions = [];
      if (state === 'active' || state === 'degraded') {
        actions.push(button(engine.id, 'stop', 'Stop', blocked, blocked ? 'Stop active dependents first: ' + dependents.map(item => item.id).join(', ') : 'Stops this Engine in this browser session'));
        actions.push(button(engine.id, 'restart', 'Restart', blocked, blocked ? 'Restart is blocked by active dependents: ' + dependents.map(item => item.id).join(', ') : 'Restarts this Engine in this browser session'));
        actions.push(button(engine.id, 'disable', 'Disable', blocked, blocked ? 'Disable is blocked by active dependents: ' + dependents.map(item => item.id).join(', ') : 'Disables this Engine in this browser session'));
      } else if (engine.enabled === false || state === 'disabled') {
        actions.push(button(engine.id, 'enable', 'Enable', false, 'Enables this Engine in this browser session'));
        actions.push(button(engine.id, 'start', 'Start', false, 'Starts this Engine in this browser session'));
      } else {
        actions.push(button(engine.id, 'start', 'Start', false, 'Starts this Engine in this browser session'));
        actions.push(button(engine.id, 'enable', 'Enable', false, 'Enables this Engine in this browser session'));
      }
      controls = '<div class="actions engine-actions">' + actions.join('') + '</div>';
    }
    return '<article class="card engine"><div class="runtime-headline"><div><strong>' + esc(engine.name) +
      '</strong><p>' + esc(engine.id) + ' · v' + esc(engine.version) + '</p></div><span class="tag ' +
      (health === 'healthy' ? 'green' : 'amber') + '">' + esc(health) + '</span></div>' +
      '<p>' + esc(engine.description) + '</p><div class="sub">State: <strong>' + esc(state) +
      '</strong> · ' + (engine.enabled === false ? 'Disabled' : 'Enabled') + '</div><div class="sub">Dependencies: ' +
      esc((engine.dependencies || []).join(', ') || 'None') + '</div><div class="sub">Capabilities: ' +
      esc((engine.capabilities || []).join(' · ') || '—') + '</div>' + controls + '</article>';
  }

  function render() {
    if (!box) return;
    if (!core || !manager || !main) {
      box.innerHTML = '<div class="card"><strong>Runtime unavailable</strong><p class="sub">Required runtime scripts did not initialize. No lifecycle operation is available.</p></div>';
      if (summary) summary.textContent = 'Runtime unavailable';
      return;
    }
    const all = core.listEngines();
    const managed = manager.listEngines();
    const state = main.getState();
    const active = managed.filter(engine => ['active', 'degraded'].includes(engine.state)).length;
    const unhealthy = managed.filter(engine => !engine.health || engine.health.status !== 'healthy').length;
    if (summary) summary.textContent = 'Main Engine: ' + state + ' · Managed Engines: ' + managed.length +
      ' · Active/degraded: ' + active + ' · Health checks needing review: ' + unhealthy +
      ' · All controls affect this browser session only.';
    const runtimeTag = document.getElementById('runtime-status');
    if (runtimeTag) {
      runtimeTag.textContent = state;
      runtimeTag.className = 'tag ' + (state === 'ready' ? 'green' : 'amber');
    }
    const botStatus = window.TBMC.botEngine && window.TBMC.botEngine.getStatus();
    const botModules = window.TBMC.botEngine && window.TBMC.botEngine.listModules();
    const botCard = document.getElementById('bot-module-summary');
    if (botCard) botCard.textContent = botStatus
      ? botStatus.moduleCount + ' module(s) registered · Telegram API configured: no · browser token: never available'
      : 'Bot Engine registry unavailable';
    box.innerHTML = '<div class="grid stats">' +
      '<div class="card"><div class="statlabel">Runtime registry</div><strong class="statvalue">' + all.length + '</strong><div class="statfoot">Core + managed entries</div></div>' +
      '<div class="card"><div class="statlabel">Managed Engines</div><strong class="statvalue">' + managed.length + '</strong><div class="statfoot">Module Manager registry</div></div>' +
      '<div class="card"><div class="statlabel">Active / degraded</div><strong class="statvalue">' + active + '</strong><div class="statfoot">Current browser runtime</div></div>' +
      '<div class="card"><div class="statlabel">Review required</div><strong class="statvalue">' + unhealthy + '</strong><div class="statfoot">Health is not the same as security authorization</div></div>' +
      '</div><h2>Managed Engines</h2><div class="grid split">' + managed.map(renderEngine).join('') +
      '</div><h2 style="margin-top:22px">Core Registry Entries</h2><div class="grid split">' +
      all.filter(engine => engine.kind !== 'managed-engine').map(renderEngine).join('') +
      '</div><h2 style="margin-top:22px">Registered Bot Modules</h2><div class="grid split">' +
      ((botModules || []).map(module => '<article class="card engine"><div class="runtime-headline"><div><strong>' + esc(module.name) +
      '</strong><p>' + esc(module.id) + ' · v' + esc(module.version) + '</p></div><span class="tag green">' + esc(module.status) +
      '</span></div><p>' + esc(module.description) + '</p><div class="sub">Commands: ' + esc(module.commands.join(', ') || 'None') +
      '</div><div class="sub">Capabilities: ' + esc(module.capabilities.join(' · ') || '—') + '</div></article>').join('') ||
      '<div class="card">No Bot modules registered.</div>') + '</div>';
  }

  async function operate(id, action) {
    const engine = manager && manager.getEngine(id);
    if (!engine) return;
    const blocked = activeDependents(id);
    if (['stop', 'restart', 'disable'].includes(action) && blocked.length) {
      if (notice) notice.textContent = 'Operation blocked. Stop active dependents first: ' + blocked.map(item => item.id).join(', ');
      return;
    }
    const warning = action === 'stop' || action === 'restart' || action === 'disable';
    if (warning && !window.confirm(action.toUpperCase() + ' ' + id + ' in this browser session? This does not change GitHub or any other visitor session.')) return;
    if (notice) notice.textContent = 'Running ' + action + ' for ' + id + '…';
    try {
      await manager[action](id);
      if (notice) notice.textContent = action + ' completed for ' + id + ' in this browser session.';
    } catch (error) {
      if (notice) notice.textContent = action + ' failed for ' + id + ': ' + String(error && error.message || 'Unknown lifecycle error').slice(0, 220);
    }
    render();
  }

  if (box) {
    box.addEventListener('click', event => {
      const control = event.target.closest('[data-engine-action]');
      if (!control || control.disabled) return;
      operate(control.dataset.engineId, control.dataset.engineAction);
    });
  }
  if (core) {
    ['engine.registered', 'engine.state_changed', 'engine.health_changed', 'engine.enabled',
      'engine.disabled', 'engine.unregistered', 'engine.start_failed', 'engine.stop_failed',
      'runtime.starting', 'runtime.ready', 'runtime.failed', 'runtime.shutdown_complete']
      .forEach(type => core.subscribe(type, render));
  }
  document.addEventListener('DOMContentLoaded', render);
  render();
})();