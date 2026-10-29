# Deployment-Verifikation

Code: e32166393ea7a6e65321144de99f73e2864dc73b, Branch georadar-marker-mcp-v2.

- Lokaler MCP-Kern: bestanden (node mcp/check.cjs).
- Lokaler Vercel-Transport: bestanden (node mcp/check-vercel.cjs).
- Frontend: git diff --exit-code -- dist erfolgreich, keine Kartenänderung.
- Vercel Preview dpl_DC4BYXpW74FC2oY3an17sTo8RTxd: READY; 14 HTTPS-Prüfungen bestanden. Separater Preview-Token, kein Production-Secret ausgelesen.
- Erfolgreich: fehlender/falscher Bearer 401; authentifizierter GET 405; initialize; notifications 202; show_georadar_map in tools/list; gebündelte MCP-App; strukturierte Dummy-Daten; ungültige Firmendaten; Origin 403; Content-Type 415; Protokollfehler 400; ungültiges JSON 400; Karte erreichbar.
- Production dpl_Edf5QYdZLA4ycJ7X6AkjswPqcmo7: READY, Alias https://mangold-georadar.vercel.app zugeordnet.
- Production /mcp: vorläufig HTTP 503 bei vorhandener Production-Variable. Die Fail-closed-Konfigurationsprüfung wird ausgelöst: gültiger GEORADAR_TOKEN mit 32–512 Zeichen ohne Whitespace erforderlich. Korrektur beim Eigentümer angefordert; danach neues Deployment und erneuter Test nötig.
- Echte Langdock-Verbindung und iframe-Darstellung im konkreten Workspace: noch offen. Vercel Deployment Protection bleibt aktiv; separater Automation-Bypass-Header erforderlich.
- Kurzlebige Testzugänge werden widerrufen. Keine Tokens im Bericht oder Repository.

## Erneute Production-Prüfung

- Erneutes Deployment nach bestätigter Token-Korrektur: dpl_UqjiWcoHQbV6tM7V4YkmbRmChHWT, READY. /mcp weiterhin HTTP 503.
- Zusätzliche sichere Fehlerdiagnose im MCP-Transport; nur die Kategorie wird serverseitig protokolliert, niemals Schlüsselwert, Länge oder Headers.
- Commit 058f7002f8e62dcc87d38ab9344ca7450289f0db auf georadar-marker-mcp-v2.
- Deployment mit Diagnose: dpl_Bg1pQBVPhYsi923QNoZXMURDA2yG, READY, Production-Alias korrekt zugeordnet.
- Tatsächliches Runtime-Log: GeoRadar MCP configuration: too_short. Der im Deployment verwendete Production-Wert enthält weniger als 32 Zeichen. Korrektur mit hinreichend langem zufälligem Token angefordert.
- node mcp/check-vercel.cjs weiterhin erfolgreich; Kartendateien unverändert.
- Authentifizierter Production-Werkzeugaufruf und echter Langdock-Test weiterhin offen. Frühere 14 Preview-Tests bleiben erfolgreich; sie ersetzen keinen Production-Login.

## Production nach Korrektur der richtigen Umgebungsvariable

- Die letzte Token-Änderung betraf nun die Production-Zeile. Nur Metadaten geprüft; kein Schlüsselwert ausgelesen.
- Deployment dpl_Ezh23SJ23PfaWYugSGkDSC9Xwnto: READY und https://mangold-georadar.vercel.app zugeordnet.
- Drei tatsächliche HTTPS-Prüfungen erfolgreich: fehlender Bearer 401, falscher Bearer 401, bestehende Karte HTTP 200.
- Der Konfigurationsfehler 503 ist behoben. Die serverseitige Konfigurationsprüfung akzeptiert den hinterlegten Wert.
- Die Prüfung fand hinter der weiterhin aktiven Vercel Deployment Protection mit kurzlebigem Testzugang statt; dieser wird anschließend widerrufen.
- Die 14 authentifizierten Preview-Tests belegten Werkzeugerkennung und Dummy-Datenübergabe mit separatem Test-Token. Ein gültiger Bearer-Aufruf in Production wurde nicht durchgeführt, weil der Production-Token nicht ausgelesen wird. Der echte Langdock-Login und die iframe-Darstellung bleiben offen.
- Verbindung: https://mangold-georadar.vercel.app/mcp, Streamable HTTP, Authorization: Bearer mit dem Production-Token. Zusätzlich bei aktiver Deployment Protection: separater x-vercel-protection-bypass aus Vercel Protection Bypass for Automation.
- Keine Änderungen an den Kartendateien, keine ERP-Anbindung, keine Schlüssel im Repository.
