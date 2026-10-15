(() => {
  const HEADERS=['index','Bot ID','Category No','Category','English Category','Bot Name','What it does','Free/Low-cost Technology','API Required?','Automation Potential','Monetization Potential','Suggested MVP','Notes'];
  const DATA_URL='./data/Telegram_Bot_Master_Catalog_1000.csv';
  function parseCSV(text){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean),records=[];
    for(const line of lines){
      if(line.startsWith('<PARSED FROM SHEET:')||line.startsWith('TAB NAME:'))continue;
      const row=[];let cell='',quoted=false;
      for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&quoted&&line[i+1]==='"'){cell+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else cell+=c}
      row.push(cell);if(row.length>=HEADERS.length&&row[1]!=='Bot ID'){const item={};HEADERS.forEach((h,i)=>item[h]=row[i]??'');if(item['Bot ID'])records.push(item)}
    }
    return records;
  }
  async function load(){const res=await fetch(DATA_URL,{cache:'no-store'});if(!res.ok)throw new Error('CSV returned HTTP '+res.status);const text=await res.text();const records=parseCSV(text);if(!records.length)throw new Error('The CSV was loaded but no valid bot records were parsed');return {records,headers:HEADERS,url:DATA_URL};}
  function isApi(v){const s=String(v||'').trim().toLowerCase();return s==='yes'||s.startsWith('yes')||s.includes('হ্যাঁ')}
  function categoryCounts(records){return records.reduce((m,b)=>{const k=b['English Category']||'Uncategorized';m[k]=(m[k]||0)+1;return m},{});}
  function automationCounts(records){const m={'উচ্চ':0,'মাঝারি':0,'নিম্ন':0,'Other / unspecified':0};records.forEach(b=>{const v=String(b['Automation Potential']||'').trim();if(Object.prototype.hasOwnProperty.call(m,v))m[v]++;else m['Other / unspecified']++});return m;}
  window.TBMC=window.TBMC||{};window.TBMC.catalogRepository={DATA_URL,HEADERS,load,isApi,categoryCounts,automationCounts};
})();