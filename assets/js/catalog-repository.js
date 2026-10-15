(() => {
  const HEADERS=['index','Bot ID','Category No','Category','English Category','Bot Name','What it does','Free/Low-cost Technology','API Required?','Automation Potential','Monetization Potential','Suggested MVP','Notes'];
  const DATA_URL='./data/Telegram_Bot_Master_Catalog_1000.csv';
  const EXTENSION_URL='./data/Telegram_Bot_Master_Catalog_Research_Extension.csv';
  const CATEGORY_REGISTRY_URL='./data/research/catalog-concept-categories-67-100.json';
  const ARCHETYPES=[
    ['Info Bot','তথ্য অনুসন্ধান, সংরক্ষণ ও দ্রুত ফলাফল দেয়।','মাঝারি','Freemium / premium plan / service fee'],
    ['Tracker Bot','নির্দিষ্ট তথ্য বা অবস্থার পরিবর্তন ট্র্যাক করে এবং আপডেট জানায়।','উচ্চ','Freemium / subscription / sponsorship'],
    ['Manager Bot','রেকর্ড, ব্যবহারকারী বা কাজ ব্যবস্থাপনা করে।','মাঝারি','B2B subscription / setup fee / premium features'],
    ['Reporter Bot','সংক্ষিপ্ত সারাংশ, রিপোর্ট বা স্ট্যাটাস তৈরি করে।','উচ্চ','B2B subscription / setup fee / premium features'],
    ['Alert Bot','নির্ধারিত শর্ত পূরণ হলে Telegram সতর্কবার্তা পাঠায়।','উচ্চ','Freemium / subscription / sponsorship'],
    ['Analyzer Bot','ইনপুট ডেটা বিশ্লেষণ করে সিদ্ধান্ত-সহায়ক ফল দেয়।','উচ্চ','B2B subscription / setup fee / premium features'],
    ['Scheduler Bot','সময়সূচি, পুনরাবৃত্ত কাজ ও নির্ধারিত অপারেশন পরিচালনা করে।','উচ্চ','Freemium / premium plan / service fee'],
    ['Converter Bot','তথ্য, ফাইল বা ফরম্যাট এক রূপ থেকে অন্য রূপে রূপান্তর করে।','উচ্চ','Freemium / premium plan / service fee'],
    ['Assistant Bot','ব্যবহারকারীকে ধাপে ধাপে নির্দিষ্ট কাজ সম্পন্ন করতে সহায়তা করে।','উচ্চ','Freemium / subscription / sponsorship'],
    ['Pro Bot','একাধিক সংশ্লিষ্ট ফিচার একত্র করে একটি উন্নত workflow দেয়।','উচ্চ','B2B subscription / setup fee / premium features']
  ];
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
  function makeConcepts(categories){
    const out=[];let index=660;
    categories.forEach(cat=>ARCHETYPES.forEach((a,n)=>{
      const api=/(API|SEO|DNS|SSL|GitHub|DevOps|Monitoring|Database|Coding|Testing|Travel|Transport|Shopping|Cloud|RSS|YouTube|Podcast)/i.test(cat.english)?'হ্যাঁ':'না/ঐচ্ছিক';
      out.push({
        index:index++,
        'Bot ID':`B${String(cat.no).padStart(3,'0')}-${String(n+1).padStart(2,'0')}`,
        'Category No':String(cat.no),Category:cat.category,'English Category':cat.english,
        'Bot Name':`${cat.category} ${a[0]}`,
        'What it does':`${a[1]} ${cat.category} ব্যবহারের জন্য একটি বাস্তবায়নযোগ্য Telegram workflow.`,
        'Free/Low-cost Technology':'Telegram Bot API + Python/PHP + SQLite/JSON; প্রয়োজনে public API/webhook',
        'API Required?':api,'Automation Potential':a[2],'Monetization Potential':a[3],
        'Suggested MVP':'Telegram command + inline buttons + validation + structured storage + logging',
        'Notes':'Research classification: feasible bot concept, not a claim that a public bot with this exact name exists. Capability basis: Telegram Bot API, commands, keyboards, inline mode and Mini Apps.'
      });
    }));
    return out;
  }
  async function load(){
    const [mainRes,extRes,registryRes]=await Promise.all([
      fetch(DATA_URL,{cache:'no-store'}),
      fetch(EXTENSION_URL,{cache:'no-store'}),
      fetch(CATEGORY_REGISTRY_URL,{cache:'no-store'})
    ]);
    if(!mainRes.ok)throw new Error('Primary CSV returned HTTP '+mainRes.status);
    if(!extRes.ok)throw new Error('Research extension returned HTTP '+extRes.status);
    if(!registryRes.ok)throw new Error('Category registry returned HTTP '+registryRes.status);
    const mainRecords=parseCSV(await mainRes.text());
    const extensionRecords=parseCSV(await extRes.text());
    const categories=await registryRes.json();
    const generated=makeConcepts(Array.isArray(categories)?categories:[]);
    const records=[...mainRecords,...extensionRecords,...generated];
    const ids=new Set();const unique=records.filter(r=>{if(ids.has(r['Bot ID']))return false;ids.add(r['Bot ID']);return true});
    if(unique.length!==1000)throw new Error('Catalog completion invariant failed: expected 1000 unique records, got '+unique.length);
    if(new Set(unique.map(r=>r['English Category']||'Uncategorized')).size!==100)throw new Error('Catalog completion invariant failed: expected 100 categories');
    return {records:unique,headers:HEADERS,url:DATA_URL,extensionUrl:EXTENSION_URL,registryUrl:CATEGORY_REGISTRY_URL};
  }
  function isApi(v){const s=String(v||'').trim().toLowerCase();return s==='yes'||s.startsWith('yes')||s.includes('হ্যাঁ')}
  function categoryCounts(records){return records.reduce((m,b)=>{const k=b['English Category']||'Uncategorized';m[k]=(m[k]||0)+1;return m},{});}
  function automationCounts(records){const m={'উচ্চ':0,'মাঝারি':0,'নিম্ন':0,'Other / unspecified':0};records.forEach(b=>{const v=String(b['Automation Potential']||'').trim();if(Object.prototype.hasOwnProperty.call(m,v))m[v]++;else m['Other / unspecified']++});return m;}
  window.TBMC=window.TBMC||{};window.TBMC.catalogRepository={DATA_URL,EXTENSION_URL,CATEGORY_REGISTRY_URL,HEADERS,load,isApi,categoryCounts,automationCounts};
})();