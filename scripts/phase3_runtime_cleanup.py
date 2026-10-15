from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

old='''<div class="card tablecard"><div class="tablehead"><div><h2>Catalog records</h2><div class="sub" id="resultCount">Preparing records…</div></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button class="button" id="exportBtn" type="button">⇩ Export CSV</button><label style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px">Rows <select id="pageSize" class="field" style="width:88px;padding:7px"><option>25</option><option>50</option><option>100</option></select></label></div></div>'''
new='''<div class="card tablecard"><div class="tablehead"><div><h2>Catalog records</h2><div class="sub" id="resultCount">Preparing records…</div></div><label style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px">Rows <select id="pageSize" class="field" style="width:88px;padding:7px"><option>25</option><option>50</option><option>100</option></select></label></div>'''
assert old in s, 'duplicated Catalog export control not found'
s=s.replace(old,new,1)

old='''<div class="card"><div class="sectiontitle"><div><h2>Runtime checks</h2><p>Live checks from this browser session</p></div></div><div class="runtime-headline">'''
new='''<div class="card"><div class="runtime-headline">'''
assert old in s, 'duplicated Runtime checks heading not found'
s=s.replace(old,new,1)

assert s.count('id="exportBtn"')==1, 'Expected exactly one export button after cleanup'
assert s.count('<h2>Runtime checks</h2>')==0, 'Runtime checks heading should be represented by the runtime headline'
p.write_text(s,encoding='utf-8')
print('Phase 3 runtime cleanup applied')
