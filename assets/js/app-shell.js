(() => {
  const routes=['home','dashboard','catalog','bot','profile','system'];
  const state={route:'home',previous:'home',selectedBotId:null,catalog:null,moreReturn:null,returnToMore:false};
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function text(id,value){if($(id))$(id).textContent=value}
  function closeMore(){if($('moreMenu'))$('moreMenu').classList.remove('open');if($('moreNavBtn'))$('moreNavBtn').setAttribute('aria-expanded','false')}
  function saveCatalog(){if(state.route!=='catalog'||!$('search'))return;state.catalog={search:$('search').value,category:$('category').value,api:$('api').value,automation:$('automation').value,sort:$('sort').value,page:Number($('page').dataset.current||1),pageSize:$('pageSize').value,scrollY:window.scrollY};try{sessionStorage.setItem('tbmc-catalog-state',JSON.stringify(state.catalog))}catch(e){}}
  function loadCatalog(){if(state.catalog)return state.catalog;try{const raw=sessionStorage.getItem('tbmc-catalog-state');if(raw)state.catalog=JSON.parse(raw)}catch(e){}return state.catalog}
  function setTheme(theme){const root=document.documentElement;if(theme==='system')root.removeAttribute('data-theme');else root.setAttribute('data-theme',theme);if($('themeSelect'))$('themeSelect').value=theme}
  function loadTheme(){let theme='system';try{theme=localStorage.getItem('tbmc-theme')||'system'}catch(e){}setTheme(theme)}
  function initTheme(){loadTheme();$('themeSelect')?.addEventListener('change',()=>{const v=$('themeSelect').value;setTheme(v);try{localStorage.setItem('tbmc-theme',v)}catch(e){}})}
  function routeFromHash(){const raw=location.hash.replace(/^#/,'');if(raw.startsWith('bot/'))return ['bot',decodeURIComponent(raw.slice(4))];return [routes.includes(raw)?raw:'home',null]}
  function go(route,options={}){let id=options.botId||null;if(!routes.includes(route))route='home';if(route!==state.route){saveCatalog();state.previous=state.route}if(route==='bot'&&id)state.selectedBotId=id;state.route=route;if(!options.history){const hash=route==='bot'&&state.selectedBotId?'#bot/'+encodeURIComponent(state.selectedBotId):'#'+route;if(location.hash!==hash)history.pushState({route,botId:state.selectedBotId},'',hash)}document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+route));document.querySelectorAll('[data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===route));document.querySelectorAll('[data-mobile-route]').forEach(a=>a.classList.toggle('active',a.dataset.mobileRoute===route));$('moreNavBtn')?.classList.toggle('active',['bot','profile','system'].includes(route));const active=document.querySelector('[data-route="'+route+'"]');text('breadcrumb',active?active.textContent.trim():route==='bot'?'Bot Details':route);closeMore();window.TBMC.app?.onRoute(route);if(route==='catalog'){const saved=loadCatalog();if(saved)window.TBMC.app?.restoreCatalog(saved)}else window.scrollTo({top:0,behavior:'auto'})}
  function syncHistory(){const parsed=routeFromHash();go(parsed[0],{history:true,botId:parsed[1]});if(state.returnToMore&&state.route===state.moreReturn){$('moreMenu')?.classList.add('open');$('moreNavBtn')?.setAttribute('aria-expanded','true');state.returnToMore=false;state.moreReturn=null}}
  function init(){
    initTheme();
    document.querySelectorAll('[data-route]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(a.closest('#moreMenu')){state.moreReturn=state.route;state.returnToMore=true}go(a.dataset.route)}));
    document.querySelectorAll('[data-mobile-route]').forEach(a=>a.addEventListener('click',()=>go(a.dataset.mobileRoute)));
    $('moreNavBtn')?.addEventListener('click',()=>{const open=$('moreMenu').classList.toggle('open');$('moreNavBtn').setAttribute('aria-expanded',String(open))});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMore()});
    window.addEventListener('hashchange',syncHistory);
    $('menuTop')?.addEventListener('click',()=>go('home'));
    const parsed=routeFromHash();go(parsed[0],{history:true,botId:parsed[1]});
  }
  window.TBMC=window.TBMC||{};window.TBMC.appShell={state,go,saveCatalog,loadCatalog,setTheme,esc,init};
})();