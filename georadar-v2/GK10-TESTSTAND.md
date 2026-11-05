# GK 10 – Teststand vom 05.11.2026

Basis: Repository Mary201514/GeoRadar-Langdock-MCP, Branch georadar-marker-mcp-v2, Commit 158b0ed2ec167e70e6629fc959b6ff359fe3bc48. Änderungen ausschließlich auf georadar-gk10-test. Keine Produktionsfreigabe erteilt.

## Verhalten

CO 93 grün #16A34A, SR 42 orange #F97316, SH 11 violett #7C3AED, GD 2 türkis #0D9488, GK 10 gelb #EAB308. Statusfüllfarben bleiben blau/weiß/rot/grau. Neutrale Cluster behalten ihre bisherige Farbe; Vertreterringe erscheinen auf einzelnen Firmenmarkern.

Vertreterauswahl ist mehrfach möglich, Standard Alle Vertreter, Nicht zugeordnet bleibt vorhanden. Marker, Ergebnisliste, gefilterte Anzahl und Statuskennzahlen verwenden denselben gefilterten Bestand. Ringe sind pro Vertreter ein-/ausblendbar. Eine ausgeblendete Ringebene verändert keine Zuordnung.

Explizite salesRep-Angaben haben Vorrang; andernfalls gelten Personalnummern. Nur ohne beide Angaben greifen bestehende benutzerdefinierte PLZ-Regeln. Unbekannte explizite Angaben bleiben unverändert. Mehrfachtreffer bei überlappenden konfigurierten Personalnummern oder PLZ-Regeln bleiben möglich. Vorhandene Daten werden weder umverteilt noch zurück in Supabase geschrieben. Alte Vier-Vertreter-Konfigurationen bleiben gültig und behalten GK 10 als zusätzlichen Standard.

GK 10 ist fachlich für alle PLZ-Gebiete in Deutschland/Österreich verfügbar: Pumpen, Rührwerke, Kläranlagen, Kommunen, Bäderbetriebe. Bei einem unzugeordneten neuen Lead (prospect/priority) erscheint ein fachlicher Vorschlag. Der Vorschlag setzt weder salesRep noch personnelNumber und wird bei bestehenden Zuordnungen unterdrückt. "Alle PLZ" ist fachliche Verfügbarkeit und keine automatische Zuordnung aller Firmen zu GK.

## Import und Bestandsaufnahme

Der geprüfte Ausgangsstand enthielt sichtbaren JSON-Import, vier Vertreter und eine Einfachauswahl. Ein aktiver Excel-/CSV-Importer und ein gesonderter LeadRadar-3.0-Connector waren dort nicht vorhanden. Die vorhandene LeadRadar-/Langdock-MCP-Verbindung bleibt erhalten; ihre Agentvorlage wurde um GK ergänzt. Eine Änderung im Langdock-Konto oder ein Neuimport wurde nicht durchgeführt.

Zusätzlich zu JSON unterstützt der Import jetzt UTF-8-CSV/TSV und Excel .xlsx, erstes Tabellenblatt, maximal 5 MB / 10.000 Firmen. Spalten Firma/Name und Land/country erforderlich; Vertreter wird salesRep zugeordnet. GK, GK 10, GK · 10 und Personalnummer 10 werden erkannt. Kundenstatus kann weiterhin über bestehende Aliasnamen oder existing/prospect/priority/unknown angegeben werden. Führende PLZ-Nullen bleiben als Text oder über ein Excel-Zahlenformat wie 00000 erhalten; eine bereits als unformatierte Zahl gespeicherte PLZ wird nicht geraten. .xls/.xlsb, passwortgeschützte Dateien und nicht-UTF-8-CSV sind nicht zugesagt. Keine Formelausführung und keine automatische Geocodierung. Ein fehlerhafter Import ersetzt den Bestand nicht.

SheetJS CE 0.20.3 Mini ist lokal eingebunden, mit Apache-2.0-Lizenz. Kein neuer externer Browserdienst. Quelle und Prüfsumme siehe dist/licenses/SheetJS-SOURCES.txt.

## Geänderte Dateien

