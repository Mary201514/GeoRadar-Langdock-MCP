# Öffentlicher Dummy-Test in Langdock

Dieser ausdrücklich eingeschaltete Testmodus ändert keine Datei unter dist/, stellt keine ERP-Verbindung her und speichert keine übergebenen Firmen auf dem Server. Bestehende Secrets bleiben unverändert.

## Befristete Freigabe

Production-Konfiguration: GEORADAR_TEST_MODE=public-dummy und GEORADAR_TEST_UNTIL=2026-10-30T14:15:00Z. Ende: 30.10.2026, 15:15 Uhr Europe/Berlin. Nur die exakte Kombination mit gültigem zukünftigem Ablaufdatum deaktiviert die Bearer-Prüfung. Nach Ablauf gilt automatisch wieder der vorhandene GEORADAR_TOKEN; bei ungültigem oder fehlendem Token bleibt der Endpunkt gesperrt. Der Ablauf wird bei jeder Anfrage geprüft, kein Scheduler nötig.

Langdock: URL https://mangold-georadar.vercel.app/mcp, Transport Streamable HTTP, Authentifizierung Keine. Im öffentlichen Test sind weder Authorization noch x-vercel-protection-bypass erforderlich. Werkzeug show_georadar_map auswählen. Beispielprompt: Zeige vier vollständig fiktive Firmen in Deutschland und Österreich mit den vier Statuswerten existing, prospect, priority und unknown. Verwende IDs DUMMY-1 bis DUMMY-4 und Firmennamen mit dem Wort Dummy. Kennzeichne erfundene Testpositionen als approximate; lasse eine Firma ohne Koordinaten.

## Datenregeln und Öffentlichkeit

Höchstens 100 records pro Tool-Aufruf. Jede ID beginnt mit DUMMY-, TEST- oder TECHNICAL-TEST-; jeder Name enthält Dummy, Test oder Fiktiv. Unmarkierte Daten werden zurückgewiesen. Diese Kennzeichnung prüft keine tatsächliche Herkunft; niemals echte Personen-, Kunden- oder ERP-Daten hineinkopieren. Kein zusätzlicher öffentlicher Firmenspeicher und keine Leseschnittstelle für Daten früherer Aufrufe.

Öffentlich sind die Produktions-Karte und ihre statischen Dateien sowie POST /mcp und der gleichwertige Funktionspfad /api/mcp: MCP-Initialisierung, Werkzeugbeschreibung, gebündelte Karten-App und Aufrufe mit eigenen Dummy-Daten. Fremde können diese Endpunkte ohne Anmeldung aufrufen und Vercel-Rechenleistung sowie Datenverkehr auslösen. Die Origin-Prüfung ersetzt keine Authentifizierung gegenüber Server-Clients. Vercel-Standardschutz bleibt aktiv; kein zusätzlicher persistenter Rate-Limiter wurde eingeführt. Secrets werden nicht ausgeliefert. Build-/Quellcode- und Log-Schutz werden nicht abgeschaltet.

Vercel Authentication wird auf Standard Protection (prod_deployment_urls_and_all_previews) gestellt: die Produktionsdomain ist öffentlich, Vorschauen und Deployment-URLs bleiben geschützt. Das Ablaufdatum schließt automatisch die MCP-Bearer-Prüfung, stellt aber den Vercel-Schutz nicht automatisch zurück.

## Vor Produktivbetrieb zurückstellen

1. In Vercel Settings → Environment Variables GEORADAR_TEST_MODE auf disabled setzen oder die zwei neuen TEST-Variablen entfernen. GEORADAR_TOKEN unverändert behalten. Neu deployen. Nach dem Ablauf ist Bearer bereits automatisch Pflicht; die Schalter trotzdem bereinigen.
2. In Settings → Deployment Protection wieder den zuvor aktiven Schutz für die Produktionsdomain einschalten (vorherige Einstellung: all_except_custom_domains). Keine Quellcode-/Log-Freigabe aktivieren.
3. In Langdock wieder Authorization: Bearer mit dem vorhandenen Production-Token eintragen. Bei aktivem Vercel-Anmeldeschutz zusätzlich einen eigenen x-vercel-protection-bypass aus Protection Bypass for Automation verwenden.
4. Ohne Token und mit falschem Token muss /mcp 401 liefern; mit gültigem Token initialize, tools/list und einen ausschließlich fiktiven tools/call prüfen. Ressourcen und Kartenanzeige im konkreten Langdock-Workspace testen.
5. Alte öffentliche Test-Deployments nicht erneut als Production zuordnen. Ihre Dummy-Freigabe verfällt ebenfalls zum festen Zeitpunkt; Vorschau-/Deployment-URLs bleiben durch Vercel geschützt.

Tests: node mcp/check-public.cjs prüft lokal auch Ablauf und Wiederherstellung von Bearer. node mcp/check-public.cjs https://mangold-georadar.vercel.app prüft öffentliche HTTPS-Aufrufe ohne Token, Cookies oder Bypass. Die tatsächliche Langdock-iframe-Darstellung erfordert einen Test im Benutzer-Workspace.
