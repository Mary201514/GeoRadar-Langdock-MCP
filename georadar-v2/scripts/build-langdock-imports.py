"""Generate native-format import archives using the user's two exports as templates.
No original source text is executed. Credentials and connection instances are excluded.
"""
import json, pathlib, re, subprocess, uuid, zipfile

root = pathlib.Path(__file__).resolve().parents[1]
downloads = pathlib.Path.home() / 'Downloads'
target = root / 'deliverables' / 'georadar-supabase'
source = root / 'langdock'
target.mkdir(parents=True, exist_ok=True)
source.mkdir(parents=True, exist_ok=True)
def dump(obj): return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'
def node_json(expression):
    return json.loads(subprocess.check_output(['node', '-e', 'process.stdout.write(JSON.stringify(' + expression + '))'], cwd=root).decode('utf-8'))
def read_template(name):
    template = source / ('template-agent.json' if name.startswith('Mangold LeadRadar') else 'template-integration.json')
    if (downloads / name).exists():
        with zipfile.ZipFile(downloads / name) as z:
            data = json.loads(z.read('manifest.json'))
        if name.startswith('Mangold LeadRadar'):
            data['actions'] = []
            data['subagents'] = []
        else:
            data['authFields'] = []
            data['mcpClient'] = {k:v for k,v in data.get('mcpClient',{}).items() if k in ('url','protocolVersion','clientVersion','transportType')}
        template.write_text(dump(data),encoding='utf-8')
        return data
    return json.loads(template.read_text(encoding='utf-8'))

ids_path = source / 'package-identities.json'
if ids_path.exists(): ids = json.loads(ids_path.read_text(encoding='utf-8'))
else:
    ids = {key: str(uuid.uuid4()) for key in ('agent', 'integration')}
    ids_path.write_text(dump(ids), encoding='utf-8')
agent = read_template('Mangold LeadRadar 2.02.zip')
original_instruction = agent['instruction']
integration = read_template('georadar-langdock.zip')
agent.update(id=ids['agent'], name='Mangold LeadRadar – GeoRadar Speicher', description='Recherchiert strukturierte B2B-Ergebnisse und speichert sie unter einer selbst gewählten Kennung in Supabase. Öffentliche Links zunächst nur für Dummy-Daten.', subagents=[], actions=[], imageGeneration=False, creativity=0.2, webSearch=True)
for f in agent['inputFields']:
    if f['slug'] == 'Zielbranchen__optional_': f['slug'] = 'industries'
    f['order'] += 3
    if f['slug'] == 'neukunden_anzahl':
        f['required'] = False
        if '4 Unternehmen – Dummy-Test' not in f['options']: f['options'].insert(0, '4 Unternehmen – Dummy-Test')
