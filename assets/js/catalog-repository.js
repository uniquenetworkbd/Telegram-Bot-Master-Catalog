(() => {
  const HEADERS=['index','Bot ID','Category No','Category','English Category','Bot Name','What it does','Free/Low-cost Technology','API Required?','Automation Potential','Monetization Potential','Suggested MVP','Notes'];
  const DATA_URL='./data/Telegram_Bot_Master_Catalog_1000.csv';
  function parseCSV(text){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean),records=[];
    for(const line of lines){
      if(line.startsWith('<PARSED FROM SHEET:')||line.startsWith('<PARSED TEXT FOR SHEET:')||line.startsWith('TAB NAME:'))continue;
      const row=[];let cell='',quoted=false;
      for(let i=0;i<line.length;i++){
        const c=line[i];
        if(c==='"'&&quoted&&line[i+1]==='"'){cell+='"';i++}
        else if(c==='"'){quoted=!quoted}
        else if(c===','&&!quoted){row.push(cell);cell=''}
        else cell+=c;
      }
      row.push(cell);
      if(row.length>=HEADERS.length&&row[1]!=='Bot ID'){
        const item={};HEADERS.forEach((h,i)=>item[h]=row[i]??'');
        if(item['Bot ID'])records.push(item);
      }
    }
    return records;
  }
  let loadPromise=null;
  async function loadFresh(){
    const res=await fetch(DATA_URL,{cache:'no-store'});
    if(!res.ok)throw new Error('CSV returned HTTP '+res.status);
    const records=parseCSV(await res.text());
    if(records.length!==1000)throw new Error('Catalog validation failed: expected 1000 records, got '+records.length);
    const ids=records.map(r=>String(r['Bot ID']||'').trim());
    if(ids.some(v=>!v)||new Set(ids).size!==records.length)throw new Error('Catalog validation failed: missing or duplicate Bot ID');
    const names=records.map(r=>String(r['Bot Name']||'').trim().toLocaleLowerCase());
    if(names.some(v=>!v)||new Set(names).size!==records.length)throw new Error('Catalog validation failed: missing or duplicate Bot Name');
    const categories=records.reduce((m,r)=>{const key=String(r['English Category']||'').trim();if(key)m[key]=(m[key]||0)+1;return m;},{});
    if(Object.keys(categories).length!==100)throw new Error('Catalog validation failed: expected 100 categories, got '+Object.keys(categories).length);
    const badCategories=Object.entries(categories).filter(([,count])=>count!==10);
    if(badCategories.length)throw new Error('Catalog validation failed: every category must contain exactly 10 records');
    const missing=records.filter(r=>HEADERS.some(h=>!String(r[h]??'').trim()));
    if(missing.length)throw new Error('Catalog validation failed: '+missing.length+' record(s) have empty fields');
    return {records,headers:HEADERS,url:DATA_URL,categoryCounts:categories};
  }
  function load(options={}){
    if(options && options.force===true)loadPromise=null;
    if(!loadPromise)loadPromise=loadFresh().catch(error=>{loadPromise=null;throw error});
    return loadPromise;
  }
  function isApi(v){const s=String(v||'').trim().toLowerCase();return s==='yes'||s.startsWith('yes')||s.includes('হ্যাঁ')}
  function categoryCounts(records){return records.reduce((m,b)=>{const k=b['English Category']||'Uncategorized';m[k]=(m[k]||0)+1;return m},{});}
  function automationCounts(records){const m={'উচ্চ':0,'মাঝারি':0,'নিম্ন':0,'Other / unspecified':0};records.forEach(b=>{const v=String(b['Automation Potential']||'').trim();if(Object.prototype.hasOwnProperty.call(m,v))m[v]++;else m['Other / unspecified']++});return m;}
  window.TBMC=window.TBMC||{};window.TBMC.catalogRepository={DATA_URL,HEADERS,load,isApi,categoryCounts,automationCounts};
})();