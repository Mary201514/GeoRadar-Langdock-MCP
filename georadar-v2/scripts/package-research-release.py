"""Check native import structures and package source/configuration without credentials."""
import json, pathlib, re, zipfile
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'deliverables/georadar-supabase'
def read_json(z,name): return json.loads(z.read(name).decode('utf-8'))
with zipfile.ZipFile(out/'Mangold-LeadRadar-Supabase-Agent.zip') as z:
    a=read_json(z,'manifest.json')
    assert a['version']=='1.0.0' and a['inputType']=='STRUCTURED'
    assert a['actions']==[] and a['subagents']==[]
    fields={f['slug'] for f in a['inputFields']}
    assert set(re.findall(r'\{\{([A-Za-z0-9_]+)\}\}',a['instruction'])) <= fields
    assert 'save_georadar_research' in a['instruction'] and 'persisted=true' in a['instruction']
    assert 'research.mode=dummy' in a['instruction']
with zipfile.ZipFile(out/'Mangold-GeoRadar-Supabase-Integration.zip') as z:
    m=read_json(z,'manifest.json')
    assert m['integrationType']=='MCP' and m['authType']=='API_KEY'
    assert m['mcpClient']['url']=='https://mangold-georadar.vercel.app/mcp'
    assert m['authFields']==[]
    for slug in ['save_georadar_research','load_georadar_research','show_georadar_map']:
        p='actions/'+slug+'/latest/'
        action=read_json(z,p+'action_manifest.json')
        assert action['slug']==slug and action['actionType']=='MCP'
        assert z.read(p+'code.js')==b''
        for f in action['inputFields']:json.loads(f['jsonSchema'])
    assert any('/map-v4.html/' in n for n in z.namelist())
guide=(root/'SUPABASE-LANGDOCK-SETUP.md').read_bytes()
(out/'README-EINRICHTUNG.md').write_bytes(guide)
report={'importFormatChecks':'passed against supplied native export structures','credentialsIncluded':False,'workspaceActionBinding':'required after import; original agent export had actions=[]','technicalTests':'9 Supabase contract-double tests and real Chrome full local pipeline passed; core, transport, bridge and PLZ tests passed','liveSupabase':'not confirmed yet','actualLangdockImport':'not confirmed yet'}
live_report=root/'verification/research-production-readiness.json'
if live_report.exists():report['vercelReadiness']=json.loads(live_report.read_text(encoding='utf-8'))
(out/'TESTSTATUS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
source_names=['serve.cjs','vercel.json','.env.example','.gitignore','SUPABASE-LANGDOCK-SETUP.md']
for folder in ['api','backend','dist','mcp','supabase','test','scripts','langdock']:
    for p in (root/folder).rglob('*'):
        if p.is_file() and '__pycache__' not in p.parts and p.name not in ['map.html']:
            source_names.append(p.relative_to(root).as_posix())
for name in source_names:
    assert not any(part in ('.git','.vercel','node_modules') for part in pathlib.PurePosixPath(name).parts)
    assert not pathlib.PurePosixPath(name).name.startswith('.env') or name=='.env.example'
    p=root/name
    if p.suffix in ('.js','.cjs','.mjs','.json','.md','.py','.sql'):
        text=p.read_text(encoding='utf-8')
        assert not re.search(r'sb_secret_[A-Za-z0-9_-]{24,}',text), 'Secret-like value in '+name
        assert not re.search(r'\beyJ[A-Za-z0-9_-]{25,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}',text), 'JWT-like value in '+name
with zipfile.ZipFile(out/'GeoRadar-App-Quellcode.zip','w',zipfile.ZIP_DEFLATED) as z:
    for name in sorted(set(source_names)):z.write(root/name,'georadar/'+name)
complete=out/'Mangold-GeoRadar-Supabase-Komplettpaket.zip'
with zipfile.ZipFile(complete,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.iterdir()):
        if p.is_file() and p!=complete:z.write(p,p.name)
print(json.dumps({'checks':'passed','archives':[{'name':p.name,'bytes':p.stat().st_size} for p in sorted(out.glob('*.zip'))]},ensure_ascii=True))
