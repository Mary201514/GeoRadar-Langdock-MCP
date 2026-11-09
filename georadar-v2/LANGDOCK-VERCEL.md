# Langdock – sicherer GeoRadar-MCP-Endpunkt auf Vercel

Der Adapter `api/mcp.mjs` liefert den vorhandenen MCP-Kern über Vercel Functions aus. `vercel.json` schreibt `/mcp` auf `/api/mcp` um. Die vorhandenen Dateien unter `dist/` bleiben unverändert. Keine ERP-Anbindung und keine Speicherung von Unternehmensdaten.

## Schnittstelle

- Adresse nach erfolgreicher Veröffentlichung: `https://mangold-georadar.vercel.app/mcp`.
- Transport: stateless Streamable HTTP, JSON-Antworten auf POST. Kein lang laufender SSE-Kanal erforderlich. GET wird authentifiziert mit 405 abgewiesen; dies ist nach MCP-Spezifikation zulässig. Benachrichtigungen erhalten 202 ohne Body. Keine Session-ID und kein gemeinsamer Kundenspeicher zwischen Aufrufen.
- Unterstützte MCP-Versionen: 2025-03-26, 2025-06-18, 2025-11-25. Unbekannte Version im HTTP-Header wird abgewiesen; initiale Versionsverhandlung findet bei initialize statt.
- Authentifizierung: `Authorization: Bearer <GEORADAR_TOKEN>`; ausschließlich serverseitig aus der Umgebungsvariable. Kein eingebauter Ersatzschlüssel. Fehlender/zu kurzer Wert: 503, fehlender/falscher Bearer: 401. Token-Vergleich mit konstant langer SHA-256-Darstellung und timingSafeEqual.
- Content-Type application/json. JSON-RPC-Objekte statt Batch-Anfragen. Maximal 2 MiB Request und 4 MiB serialisierte Antwort, unterhalb von Vercels Plattformlimit. Große Unternehmensbestände ggf. vor dem Aufruf eingrenzen.
- Origin-Prüfung, keine offene CORS-Freigabe. Cache-Control no-store. Keine Tokens, Header oder Unternehmensdaten in Logs.
- Werkzeug `show_georadar_map`; bestehendes Datenmodell und Statusfarben bleiben erhalten. UI-Ressource `ui://georadar/map-v1.html`, `text/html;profile=mcp-app`, gebündelt einschließlich Kartenbibliothek, Logo und Styles.

## GEORADAR_TOKEN hinterlegen

1. Vercel öffnen, Team **mangold-maria**, Projekt **mangold-georadar**.
2. **Settings → Environment Variables → Add Environment Variable** öffnen.
3. Key: `GEORADAR_TOKEN`. Value: selbst erzeugter zufälliger Wert mit mindestens 32 Zeichen, ohne Leerzeichen. Als **Secret/Sensitive** speichern.
4. **Production** auswählen. Keine `NEXT_PUBLIC_`- oder `VITE_`-Präfixe verwenden. Wert weder in GitHub noch in einen Chat kopieren.
5. Nach jeder Änderung neu deployen. Ein bereits gebautes Deployment bekommt neue Umgebungsvariablen nicht nachträglich.
6. Den gleichen Wert ausschließlich im geschützten API-Key-Feld der Langdock-Verbindung eintragen.

Für lokale Tests wird ein Zufallswert nur im Prozess erzeugt. Für einen authentifizierten Remote-Test kann ein separater **Preview**-Secret benutzt werden; Production-Secret wird nicht ausgelesen oder überschrieben. Ein Preview-Test ist noch kein erfolgreicher Login aus dem konkreten Langdock-Workspace.

## Langdock einrichten

Integrationen → MCP Server verbinden:

- Name: Mangold GeoRadar
- URL: `https://mangold-georadar.vercel.app/mcp`
- Transport: Streamable HTTP
- Authentifizierung: API Key
- Header-Typ: Authorization: Bearer
- API Key: eigener Production-GEORADAR_TOKEN, ohne zusätzliches Wort Bearer, wenn Langdock den Präfix selbst setzt.

