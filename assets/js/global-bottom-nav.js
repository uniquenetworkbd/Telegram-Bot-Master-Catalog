(() => {
  if (document.getElementById('tbmcUnifiedNavigation')) return;
  const inPages = /\/pages\//.test(location.pathname);
  const base = inPages ? '../' : './';
  const current = location.pathname.endsWith('/') ? 'index.html' : (location.pathname.split('/').pop() || 'index.html');
  const destinations = [
    {href: base+'index.html#home', icon:'⌂', label:'Home', route:'home'},
    {href: base+'index.html#dashboard', icon:'▦', label:'Dashboard', route:'dashboard'},
    {href: base+'index.html#catalog', icon:'☷', label:'Bot Catalog', route:'catalog'},
    {href: base+'index.html#bot', icon:'◈', label:'Bot Details', route:'bot'},
    {href: base+'index.html#profile', icon:'♙', label:'Admin Profile', route:'profile'}
  ];
  const system = [
    ['system-configuration.html','System configuration','⚙'],
    ['logs-audit.html','Logs & Audit','≋'],
    ['version-logs.html','Version Logs','◷'],
    ['live-information.html','Live information','◉']
  ];
  const root = document.createElement('div');
  root.id = 'tbmcUnifiedNavigation';
  root.className = 'tbmc-bottom-navigation';
  root.innerHTML = `
    <button class="tbmc-bottom-toggle" type="button" aria-expanded="false" aria-controls="tbmcBottomPanel">
      <span class="tbmc-bottom-toggle-icon" aria-hidden="true">☰</span>
      <span>Main navigation</span>
      <span class="tbmc-bottom-chevron" aria-hidden="true">⌃</span>
    </button>
    <nav class="tbmc-bottom-panel" id="tbmcBottomPanel" aria-label="Main navigation" hidden>
      <div class="tbmc-panel-heading"><span>✦</span><strong>Telegram Bot Catalog</strong><span class="tbmc-panel-caption">MAIN NAVIGATION</span></div>
      ${destinations.map(item => `<a href="${item.href}" data-route="${item.route}" ${current==='index.html' && location.hash==='#'+item.route ? 'aria-current="page"' : ''}><span class="tbmc-link-icon">${item.icon}</span><span>${item.label}</span></a>`).join('')}
      <div class="tbmc-system-group">
        <button type="button" class="tbmc-system-toggle" aria-expanded="true" aria-controls="tbmcSystemLinks"><span class="tbmc-link-icon">⚙</span><strong>System</strong><span class="tbmc-system-chevron">⌄</span></button>
        <div id="tbmcSystemLinks" class="tbmc-system-links">
          ${system.map(([file,label,icon]) => `<a href="${base+'pages/'+file}" ${current===file ? 'aria-current="page"' : ''}><span class="tbmc-link-icon">${icon}</span><span>${label}</span></a>`).join('')}
        </div>
      </div>
    </nav>`;
  document.body.appendChild(root);
  const toggle = root.querySelector('.tbmc-bottom-toggle');
  const panel = root.querySelector('.tbmc-bottom-panel');
  const systemToggle = root.querySelector('.tbmc-system-toggle');
  const systemLinks = root.querySelector('.tbmc-system-links');
  const syncActiveRoute = () => {
    const hash = (location.hash || '#home').replace(/^#/, '');
    root.querySelectorAll('a[data-route]').forEach(link => {
      const active = link.dataset.route === hash || (hash.startsWith('bot/') && link.dataset.route === 'bot');
      if (active) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  };
  window.addEventListener('hashchange', syncActiveRoute);
  syncActiveRoute();
  const close = () => { panel.hidden = true; toggle.setAttribute('aria-expanded','false'); };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  });
  systemToggle.addEventListener('click', () => {
    const open = systemToggle.getAttribute('aria-expanded') !== 'true';
    systemToggle.setAttribute('aria-expanded', String(open));
    systemLinks.hidden = !open;
  });
  document.addEventListener('click', event => { if (!root.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  root.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', event => {
    if (link.dataset.route && current === 'index.html') {
      event.preventDefault();
      // Let the existing SPA router handle in-page navigation without a full reload.
      const hash = '#'+link.dataset.route;
      if (location.hash !== hash) location.hash = hash;
      close();
    }
  }));
})();