- dist/representatives.js: zentrale fünf Vertreter, Alias-Erkennung und fachlicher Vorschlag.
- dist/data-model.js: fünf Gebietsdefinitionen, rückwärtskompatibel zu bisherigen vier.
- dist/territories.js: Mehrfachfilter, Personalnummern, Legende und farbige Ringe.
- dist/companies.js: gemeinsamer Filterbestand, Kennzahlen, Vertreter-/Vorschlagsanzeige und Dateiupload.
- dist/company-import.js: CSV-/Excel-Spaltenzuordnung und validierter Import.
- dist/index.html, dist/style.css: lokale Scripts, Legende und Filterdarstellung.
- dist/xlsx.mini.min.js und dist/licenses/SheetJS-*: festgelegte Excel-Lesebibliothek und Lizenz.
- mcp/bundle.cjs: zusätzliche lokale Scripts auch in eingebetteter Kartenressource.
- mcp/server.cjs: ausschließlich additive Gebiets-Schemaerweiterung auf fünf Codes; dieselben Werkzeugnamen und Adressen.
- mcp/update-info.cjs, langdock/agent-manifest.json, langdock/tool-schemas.json, scripts/build-langdock-imports.py und README.md: GK konsistent in Vorlagen und Dokumentation.
- test/check-representatives.cjs und test/check-representatives-browser.cjs: neue Funktions- und Browsertests.

API-Handler, MCP-Transport, Authentifizierungslogik, Vercel-Konfiguration, Secrets, Datenbankverbindung und Supabase-Tabellen sind unverändert. Die mitgelieferten früheren ZIP-Sicherungen werden nicht überschrieben oder als GK-10-Version ausgegeben.

## Erfolgreiche Prüfungen

- node test/check-representatives.cjs: fünf Codes/Farben, Vertreter-Aliase, CSV, unveränderte Zuordnungen, alle GK-Fachgebiete, alte Gebietsregeln und additive MCP-Schemata.
- node test/check-representatives-browser.cjs: echter Chrome/MapLibre mit OpenFreeMap, sechs fiktive Firmen; alle fünf Einzel- und Mehrfachfilter; Nicht zugeordnet; Status-, Land- und PLZ-Kombinationen; Ring ein/aus; Listeneinträge und Kennzahlen synchron; CSV und echte XLSX-Datei einschließlich PLZ 01067; ungültiger Import erhält Bestand; keine JavaScript-Fehler.
- node mcp/check.cjs: bisherige Validierung, Datenübergabe, Kartenbundle und HTTP-Basistests.
- node mcp/check-vercel.cjs: bestehende Bearer-Authentifizierung, fail-closed Konfiguration, Methoden, Größenlimits und MCP-Protokoll.
- node mcp/check-app-bridge.cjs: Parent-/Origin-Bindung, Initialisierung und Werkzeugergebnis-Übergabe.
- node mcp/check-postal-prefix.cjs: zweistellige DE-/AT-Präfixe und bisherige PLZ-Funktionen.
- node test/check-research.cjs: neun Speicher-Vertragstests mit Testadapter, kein Zugriff auf echte Supabase-Daten.
- node mcp/bundle.cjs: Kartenressource erfolgreich gebündelt; eingebettetes JSON weiterhin unter dem bestehenden 4-MB-Testlimit.
- Python-Syntaxprüfung scripts/build-langdock-imports.py erfolgreich.

Kein allgemeiner npm-Build vorhanden: Das Projekt ist Buildless HTML/CSS/JavaScript. Screenshots und maschinenlesbarer Browsertestbericht liegen lokal unter verification/. Tatsächliche Langdock-Chatdarstellung und produktive Speicherung wurden für diesen Branch nicht getestet. Vor produktiver Veröffentlichung sind Benutzerprüfung und ausdrückliche Freigabe erforderlich.


## Vercel-Preview

URL: https://mangold-georadar-e78ksketv-mangold-maria.vercel.app
Deployment: dpl_3tBuUSBRFZSbt4wg3u6jdFCtz9H8 (READY; Preview, kein Production-Target).
App-Code-Commit: cc6f3c619175edfb67e0c30d3cd5efd6af9fc811. Die Produktionsadresse zeigt weiterhin das vorherige Deployment dpl_7qWFXTWSYD577P7HrPmhqRXfqcox.

Die Vorschau startet ohne automatisch geladene Firmen. Über Datei / JSON übernehmen die Datei test/gk10-dummy.json importieren: fünf Vertreter und ein unzugeordneter Pumpen-Lead. Für Vercel Deployment Protection kann die Anmeldung am vorhandenen Vercel-Konto nötig sein. Es wurden keine Supabase-Secrets für Preview hinterlegt; der Abruf gespeicherter Recherchen ist dort nicht Teil dieser Prüfung.

Zusatzprüfung: `node mcp/check-embedded.cjs` erfolgreich. Die gebündelte MCP-Karte lädt in einer lokalen Browser-Sandbox mit CSP alle neun angeforderten OpenFreeMap-Ressourcen, zeigt vier fiktive Firmen in den bestehenden Statusfarben und meldet keine JavaScript-Fehler. Das ist ausdrücklich keine Bestätigung der Darstellung im echten Langdock-Chat.