agent['inputFields'] = [
    {'slug':'recherche_kennung','type':'TEXT','label':'Recherche-Kennung (z. B. AB382)','description':'3–32 Zeichen, beginnt mit Buchstabe. Keine Schlüssel oder personenbezogenen Daten verwenden.','required':True,'order':0,'options':[],'fileTypes':None},
    {'slug':'betriebsmodus','type':'SELECT','label':'Betriebsmodus','description':'Öffentliche Links sind ausschließlich für fiktive Testdaten freigegeben. Ohne Auswahl: Dummy-Test.','required':False,'order':1,'options':['Dummy-Test (4 fiktive Firmen)','B2B-Recherche (intern; kein öffentlicher Link)'],'fileTypes':None},
    {'slug':'recherche_titel','type':'TEXT','label':'Recherche-Titel (optional)','description':'Höchstens 160 Zeichen.','required':False,'order':2,'options':[],'fileTypes':None},
] + agent['inputFields']
agent['inputFields'].append({'slug':'suchgebiet_umkreis_plz','type':'TEXT','label':'Zentrum-PLZ für Umkreissuche (optional)','description':'Ohne belegte Entfernungsberechnung keine exakte Umkreisabdeckung behaupten.','required':False,'order':len(agent['inputFields']),'options':[],'fileTypes':None})
fixture = node_json("require('./test/research-fixture.cjs')")
agent['instruction'] = r'''Du bist Mangold LeadRadar, ein Recherche-Agent der Elektromaschinenbau Mangold GmbH. Deine Aufgabe ist: Ergebnisse strukturieren, genau einmal unter der selbst gewählten Kennung in Supabase speichern und den bestätigten Kartenlink ausgeben. Keine ERP-Anbindung, keine Kontaktaufnahme, keine Nachrichten an recherchierte Unternehmen.

## Kennung und Betriebsmodus
Kennung: {{recherche_kennung}}. Titel: {{recherche_titel}}. Betriebsmodus: {{betriebsmodus}}.
Ohne Kennung nachfragen, niemals selbst eine fremde Kennung übernehmen. Kennung auf Großbuchstaben normalisieren; 3–32 Zeichen, Beginn Buchstabe, anschließend Buchstaben, Ziffern oder Bindestriche. Beispiel AB382. Eine Kennung ist kein Geheimnis und kein Passwort.
Ohne Modus gilt Dummy-Test. Im Dummy-Test niemals echte Unternehmen recherchieren oder Kundendateien verarbeiten. Verwende die untenstehenden vier ausdrücklich fiktiven Firmen. Im Modus B2B-Recherche sind öffentliche Informationen erlaubt, aber diese echten Rechercheergebnisse werden nicht öffentlich über den Ergebnislink freigegeben. Behaupte keine öffentliche Freigabe, wenn publiclyReadable=false zurückkommt.

## Rechercheeingaben (nur B2B-Modus)
Land/Region {{suchgebiet_land}}, Produkte {{product_areas}}, Zielbranchen {{industries}}, weitere Branchen {{additional_industries}}, DE-PLZ-Gebiete {{suchgebiet_plz_gebiete}}, AT-PLZ-Gebiete {{suchgebiet_plz_gebiete_at}}, manuelle PLZ/Präfixe {{suchgebiet_plz_manuell}}, Umkreis {{suchgebiet_umkreis_plz}} / {{suchgebiet_umkreis_km}}, Kundenstatus {{kundenstatus}}, Anzahl {{neukunden_anzahl}}, Verflechtungen {{unternehmensverflechtungen}}, Vertreter {{vertreter}}.
Ein einzelner Suchparameter reicht. Ohne Suchparameter im B2B-Modus zuerst fragen. PLZ sind Text; führende Nullen behalten. Deutschland: fünfstellige PLZ, Österreich: vierstellige PLZ; zweistellige Präfixe sind Gebiete. Keine Abdeckung einer exakten Umkreissuche ohne belastbare Entfernungsdaten behaupten.

## Recherchequalität
Nur B2B-Unternehmen; Privatpersonen und Privatkunden ausschließen. Im B2B-Modus vor jeder Recherche https://www.mangoldgmbh.com/ lesen und nur belegte Produkte/Leistungen für die Bewertung verwenden. Unternehmenswebsites, öffentliche Registerangaben und seriöse Branchenquellen verwenden, Nutzungsbedingungen beachten. Bei jedem Treffer Quellen-URLs übergeben; ungesicherte Informationen als needsReview=true und mit Hinweis kennzeichnen. Keine Quellen, Umsätze, Firmenstandorte oder Koordinaten erfinden. Ansprechpartner und personenbezogene Kontaktdaten standardmäßig weglassen.
Bestandsabgleich nur bei tatsächlich bereitgestellter Kundenliste. Bestehende Kunden nur aus belastbarem Abgleich, nicht aus Vermutung als existing kennzeichnen. Ohne Liste Abgleich offen als nicht durchgeführt nennen. A-/B-/C-Kunden und Key-Accounts sind Bestand. Kundenstatus-Auswahl respektieren; ehemalige Kunden separat kenntlich machen. Kein ERP-Zugriff und kein automatischer ERP-Import.
Vertreter CO=93, SR=42, SH=11, GD=2 nur nach bereitgestellter Zuordnung übernehmen, nicht aus Geografie erraten. Ohne Zuordnung weglassen. Verflechtungen nur mit Quellen, sonst zu prüfen.
Bewertung 0–100: Branchenpassung bis 25, Region bis 25, Produktpassung bis 30, belegte Ähnlichkeit zu A-Kunden bis 20. Fehlende Belege bringen keine erfundenen Punkte. Weniger belegte Treffer liefern, wenn die gewünschte Zahl nicht erreicht wird.

## Einheitliches Datenmodell
Jeder Datensatz: id (eindeutiger Text), name, country (DE oder AT), status, isFictional, needsReview. Optional: street, postalCode, postalPrefix, city, state, industry, product, potential, leadScore, revenue, personnelNumber, salesRep, relationships, notes, reason, opportunity, website, sources.
sources ist eine Liste aus {"url":"https://…","title":"Beleg"}, höchstens 20 pro Firma. website und Quellen nur http/https ohne eingebettete Zugangsdaten.
Statusfarben: existing=blauer Bestandskunde; prospect=weißer potenzieller Neukunde; priority=roter besonders interessanter Lead; unknown=grauer ungeklärter Status. Ein bekannter Bestandskunde bleibt existing, auch bei hohem Score. priority nur für belegte priorisierte potenzielle Leads, sonst prospect; ungeklärte Zuordnung unknown. Score und Kundenstatus nicht verwechseln.
lon/lat nur als Zahlen und nur gemeinsam. locationAccuracy=exact ausschließlich bei geprüftem Firmenstandort; sonst approximate oder unknown. Wenn nur eine PLZ/PLZ-Region bekannt ist, keine Koordinaten erfinden: postalPrefix mit zwei Ziffern übergeben. Die App zeigt dann nur einen ausdrücklich schematischen Gebietspunkt. Bei vollständiger PLZ ohne Firmenkoordinaten darf zusätzlich ihr zweistelliges Präfix als grobe Orientierung übergeben werden. Bei fehlender PLZ bleibt der Datensatz ohne Marker in der Liste.

## Verbindlicher Speicherablauf
1. Daten im gewünschten Modus erstellen. Im Dummy-Modus genau die vier unten angegebenen Datensätze verwenden, isFictional=true und research.mode=dummy. Im B2B-Modus isFictional=false und research.mode=research. Niemals echte Firmen als Dummy markieren, um eine öffentliche Freigabe zu umgehen.
2. Die Aktion save_georadar_research der Integration „Mangold GeoRadar – Supabase“ einmal mit {code,title,records,research} aufrufen. research enthält mode, query und optional generatedAt als gültigen ISO-Zeitpunkt und notes. Verwende nur die freigegebene Aktion; keine direkten Supabase-Abfragen, kein SQL und keine geheimen Schlüssel im Prompt oder Ergebnis.
3. Erst bei erfolgreicher Antwort mit persisted=true gilt die Recherche als gespeichert. Gib code, recordCount und genau die vom Werkzeug gelieferte mapUrl aus. Nur wenn publiclyReadable=true ist, als öffentlich abrufbaren Link bezeichnen. Keine erfundenen Erfolgsmeldungen und keinen bloß selbst zusammengesetzten Link als erfolgreichen Speichernachweis ausgeben.
4. Bei CODE_EXISTS nichts überschreiben: den Nutzer um eine andere Kennung bitten. Ein identischer Wiederholungsaufruf ist sicher und darf denselben vorhandenen Link zurückgeben. Bei STORAGE_NOT_CONFIGURED oder STORAGE_SCHEMA_MISSING die Einrichtung als offen melden. Bei Timeout kann derselbe unveränderte Aufruf wiederholt werden, niemals das Ergebnis als gespeichert annehmen.
5. Bestehende Ergebnisse bei Bedarf mit load_georadar_research unter der bekannten Kennung laden. show_georadar_map nur bei ausdrücklich zusätzlichem Wunsch nach einer eingebetteten Kartenansicht verwenden; der normale Abschluss ist der gespeicherte URL-Link, kein zweiter Karten-Subagent.

## Ausgabe
Kurze Ergebnistabelle mit Unternehmen, PLZ/Präfix, Ort, Land, Status, Score, Grund und Quellen; danach die bestätigte Kennung und den bestätigten Kartenlink. Im Dummy-Modus klar „Fiktive Testdaten“. Im B2B-Modus Recherchegrenzen nennen. Keine Kontaktaufnahme. Dateien/PDF/Excel nur bei ausdrücklich vorhandener Fähigkeit und gewünschtem Export; keine Dateierstellung oder Ablage behaupten, die nicht tatsächlich erfolgt ist.

## Ausschließlich fiktive Dummy-Referenzdaten
Ersetze nur code und title durch die Benutzereingaben. Keine Webrecherche für diese Firmen, keine echten Bestandsdaten verwenden. Die Koordinaten sind erfundene Testpositionen, keine Firmenadressen.
@@DUMMY@@
'''.replace('@@DUMMY@@', json.dumps(fixture, ensure_ascii=False, indent=2))
industry_rule = re.search(r'\*\*Branchenliste:\*\* (.*?)(?:\n|$)', original_instruction)
if industry_rule:
    agent['instruction'] = agent['instruction'].replace('## Recherchequalität', '## Recherchequalität\n'+industry_rule.group(1)+'\nStandardpriorität bei fehlender Region: Süddeutschland, dann Vorarlberg, dann übriges Deutschland und Österreich.')
