(() => {
  'use strict';
  const API='https://api.github.com/repos/uniquenetworkbd/Telegram-Bot-Master-Catalog';
  const started=Date.now(),tabId=Math.random().toString(36).slice(2),storageKey='tbmc-live-tabs-v1';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getTabs(){try{const raw=JSON.parse(localStorage.getItem(storageKey)||'{}');const now=Date.now();Object.keys(raw).forEach(k=>{if(now-raw[k]>15000)delete raw[k]});return raw}catch(_){return {}}}
  function countTabs(){const tabs=getTabs();tabs[tabId]=Date.now();try{localStorage.setItem(storageKey,JSON.stringify(tabs))}catch(_){}const count=Object.keys(tabs).length;$('localTabs').textContent=String(count);$('tabSummary').textContent=count+' active tab(s) on this device';}
  function renderRuntime(){
    const elapsed=Math.max(0,Math.floor((Date.now()-started)/1000));$('sessionDuration').textContent=elapsed<60?elapsed+'s':Math.floor(elapsed/60)+'m '+elapsed%60+'s';
    $('viewport').textContent=innerWidth+' × '+innerHeight;$('connection').textContent=navigator.onLine?'Online':'Offline';
    let theme='System';try{theme=localStorage.getItem('tbmc-theme')||'System'}catch(_){}$('currentTheme').textContent=theme[0].toUpperCase()+theme.slice(1);
    $('liveUpdated').textContent='Runtime refreshed '+new Date().toLocaleTimeString()+' · local-only telemetry';
  }
  async function refreshRepo(){
    $('repoStatus').textContent='Refreshing';$('latestWorkflow').textContent='Loading…';$('workflowState').textContent='Loading…';
    const results=await Promise.allSettled([fetch(API+'/actions/runs?per_page=1',{headers:{Accept:'application/vnd.github+json'},cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Workflow API HTTP '+r.status);return r.json()}),fetch(API+'/commits?per_page=1',{headers:{Accept:'application/vnd.github+json'},cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Commit API HTTP '+r.status);return r.json()})]);
    if(results[0].status==='fulfilled'){const run=results[0].value.workflow_runs?.[0];$('latestWorkflow').textContent=run?.name||'No workflow record';$('workflowState').textContent=run?(run.status==='completed'?run.conclusion:run.status):'Unknown';}else{$('latestWorkflow').textContent='Unavailable';$('workflowState').textContent=results[0].reason.message;}
    if(results[1].status==='fulfilled'){const c=results[1].value?.[0];$('latestCommit').innerHTML=c?'<a href="'+esc(c.html_url)+'" target="_blank" rel="noopener noreferrer">'+esc((c.commit?.message||'Commit').split('\n')[0].slice(0,90))+'</a>':'No commit';}else $('latestCommit').textContent='Unavailable';
    const ok=results.filter(r=>r.status==='fulfilled').length;$('repoStatus').textContent=ok===2?'Connected':ok===1?'Partial':'Unavailable';$('repoStatus').className='tag '+(ok===2?'green':'amber');$('repoUpdated').textContent=new Date().toLocaleTimeString();
  }
  $('liveRefresh').addEventListener('click',refreshRepo);window.addEventListener('resize',renderRuntime);window.addEventListener('online',renderRuntime);window.addEventListener('offline',renderRuntime);window.addEventListener('storage',countTabs);
  countTabs();renderRuntime();refreshRepo();setInterval(()=>{countTabs();renderRuntime()},1000);setInterval(refreshRepo,60000);
})();