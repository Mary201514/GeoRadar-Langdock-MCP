# Mangold: Recherche → Supabase → Kartenlink

## Ergebnis

Die neue MCP-Aktion `save_georadar_research` speichert einen geprüften Lauf unter einer selbst gewählten Kennung. `AB382` ergibt nach erfolgreicher Speicherung `https://mangold-georadar.vercel.app/AB382`. Die Kennung ist kein Passwort. Bestehende Kennungen werden niemals mit anderen Daten überschrieben. Identische Wiederholungen geben denselben gespeicherten Lauf zurück.

Die Webseite bleibt GeoRadar mit Statusfarben, Filtern, PLZ-Präfixpunkten und Firmenmarkern. Auf einer Kennungsseite lädt sie die Daten aus der serverseitigen Recherche-API. Quellen, Website, Begründung und Gesprächsanlass bleiben erhalten und erscheinen im Firmendetail. Es gibt keine ERP-Verbindung.

## 1. Supabase einrichten

Ein Supabase-Projekt auswählen und in dessen SQL Editor die Datei `supabase/migrations/20261102_georadar_research_runs.sql` ausführen. Sie erstellt die separate Tabelle `public.georadar_research_runs`, aktiviert RLS und gibt weder `anon` noch `authenticated` direkten Tabellenzugriff. Der Server erhält nur SELECT und INSERT; die App bietet keine Lösch-, Überschreib- oder Listenfunktion.

Spalten: `code` (Primärschlüssel), `title`, `payload` (JSON mit records/territories/research), `digest` (Idempotenzprüfung), `created_at`. Ist eine gleichnamige Tabelle bereits vorhanden, vor Ausführung ihre Struktur prüfen. Keine vorhandenen Tabellen oder echten Kundendaten migrieren.

In Vercel → mangold-georadar → Settings → Environment Variables für **Production** hinterlegen:

| Variable | Wert |
| --- | --- |
| SUPABASE_URL | Projekt-URL https://…supabase.co |
| SUPABASE_SECRET_KEY | Serverseitiger Supabase-Secret-Key (`sb_secret_…`), als Secret speichern |
| GEORADAR_TOKEN | Bereits vorhandenen Production-Wert behalten |

Kein Supabase-Key in Langdock, ZIP-Dateien, Browsercode oder GitHub. Kein Publishable-/Anon-Key für den Server verwenden. Bestehende Legacy-Konfiguration `SUPABASE_SERVICE_ROLE_KEY` wird als Alternative unterstützt; neue Einrichtung bevorzugt `SUPABASE_SECRET_KEY`. Anschließend neu deployen. Fehlende Konfiguration führt zu `STORAGE_NOT_CONFIGURED`, fehlende Tabelle zu `STORAGE_SCHEMA_MISSING`; es gibt keinen vermeintlich erfolgreichen Speicher-Fallback.

## 2. Langdock-Integration importieren und verbinden

`Mangold-GeoRadar-Supabase-Integration.zip` über den Import einer Integration einlesen. Das Format entspricht dem bereitgestellten nativen MCP-Export: manifest.json sowie action_manifest.json und leere code.js für native MCP-Aktionen. Die Serverimplementierung liegt auf Vercel, nicht in einer Custom-JavaScript-Aktion.

Name: **Mangold GeoRadar – Supabase**. URL `https://mangold-georadar.vercel.app/mcp`, Transport **Streamable HTTP**, Authentifizierung **Authorization: Bearer** mit dem vorhandenen `GEORADAR_TOKEN`. Den Wert nur im geschützten Verbindungsfeld eintragen. Wenn Langdock den Präfix selbst setzt, nur den Schlüsselwert eingeben.

Server-Features/Werkzeuge neu laden. Es müssen erscheinen: `save_georadar_research`, `load_georadar_research`, `show_georadar_map` und die Kartenressource. Vercel wird für den vereinbarten öffentlichen Dummy-Linkbetrieb auf Standard Protection gestellt: Produktionsdomain öffentlich; Vorschauen und Deployment-URLs weiterhin geschützt. Die MCP- und REST-Schreibaktionen bleiben unabhängig davon Bearer-geschützt. Auf der Produktionsdomain ist deshalb kein zusätzlicher Vercel-Bypass-Header nötig.

## 3. Agent importieren und Aktion zuordnen

`Mangold-LeadRadar-Supabase-Agent.zip` importieren. Der neue Agent heißt **Mangold LeadRadar – GeoRadar Speicher**; der alte Agent wird nicht überschrieben. Kennung, Modus und Titel sind ergänzt; bisherige Recherchefelder und Branchenvorgaben werden übernommen. Der alte Karten-Subagent entfällt, damit keine doppelte Kartenübergabe erfolgt.