agent['instruction'] = agent['instruction'].replace('Ohne Kennung nachfragen,', 'Ohne Titel verwende "Recherche " plus Kennung; keinen leeren Titel übergeben. Ohne Kennung nachfragen,')
agent['instruction'] = agent['instruction'].replace('danach die bestätigte Kennung und den bestätigten Kartenlink.', 'danach die bestätigte Kennung und nur bei öffentlich freigegebenen Dummy-Daten den bestätigten Kartenlink. Bei internen B2B-Daten keine öffentliche Darstellung behaupten.')

integration.update(id=ids['integration'], name='Mangold GeoRadar – Supabase', description='Speichert Recherchen unter Kennung und lädt gespeicherte Ergebnisse. Native MCP-Verbindung; Zugangsdaten erst beim Verbinden in Langdock eintragen.', authType='API_KEY', integrationType='MCP', authFields=[])
integration['mcpClient']={'url':'https://mangold-georadar.vercel.app/mcp','protocolVersion':'2025-11-25','clientVersion':'1.1.0','transportType':'STREAMABLE_HTTP'}
tools = node_json("require('./mcp/server.cjs').handle({jsonrpc:'2.0',id:1,method:'tools/list'}).result.tools")
uri = node_json("require('./mcp/server.cjs').URI")
def field(slug, schema, required):
    return {'slug':slug,'label':slug,'description':schema.get('description',''),'placeholder':None,'type':'OBJECT' if schema.get('type') in ('array','object') else 'TEXT','required':required,'options':None,'allowMultiSelect':None,'allowMultiFile':False,'maxLength':schema.get('maxLength'),'jsonSchema':json.dumps(schema,ensure_ascii=False,separators=(',',':'))}
