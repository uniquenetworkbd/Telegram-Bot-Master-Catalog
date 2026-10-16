(() => {
  'use strict';
  const API='https://api.github.com/repos/uniquenetworkbd/Telegram-Bot-Master-Catalog';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleString()};
  async function refresh(){
    const button=$('versionRefresh');button.disabled=true;button.textContent='Loading…';$('versionUpdated').textContent='Fetching GitHub commit history…';
    try{
      const response=await fetch(API+'/commits?per_page=30',{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
      if(!response.ok)throw new Error('GitHub API HTTP '+response.status);
      const commits=await response.json();if(!Array.isArray(commits))throw new Error('Unexpected commit response');
      $('versionCount').textContent=String(commits.length);
      const first=commits[0];$('latestVersion').textContent=first?'rev-'+new Date(first.commit.author.date||first.commit.committer.date).toISOString().slice(0,10)+'+'+first.sha.slice(0,7):'—';
      $('versionList').innerHTML=commits.map((c,i)=>{
        const sha=String(c.sha||'').slice(0,7),raw=c.commit?.message||'Repository update',title=raw.split('\n')[0];
        const d=c.commit?.author?.date||c.commit?.committer?.date;
        const label='rev-'+(d?new Date(d).toISOString().slice(0,10):'unknown')+'+'+sha;
        const body=raw.split('\n').slice(1).join('\n').trim();
        return '<article class="version-card"><div class="version-top"><div><div class="eyebrow">'+(i===0?'LATEST REVISION':'PLATFORM REVISION')+'</div><h2>'+esc(title)+'</h2></div><span class="tag '+(i===0?'green':'blue')+'">'+esc(label)+'</span></div><p>'+esc(body||'Repository update recorded in Git history.')+'</p><p>Committed: '+esc(date(d))+' · Author: '+esc(c.commit?.author?.name||c.author?.login||'Unknown')+'</p><p><a href="'+esc(c.html_url)+'" target="_blank" rel="noopener noreferrer">View commit details ↗</a></p></article>';
      }).join('')||'<div class="card empty">No commits returned.</div>';
      $('versionUpdated').textContent='Updated '+new Date().toLocaleTimeString()+' · Most recent 30 commits';
    }catch(error){$('versionList').innerHTML='<div class="card"><strong>Version history unavailable</strong><p class="sub">'+esc(error.message)+'; retry when GitHub API is available.</p></div>';$('versionUpdated').textContent='Could not refresh history.';}
    finally{button.disabled=false;button.textContent='↻ Refresh version history';}
  }
  $('versionRefresh').addEventListener('click',refresh);refresh();
})();