Im Agenten unter Aktionen die verbundene Aktion **GeoRadar-Recherche unter Kennung speichern / save_georadar_research** zuweisen; optional `load_georadar_research` zum späteren Laden. Diese einmalige Zuordnung ist notwendig: Der bereitgestellte Agentenexport enthält `actions: []`; eine fremde Workspace-Verbindung kann nicht zuverlässig als bereits verbundene Aktion exportiert oder erfunden werden. Die Importdatei behält das bekannte Format bei und enthält keine unbestätigten Verbindungs-IDs. Ohne Zuordnung meldet der Agent die fehlende Aktion, statt eine Speicherung zu behaupten.

Agent speichern/veröffentlichen. Betriebsmodus zunächst **Dummy-Test (4 fiktive Firmen)** wählen, Kennung z. B. **AB382**, dann starten. Erst wenn `persisted: true` zurückkommt, ist die Speicherung bestätigt. Der Agent gibt ausschließlich die bestätigte `mapUrl` zurück. Bei `CODE_EXISTS` eine neue Kennung verwenden. Reale Rechercheergebnisse dürfen intern gespeichert werden, erhalten aber keine öffentliche Linkfreigabe.

## Öffentliche Links und Datenschutzgrenze

Öffentliche GET-Aufrufe sind nur für Läufe mit `research.mode: "dummy"` und `isFictional: true` in allen records freigegeben. Andere Läufe liefern beim öffentlichen Lesen 404, auch bei bekannter Kennung. Dies prüft die ausdrückliche Datenkennzeichnung, nicht die tatsächliche Herkunft; echte Daten niemals als Dummy markieren. Es werden keine echten Kundendaten für Tests verwendet.

`/api/research?code=AB382` liefert die freigegebenen Dummy-Daten. Es gibt keinen Endpunkt zum Auflisten aller Kennungen. `POST /api/research` und `save_georadar_research` verlangen den vorhandenen Bearer-Token. Der Supabase-Secret bleibt im Server. Suchmaschinen- und Cachefreigabe für Kennungsseiten sind deaktiviert. Kurze Kennungen können erraten werden; in öffentliche Dummy-Datensätze gehören deshalb keine vertraulichen Angaben.

Vor echten öffentlichen/vertriebsinternen Kundendaten muss zuerst ein eigener authentifizierter Leseweg mit Benutzerberechtigungen eingeführt werden. Das Entfernen der Dummy-Prüfung allein ist keine sichere Produktivumstellung. Alternativ bleibt der authentifizierte MCP-Leseweg für bekannte Kennungen verfügbar. Die ursprüngliche Vercel-Einstellung war `all_except_custom_domains`; bei Rückkehr zum vollständig geschützten Betrieb wieder aktivieren und gegebenenfalls den separaten Vercel-Automation-Header in Langdock verwenden.

## Technischer Stand und Tests

`node test/check-research.cjs`: neun Vertragstests mit einem Supabase-Testadapter: Authentifizierung, Validierung, fehlende Konfiguration, Quellen, Idempotenz, Kollisionsschutz, unbekannte Kennungen, Dummy-Lesegrenze und MCP-Speicherung/Laden.

`node test/check-research-browser.cjs`: lokaler vollständiger Ablauf über HTTP-MCP → Supabase-Testadapter → `/AB382` → echter Chrome/MapLibre mit vier sichtbaren Markern (blau/weiß/rot/grau). Alle Quellen und Dummy-Kennzeichnungen bleiben erhalten.

Die Simulation ist ausdrücklich kein Live-Supabase-Test und kein bestätigter Langdock-Import. Echte Migration, serverseitige Supabase-Konfiguration sowie der tatsächliche Langdock-Import/Verbindungsaufruf müssen gesondert bestätigt werden. Keine echten Speichererfolge behaupten, bevor diese Schritte ausgeführt und geprüft sind.

## Quellen

https://supabase.com/docs/guides/getting-started/api-keys
https://supabase.com/docs/guides/database/postgres/row-level-security
https://docs.langdock.com/en/using-langdock/guides/integrations/mcp/mcp

## Veröffentlichung dieses Stands

Auf Vercel veröffentlicht: Produktions-Karte und /AB382 liefern HTTP 200; POST /mcp und POST /api/research ohne Bearer liefern 401; GET /api/research ohne Kennung liefert 400. Der Datenbankabruf liefert derzeit 503 STORAGE_NOT_CONFIGURED. Das bestätigt die fehlende Supabase-Konfiguration und ist kein erfolgreicher Live-Speichertest. Die Importdateien sind strukturell gegen die bereitgestellten Exporte geprüft; ein tatsächlicher Langdock-Import und die Workspace-Aktionszuordnung sind noch offen.
