# GeoRadar 3.0 – Analyse und private Speicherung

Test-Branch: `georadar-3-analysis-save-preview`, Basis `16526299fe512171e395a2d1b2bb13866177ed13` des geprüften GK-10-Teststands. Keine Produktionsfreigabe erteilt; vorhandenes Vercel-Projekt und vorhandene Supabase-Datenbank werden weiterverwendet.

## Bestandsaufnahme

| Bereich | Vorhanden | Ergänzung |
| --- | --- | --- |
| Vertreter | Fünf Vertreter, Mehrfachfilter, Ringfarben, GK-Fachvorschläge im GK-Teststand | Zuständigkeiten SR/CO/SH/GD, mehrere fachliche Vorschläge |
| Auswertung | Filter und Statuskennzahlen | Explizite Analyseauswahl, Dashboard und Zusammenfassung |
| Ausgabe | Unternehmens-JSON und Ansichts-JSON | Filterbezogenes CSV, Excel, Text, PNG und PDF |
| Speicherung | Supabase-Recherchen unter Kennung, geschützter MCP-Schreibweg | Private benannte Ansichten/Recherche-Schnappschüsse, Web-Anmeldung, Eigentümerprüfung und Übersicht |

## Zuständigkeiten

- SR 42: links der B30 in Richtung Friedrichshafen → Ulm; Industriekunden.
- CO 93: rechts der B30 in derselben Fahrtrichtung; zusätzlich Vorarlberg; Industriekunden.
- SH 11: Deutschland und Österreich; Antriebstechnik, Danfoss.
- GK 10: alle PLZ-Gebiete; Pumpen, Rührwerke, Kläranlagen, Kommunen, Bäderbetriebe.
- GD 2: alle PLZ-Gebiete; Pumpenmarken Flygt, Lowara, Jung, KSB, Grundfos.

SR-/CO-PLZ-Grenzen sind unbestätigt. Es gibt keine B30-Koordinatenheuristik, keine automatisch erzeugten Gebietsgrenzen und keine Umverteilung. Fachliche Vorschläge für neue unzugeordnete Leads verändern weder salesRep noch personnelNumber. Bestehende ausdrücklich gesetzte Zuordnungen bleiben erhalten. Farben und Statusfüllungen entsprechen dem GK-Teststand.

## Analysen und Ausgabe

Alle Analysen sind standardmäßig aus. Erst ausdrückliche Auswahl und **Auswertung starten** führen verfügbare Analysen aus. Danach werden Ergebnisse mit aktiven Filtern aktualisiert.

Implementiert: Kunden-/Leadverteilung (Status und Länder), Vertreteranalyse mit Nicht zugeordnet und Hinweis auf Überlappungen, Branchen-/Standortanalyse mit Standortqualität. Das Management-Dashboard nutzt ausschließlich tatsächlich geladene, gefilterte Datensätze. Keine Hochrechnung auf den Gesamtmarkt.

Deaktiviert und begründet: White-Spot-Analyse, regionale Potenzialanalyse sowie Kundenabdeckung/Marktlücken. Für diese fehlen Gesamtmarkt-, Potenzial-, Abdeckungs- bzw. bestätigte Gebietsgrundlagen. Es gibt keine vermeintlichen Analyseergebnisse.

CSV und Excel enthalten den aktuell gefilterten Bestand. Die Zusammenfassung enthält nur ausgeführte Analysen. CSV schützt Textzellen vor Formelinterpretation; Excel schreibt diese als Text. PNG/PDF bilden den sichtbaren Kartenausschnitt mit Legende, Datenstand und Attribution ab. PDF ist eine einseitige Rasterkarte, kein editierbarer Vektorplan. Der bisherige Ansichts-JSON- und Unternehmens-JSON-Export bleibt erhalten. Die tatsächlichen Downloads wurden im Browser geprüft; PDF zusätzlich mit pypdf geöffnet, mit Poppler gerendert und visuell geprüft.

## Speichern und wieder öffnen

**Ansicht speichern** erlaubt einen Namen und drei Speicher-/Exportarten:

1. Kartenansicht: Kamera, Zoom, Filter, Vertreterauswahl, Analyseauswahl, Aktivierungszustand und sichtbare Ebenen. Eine vorhandene gespeicherte Recherche kann als Referenz verwendet werden. Ohne Datenquelle werden keine Firmendaten dupliziert; beim Öffnen bleibt die Ansicht dann ohne Firmen. Importierte PLZ-Polygondateien sind lokale Zusatzdateien und müssen separat aufbewahrt/erneut geladen werden; die gespeicherte Ebenenauswahl ersetzt keinen Polygon-Datensatz.
2. Recherche einschließlich Ansicht: unveränderliche Kopie aller geladenen Firmen, nicht nur der aktuell gefilterten Teilmenge, samt Ansicht. Damit kann der Bestand später erneut gefiltert werden. Ein erneutes Speichern erzeugt eine neue UUID; bestehende Datenstände werden nicht überschrieben.
3. PNG/PDF: tatsächlicher Dateiexport, ohne Cloud-Speicherung oder Anmeldung.