Danach „List Server Features“ ausführen, `show_georadar_map` und die UI-Ressource auswählen und dem Mangold-LeadRadar-Agenten zuweisen. Jeder Werkzeugaufruf liefert den gewünschten vollständigen records-Bestand; leerer Bestand entfernt bisherige Firmen aus der Ansicht. Ausschließlich belegte Koordinaten oder ausdrücklich ungefähre Testpositionen verwenden.

## Zweite Schutzebene: Vercel Authentication

Der vorhandene Vercel-Anmeldeschutz wird durch diese Änderung **nicht abgeschaltet**. Bei aktiviertem Vercel Authentication kann Langdock vor dem MCP-Handler an einer Vercel-Loginseite scheitern. Ein GeoRadar-Bearer allein überwindet diese vorgelagerte Schutzebene nicht.

Wenn der Schutz aktiv bleibt: In Vercel **Settings → Deployment Protection → Protection Bypass for Automation** einen eigenen Schlüssel für Langdock anlegen. In Langdock zusätzlich den benutzerdefinierten Header `x-vercel-protection-bypass` mit genau diesem Vercel-Schlüssel konfigurieren. Dieser zweite Schlüssel ist ein anderer Wert als GEORADAR_TOKEN und darf ebenfalls weder in GitHub noch im Chat stehen. Er gewährt Zugriff auf geschützte Deployments dieses Projekts; nur für diese Verbindung verwenden und bei Bedarf widerrufen. Ohne diesen Header muss eine andere ausdrücklich freigegebene Zugriffsarchitektur eingerichtet werden. Kurzlebige Testfreigaben werden nicht als dauerhafte Langdock-Verbindung ausgegeben.

## MCP Apps in Langdock

Die offizielle Langdock-Dokumentation beschreibt Streamable HTTP, API-Key-/Bearer-Authentifizierung, Custom Headers sowie interaktive MCP Apps. GeoRadar liefert die standardisierte UI-Ressource und den bestehenden Parent-Handshake. Partielle Tool-Eingaben werden nicht als endgültiger Bestand verarbeitet. Die Karte benötigt im iframe WebGL, Blob-Worker und Netzwerkfreigabe für `https://tiles.openfreemap.org` (Kacheln, Sprites, Glyphen); diese Quellen sind in den Resource-CSP-Metadaten angegeben. Der konkrete Mangold-Workspace muss diese Funktionen zulassen. Lokaler iframe-Test und Resource-Test ersetzen keinen echten Langdock-Render-Test.

## Reproduzierbare Tests

- `node mcp/check.cjs`: bestehendes Datenmodell und MCP-Kern.
- `node mcp/check-vercel.cjs`: serverloser Adapter, Fail-closed-Konfiguration, Bearer, Origin, Methoden, Header, Größenlimit, Protokollverhandlung, Benachrichtigungen, Werkzeug und UI-Ressource.
- `node mcp/check-remote.cjs`: Remote-Requests; Test-Zugangsdaten werden nur über versteckte Standardeingabe übergeben, nicht als Kommandozeilenargument und nicht gespeichert. Kein Production-Secret muss ausgelesen werden. Der Testbericht enthält nur URL, Namen und Anzahl bestandener Prüfungen.

GitHub enthält ausschließlich Code, Konfigurationen und Hinweise. Der Secret bleibt in Vercel/Langdock. Es gibt keine ERP-Verbindung.

## Quellen

- MCP Streamable HTTP: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- MCP Apps: https://modelcontextprotocol.io/extensions/apps/overview
- Langdock: https://docs.langdock.com/en/using-langdock/guides/integrations/mcp/mcp
- Vercel Functions: https://vercel.com/docs/functions/functions-api-reference
- Vercel Protection: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