with zipfile.ZipFile(target/'Mangold-LeadRadar-Supabase-Agent.zip','w',zipfile.ZIP_DEFLATED) as z: z.writestr('manifest.json', dump(agent))
with zipfile.ZipFile(target/'Mangold-GeoRadar-Supabase-Integration.zip','w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('manifest.json', dump(integration))
    for tool in tools:
        schema=tool['inputSchema']; action={'slug':tool['name'],'name':tool.get('title',tool['name']),'description':tool['description'],'nativeActionType':'NONE','actionType':'MCP','requiresConfirmation':False,'kind':'view','inputFields':[field(k,s,k in schema.get('required',[])) for k,s in schema['properties'].items()]}
        folder='actions/'+tool['name']+'/latest/'
        z.writestr(folder+'action_manifest.json',dump(action));z.writestr(folder+'code.js','')
    resource={'slug':uri,'name':uri,'description':'GeoRadar-Kartenressource','nativeActionType':'NONE','actionType':'MCP_RESOURCE','requiresConfirmation':False,'kind':'view','inputFields':[]}
    z.writestr('actions/'+uri+'/latest/action_manifest.json',dump(resource));z.writestr('actions/'+uri+'/latest/code.js','')
(source/'agent-manifest.json').write_text(dump(agent),encoding='utf-8')
(source/'integration-manifest.json').write_text(dump(integration),encoding='utf-8')
(source/'tool-schemas.json').write_text(dump(tools),encoding='utf-8')
(target/'Dummy-Test-AB382.json').write_text(dump(fixture),encoding='utf-8')
(target/'Supabase-Tabelle-anlegen.sql').write_bytes((root/'supabase/migrations/20261102_georadar_research_runs.sql').read_bytes())
for f in sorted(target.glob('*')): print(f.name, f.stat().st_size)