Private Links haben die Form `https://<bereitstellung>/?view=<UUID>`. Sie enthalten keine Zugangsdaten oder API-Tokens. Die Kennung ersetzt keine Zugriffsprüfung. Jede Listen-/Öffnen-/Speicheranfrage prüft die Sitzung und den Benutzer. Ein fremder bekannter Link liefert 404; ohne Sitzung 401. **Gespeicherte Auswertungen** zeigt ausschließlich eigene Einträge mit Name, Datum, Art und Öffnen-Link, seitenweise 50 Einträge.

Private Forschungskopien sind vom ursprünglichen öffentlich lesbaren Dummy-System getrennt. `/AB382` und die vorhandenen MCP-Aktionen bleiben unverändert. Die neue private API bietet kein anonymes Lesen, kein Aktualisieren und kein Löschen gespeicherter Datenstände. Nach neuem Datenimport kennzeichnet die Oberfläche den veränderten Arbeitsstand; der ursprüngliche Datenstand und seine Prüfsumme bleiben erhalten.

## Anmeldung und Konfiguration

Vorhandenes Projekt: `vljhiyxgcbfjyytopxnl`, Frankfurt. Keine neue Datenbank, keine Änderung an den bisherigen Recherche- oder Monteur-Tabellen und keine Änderung der Supabase-Auth-Provider.

Additive Tabellen: `georadar_saved_views` und `georadar_web_sessions`, beide mit RLS. Ansichten sind nur für ihren owner_id les-/anlegbar; keine UPDATE-/DELETE-Rechte. Sitzungen sind ausschließlich serverseitig zugänglich. Migration wurde mit dem nativen Supabase-Migrationstool angewandt; SQL-Vorlage: `backend/private-views-setup.sql`. Vor erneutem Anwenden Tabellen/Migrationshistorie prüfen; das SQL ist keine Aufforderung zur wiederholten Ausführung.

Neue Web-API: `/api/auth` und `/api/views`. Bestehende `/mcp`, `/api/research`, Bearer-Authentifizierung und Supabase-Rechercheverbindung bleiben unverändert. Anmeldungen verwenden bestätigte Supabase-Auth-Benutzerkonten mit E-Mail/Passwort. Ein Supabase-Dashboard-Projektkonto allein ist kein solches Benutzerkonto. Administrator kann es unter Authentication → Users anlegen. Bestehende MFA-Konten werden nicht auf eine schwächere Anmeldung zurückgestuft; sie benötigen einen späteren MFA-Anmeldepfad.

Auth-Access-Tokens bleiben AES-256-GCM-verschlüsselt in der serverseitigen Sitzungstabelle, Passwörter und Refresh-Tokens werden nicht gespeichert. Im Browser gibt es keine Supabase-Tokens, keine API-Schlüssel und keinen localStorage-/sessionStorage-Login. Nur eine opaque Sitzungscookie-Kennung wird gesetzt: HttpOnly, Secure auf HTTPS, SameSite=Strict. Sitzung höchstens eine Stunde; danach erneut anmelden. Jede Anfrage prüft den Auth-Benutzer erneut beim Auth-Dienst. URLs und JSON-Antworten enthalten keine Auth-Tokens. Logout entfernt die Sitzung. Origin-, JSON-/Größen- und CSRF-Header-Prüfungen sind implementiert. Supabase-Auth-eigene Begrenzungen gelten zusätzlich zur lokalen Fehlversuchsbegrenzung; eine projektweite Firewall-/Login-Rate-Limit-Regel ist keine behauptete Funktion dieses Branches.

Erforderliche serverseitige Variablen für die neue Preview:

- `SUPABASE_URL`: vorhandene Projekt-URL, für Preview ergänzt.
- `SUPABASE_SECRET_KEY`: vom Benutzer separat für Preview zu hinterlegen; Production-Zeile nicht ändern.
- `GEORADAR_WEB_SESSION_KEY`: eigener zufälliger Secret-Wert, ausschließlich für Preview angelegt. Unabhängig vom bestehenden MCP-Token.

