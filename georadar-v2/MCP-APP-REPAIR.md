# MCP-App: Kartenressourcen und Unternehmensmarker

Die Webseite unter dist/ wurde unverändert belassen. Nur die gebündelte MCP-App verwendet jetzt mcp/app-bridge.js. Ressourcenadresse ui://georadar/map-v2.html; map-v1.html bleibt als Lesealias unterstützt. Werkzeugname und Bearer-Authentifizierung bleiben unverändert.

## Änderungen

- Gleiche CSP an resources/list und resources/read, einschließlich tiles.openfreemap.org für HTTPS, blob: für lokale Worker-/GeoJSON-Verbindungen und data: für eingebettete Bildressourcen. Keine pauschale HTTPS-Wildcard. Der Host muss Blob-Worker erlauben; Ressourcenmetadaten können eine strengere Host-CSP nicht lockern. Bei tatsächlicher CSP-Verletzung zeigt nur die MCP-App einen konkreten Hinweis statt ausschließlich des allgemeinen Ladehinweises.
- Vollständige ui/notifications/tool-input-Argumente werden mit dem bestehenden Datenmodell geprüft und übernommen; partielle Streaming-Eingaben bleiben ignoriert. Ergebnisse mit structuredContent haben Vorrang; zusätzlich wird standardkonformer JSON-Text im Tool-Ergebnis geliefert und bei Bedarf gelesen. Direkter Parent und verhandelter Origin werden weiterhin geprüft. Keine ERP-Anbindung, kein Kundenspeicher und keine Tokens im Browser.
- Neue Ressourcenadresse soll Cache-Verwechslungen vermeiden. Nach Deployment in Langdock Server Features/Werkzeuge neu laden und einen neuen Testaufruf ausführen. Bereits gerenderte Chatkarten laden ihre HTML-Ressource nicht zwingend neu.

## Technische Prüfungen

OpenFreeMap-Metadaten, Sprites und Glyphen öffentlich HTTP 200, CORS *. Lokaler echter Chromium-Browser mit restriktiver CSP, sandboxed iframe und echtem MapLibre/WebGL: Kacheln, Sprites und Glyphen geladen, vier sichtbare Marker in #2387ec (Bestandskunde), #ffffff (potenziell), #e0444e (besonders interessant), #788592 (ungeklärt). Vollständige Tool-Argumente ohne Ergebnis und JSON-Textfallback separat erfolgreich. Datenmodell-, Bridge-Sicherheits- und Vercel-Transporttests erfolgreich. Diese Host-Simulation beweist keine Ausführung im Langdock-Chat.

Die Beispielpositionen sind ausdrücklich fiktiv/approximate: Hamburg (DE, existing), Berlin (DE, prospect), Wien (AT, priority), Innsbruck (AT, unknown). Nahe Punkte können bei kleiner Zoomstufe korrekt zu Clustern zusammengefasst werden. Firmen ohne lon/lat bleiben ausschließlich in der Liste.

## Reproduzieren

node mcp/check.cjs
node mcp/check-vercel.cjs
node mcp/check-app-bridge.cjs
node mcp/check-embedded.cjs
node mcp/check-embedded.cjs input-only
node mcp/check-embedded.cjs text-only

Browserprüfung benötigt Playwright und lokal Chrome, greift auf echte OpenFreeMap-Ressourcen zu und schreibt einen synthetischen Bericht/Screenshot nach verification/. Diese Prüfartefakte und Dummy-Daten werden nicht automatisch auf Vercel ausgeliefert.

## Quellen

https://modelcontextprotocol.io/extensions/apps/overview
https://apps.extensions.modelcontextprotocol.io/api/documents/csp-and-cors.html
https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/2026-01-26/apps.mdx
https://maplibre.org/maplibre-gl-js/docs/
https://docs.langdock.com/en/using-langdock/guides/integrations/mcp/mcp
