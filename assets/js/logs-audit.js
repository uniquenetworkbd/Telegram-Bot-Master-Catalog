(() => {
  'use strict';
  const API = 'https://api.github.com/repos/uniquenetworkbd/Telegram-Bot-Master-Catalog';
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const dateLabel = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
  };
  const statusClass = run => {
    if (run.status !== 'completed') return 'pending';
    return run.conclusion === 'success' ? 'success' : 'failure';
  };
  const statusLabel = run => run.status === 'completed'
    ? (run.conclusion || 'completed')
    : (run.status || 'unknown').replaceAll('_', ' ');
  let workflows = [];

  async function getJson(path) {
    const response = await fetch(API + path, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    });
    if (!response.ok) {
      const error = new Error('GitHub API returned HTTP ' + response.status);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function renderWorkflows() {
    const filter = $('auditFilter').value;
    const filtered = workflows.filter(run => filter === 'all' || statusClass(run) === filter);
    if (!filtered.length) {
      $('workflowList').innerHTML = '<div class="audit-empty">No workflow runs match this filter.</div>';
      return;
    }
    $('workflowList').innerHTML = filtered.map(run => {
      const label = statusLabel(run);
      return '<article class="audit-item"><h3><a href="' + escapeHtml(run.html_url) +
        '" target="_blank" rel="noopener noreferrer">' + escapeHtml(run.name || run.display_title || 'Workflow run') +
        '</a></h3><p>' + escapeHtml(run.display_title || run.head_commit?.message || 'No run title') +
        '</p><p><span class="audit-status ' + statusClass(run) + '">' + escapeHtml(label) +
        '</span></p><p class="audit-meta">Branch: ' + escapeHtml(run.head_branch || 'unknown') +
        ' · Run #' + escapeHtml(run.run_number ?? '—') + '</p><p class="audit-meta">Started: ' +
        escapeHtml(dateLabel(run.run_started_at || run.created_at)) + '</p></article>';
    }).join('');
  }

  function renderCommits(commits) {
    if (!commits.length) {
      $('commitList').innerHTML = '<div class="audit-empty">No recent commits were returned.</div>';
      return;
    }
    $('commitList').innerHTML = commits.map(item => {
      const message = (item.commit?.message || 'Commit').split('\n')[0];
      return '<article class="audit-item"><h3><a href="' + escapeHtml(item.html_url) +
        '" target="_blank" rel="noopener noreferrer">' + escapeHtml(message) +
        '</a></h3><p class="audit-meta">By ' + escapeHtml(item.commit?.author?.name || item.author?.login || 'Unknown author') +
        '</p><p class="audit-meta">' + escapeHtml(dateLabel(item.commit?.author?.date || item.commit?.committer?.date)) +
        ' · ' + escapeHtml(String(item.sha || '').slice(0, 10)) + '</p></article>';
    }).join('');
  }

  function showError(container, error) {
    const message = error.status === 403 || error.status === 429
      ? 'GitHub API rate limit reached. Please retry later.'
      : 'Could not load GitHub data. Check your connection and retry.';
    $(container).innerHTML = '<div class="audit-empty">' + escapeHtml(message) + '</div>';
  }

  async function refresh() {
    const button = $('auditRefresh');
    button.disabled = true;
    button.textContent = 'Refreshing…';
    $('auditUpdated').textContent = 'Fetching public GitHub records…';
    const [runsResult, commitsResult] = await Promise.allSettled([
      getJson('/actions/runs?per_page=12'),
      getJson('/commits?per_page=10')
    ]);
    if (runsResult.status === 'fulfilled') {
      workflows = Array.isArray(runsResult.value.workflow_runs) ? runsResult.value.workflow_runs : [];
      renderWorkflows();
    } else showError('workflowList', runsResult.reason);
    if (commitsResult.status === 'fulfilled') {
      renderCommits(Array.isArray(commitsResult.value) ? commitsResult.value : []);
    } else showError('commitList', commitsResult.reason);
    const successful = [runsResult, commitsResult].filter(result => result.status === 'fulfilled').length;
    $('auditUpdated').textContent = successful === 2
      ? 'Updated ' + new Date().toLocaleTimeString()
      : successful === 1 ? 'Partially updated · one GitHub source unavailable' : 'Update failed';
    button.disabled = false;
    button.textContent = 'Refresh data';
  }

  $('auditRefresh').addEventListener('click', refresh);
  $('auditFilter').addEventListener('change', renderWorkflows);
  refresh();
})();