Vercel hat für dieses Projekt keine direkte Git-Verbindung; deshalb unterstützt die API derzeit keine branch-spezifischen Variablen. Die neuen Variablen sind auf Preview beschränkt. Production und `GEORADAR_TOKEN` wurden nicht geändert. Vor einer später ausdrücklich genehmigten Produktivveröffentlichung muss für Production ein eigener `GEORADAR_WEB_SESSION_KEY` eingerichtet werden; fehlende Konfiguration bleibt gesperrt. In der eingebetteten MCP-App ist Cloud-Speicherung nicht freigeschaltet: Sie verweist zur eigenständigen Webseite und übernimmt keine dortigen Web-Sitzungen.

## LeadRadar

Die Agentvorlage hat eine optionale Auswahl **Geografische Auswertung**. Ohne ausdrückliche Auswahl oder ausdrücklichen Benutzerwunsch keine GeoRadar-Aktionen und kein Kartenlink. Die bestehenden MCP-Werkzeuge und Endpunkte wurden nicht ersetzt. Die Vorlage wurde nicht im Langdock-Konto installiert/veröffentlicht; der tatsächliche LeadRadar-3.0-Chatablauf und die echte eingebettete Langdock-Darstellung sind weiterhin getrennt zu prüfen.

## Tests

- `node test/check-private-views.cjs`: sieben Testgruppen für Login-/Cookie-/Tokenverhalten, zwei Eigentümer, unberechtigte bekannte Links, unveränderliche Datenstände, Eingabeprüfung, Logout/Ablauf, Analysen und Spezialisierungen. Supabase/Auth-Testadapter.
- `node test/check-v3-browser.cjs`: echter HTTP-Server und Chrome/MapLibre; Auswahl ohne Autostart, Dashboard, tatsächliche CSV/XLSX/Text-/PNG-/PDF-Downloads, Anmeldung mit zwei fiktiven Konten, Kamera/Zoom/Filter/Analysen/Ebenen wiederherstellen, private Referenzansichten, erneutes Filtern und Erhalt des ursprünglichen Datenstands. Kein echter Auth-Benutzer und keine echten Kundendaten.
- Bestehende Kern-, Vertreter-, PLZ-, MCP-Transport-/Bearer-, App-Bridge- und neun Speicher-Vertragstests erfolgreich.
- `node mcp/check-embedded.cjs`: echte lokale Browser-Sandbox, vier Marker, bisherige Statusfarben, elf Kartenressourcen erfolgreich, keine JavaScript-Fehler. Kein echter Langdock-Test.
- `node mcp/bundle.cjs`: Kartenpaket gebaut; bestehendes Größenlimit eingehalten. Buildless HTML/CSS/JavaScript, kein npm-Build definiert.
- Python-Syntaxprüfung der Agentpaket-Erstellung erfolgreich.
- Reale Supabase-Migration, Eigentümer-RLS-Policies und Tabellenrechte geprüft. Kein anonymer Tabellenzugriff; Sitzungstabelle auch für authenticated gesperrt. Advisor-Info zu fehlenden Policies auf rein serverseitigen Tabellen ist hier absichtlich deny-all. Ein bereits bestehender Advisor-Hinweis auf monteur_role wurde nicht verändert.

Offen bleiben die vom Benutzer angekündigte Preview-Secret-/Benutzerkonto-Einrichtung und der tatsächliche Login-/Speicheraufruf mit diesem Konto. Keine echten privaten Speichervorgänge behaupten, bevor sie bestätigt sind. Produktion bleibt bis zur Freigabe unverändert.

## Wesentliche Dateien

- `dist/representatives.js`, `territories.js`, `companies.js`: Zuständigkeiten und konsistente Filter/Label.
- `dist/analysis-model.js`, `analysis-ui.js`: auswählbare Analysen, Dashboard und Ergebnisexport.
- `dist/view-model.js`, `saved-views.js`: Ansichtsformat, private Oberfläche, Kamera-/Filterwiederherstellung und Bildexport.
- `backend/private-views.cjs`, `private-views-setup.sql`, `api/auth.mjs`, `api/views.mjs`: zusätzliche private Speicher-/Anmeldungswege.
- `dist/index.html`, `style.css`, `app.js`, `saved-research.js`, `mcp/bundle.cjs`: Integration in die bestehende Anwendung.
- `serve.cjs`, `vercel.json`, `.env.example`: additive Web-Routen und Konfiguration; keine Secret-Werte.
- `langdock/agent-manifest.json`, `scripts/build-langdock-imports.py`: explizit optionale geografische Übergabe.
- `test/check-private-views.cjs`, `fake-private-storage.cjs`, `check-v3-browser.cjs`: neue Tests.

Dokumentation: https://supabase.com/docs/guides/auth/passwords und https://supabase.com/docs/guides/auth/server-side/advanced-guide.
