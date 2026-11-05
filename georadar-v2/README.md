# MANGOLD GEORADAR — GK-10-Teststand

MapLibre-Karte für Deutschland und Österreich mit Unternehmensmarkern, Clustering, Statusfiltern, validierter JSON-Übergabe und MCP-App-Anschluss. Ergänzt: eigener Mangold-Standort, PLZ-Präfixfilter und Außendienstzuordnung CO=93, SR=42, SH=11, GD=2, GK=10. Neu im Test-Branch: Vertreter-Mehrfachauswahl, fünf Ringfarben, GK-Fachvorschläge und CSV-/Excel-.xlsx-Import. Noch kein DEM/3D oder mitgelieferter vollständiger PLZ-Polygon-Datensatz.

## Start

Node.js 22 oder neuer, keine Paketinstallation nötig.

- Eigenständige Website: `node serve.cjs`, danach http://127.0.0.1:4387 öffnen. Alternativ `dist/` auf einem statischen HTTPS-Host bereitstellen.
- MCP-Server: `node mcp/server.cjs`, lokal http://127.0.0.1:8787/mcp.
- Tests: `node mcp/check.cjs`.
- Lokaler QA-Host: `node mcp/preview.cjs`, Port 4390. Dieser lädt ausdrücklich synthetische Testdatensätze zur technischen Prüfung; die normale Anwendung lädt sie nicht.
- Optionales HTML-Bundle zur Inspektion: `node mcp/bundle.cjs`; der MCP-Server baut dieselbe Ressource direkt im Speicher.

Für Langdock den MCP-Server auf einem erreichbaren HTTPS-Host betreiben. `HOST=0.0.0.0`, `PORT` gemäß Hosting und `GEORADAR_TOKEN` mit mindestens 32 zufälligen Zeichen als Secret setzen. Docker-Build im Projektordner: `docker build -f mcp/Dockerfile -t mangold-georadar .`. TLS über Hosting/Reverse Proxy. Kein Secret ins Repository oder in Browsercode.

`GET /health` liefert Betriebsstatus/Version. `POST /mcp` verarbeitet stateless JSON-RPC, mit `Authorization: Bearer <Secret>`. Kundendaten werden nicht serverseitig gespeichert. Browser-Origin-Header werden standardmäßig abgewiesen; nur eine ausdrücklich konfigurierte `ALLOWED_ORIGIN` ist zulässig. Keine öffentliche Browser-API. Die private Sites-Veröffentlichung ist weiterhin eine separate statische Website mit ChatGPT-Anmeldung und kein extern erreichbarer MCP-Endpunkt.

## Unternehmensdaten

Unter „JSON-Daten übernehmen“ Datei auswählen oder JSON einfügen. Jede erfolgreiche Übergabe ersetzt den vollständigen Unternehmensbestand; bei ungültigen Daten bleibt der Bestand unverändert. Keine Speicherung in localStorage/Cookies. Für späteres Wiederverwenden die Unternehmens-JSON exportieren.

```json
{
  "schema": "mangold-georadar/companies/v1",
  "records": [],
  "territories": [
    {"code":"CO","personnelNumber":"93","rules":[]},
    {"code":"SR","personnelNumber":"42","rules":[]},
    {"code":"SH","personnelNumber":"11","rules":[]},
    {"code":"GD","personnelNumber":"2","rules":[]},
    {"code":"GK","personnelNumber":"10","rules":[]}
  ]
}
```

Das Beispiel enthält absichtlich keine Unternehmen. Eine leere records-Liste entfernt den bestehenden Bestand. Bei reinen Gebietsänderungen die Formularfelder verwenden oder alle bestehenden records im JSON erhalten.

Pflicht je Firma: `id` (eindeutiger Text), `name`, `country` (DE, AT, Deutschland oder Österreich). Optional:

- `status`: existing=blau, prospect=weiß, priority=rot, unknown=grau. Ohne Angabe ungeklärt. Alte `category` Bestandskunde/Neukunde wird normalisiert; Neukunde bedeutet potenzieller Neukunde.
- `lon` und `lat`: beide numerisch oder beide fehlend/null. Ohne Koordinaten bleibt die Firma in der Liste, ohne Marker. Keine erfundenen Positionen und kein Geocoding.
- `locationAccuracy`: exact, approximate, unknown (Standard). exact ist eine Angabe des Datenlieferanten und keine unabhängige Prüfung. PLZ-/Ortszentren immer approximate. `coordinateSource` zur Dokumentation.
- `postalCode`: vollständige PLZ als Text, DE fünf-/AT vierstellig. Weitere Textfelder: customerNumber, street, city, state, district, industry, product, potential, contact, notes, relationships.
- `leadScore`: Zahl 0–100; `revenue`: nichtnegative Zahl, Anzeige EUR.
- `personnelNumber` und `salesRep`: ausdrücklich zugeordnete Personalnummer/Kürzel.

Maximal 10.000 Firmen. Browserimport maximal 5 MB; MCP-Anfrage maximal 6 MB inklusive JSON-RPC. Koordinatenprüfung nur gegen den DE/AT-Kartenausschnitt, keine exakte Staats-/PLZ-Polygonprüfung. Gemeinsame Validierung in dist/data-model.js.

## PLZ und Außendienst

Vom Auftraggeber festgelegt: CO=93, SR=42, SH=11, GD=2, GK=10. PLZ-Gebiete zunächst leer. Unter „PLZ & Außendienst“ je Kürzel Personalnummer und Präfixlisten je Land eintragen und übernehmen. Eine Regel hat die Form `{"country":"DE","prefixes":["…"]}` bzw. AT. Präfixe sind numerische Texte, DE 1–5/AT 1–4 Ziffern. Platzhalter in Eingabefeldern sind keine gespeicherten Gebietszuordnungen.

Explizite Vertreterangaben haben Vorrang und werden nie durch PLZ-Regeln ersetzt. Ohne Vertreterangabe gilt die Personalnummer; nur ohne beide Angaben greifen importierte PLZ-Regeln. GK ist fachlich für alle PLZ-Gebiete verfügbar; daraus entsteht keine automatische Kundenzuordnung. Die fünf Gebiete sind als Markierungsringe/Bezeichnungen separat ein-/ausblendbar. Ein zusätzlicher Gebietsfilter filtert die Firmenliste. Markerfüllungen behalten die Statusfarben.

Der freie PLZ-Filter unterstützt z.B. `88, 89, 78, 88046, 6850`. Er filtert vorhandene Firmen; ohne Daten ist er kein vollständiges PLZ-Verzeichnis. PLZ-Beschriftungen stehen an vorhandenen Standorten, nicht an erfundenen PLZ-Zentroiden.

Echte PLZ-Flächen lassen sich optional als GeoJSON importieren: FeatureCollection, Polygon/MultiPolygon, WGS84, properties.country DE/AT und properties.postalCode vollständiger PLZ-Text. Quelle/Nutzungsrecht angeben. Maximal 20 MB, 30.000 Flächen, 500.000 Koordinaten. Ohne Flächendatensatz werden keine Gebietsflächen erzeugt. Formale Validierung ist keine amtliche Beglaubigung. Polygone bleiben nur in der aktuellen Sitzung; Originaldatei für erneutes Laden behalten.

Gebietszuordnungen sind im Unternehmensexport enthalten. Ein nur mit territories befüllter JSON-Import ohne records wird abgelehnt. Der ergänzende Prompt liegt unter dist/Vertriebsgebiete-ergaenzen-Prompt.txt.

## Eigener Standort

Mangold erscheint separat als M-Marker, unabhängig von Kundenbestand und Kennzahlen. Lindauer Straße 116, 88046 Friedrichshafen. Position [9.508511741063957,47.64373714669217] nach der öffentlich eingebetteten Kartenreferenz der Unternehmenswebsite (vorhandene lokale HTML-Referenz, Adresse durch Kontaktseite bestätigt). Die Position ist als ungefähr gekennzeichnet, kein Vermessungsnachweis. Kein Google-Dienst wird geladen. Der eigene Marker ist ein-/ausblendbar und über „Mangold-Standort anzeigen“ erreichbar.

## Langdock/MCP

Werkzeugname und Ressourcen-URI bleiben zum bisherigen Ansatz kompatibel:

- Werkzeug show_georadar_map, Argumente wie im Unternehmensformat oben.
- Ressource ui://georadar/map-v1.html, MIME text/html;profile=mcp-app.
- Server bündelt MapLibre, Logo, CSS, Skripte und Kartenstil in einer HTML-Ressource; keine kaputten relativen Asset-Pfade.
- UI-Handschlag ui/initialize; danach Verarbeitung von ui/notifications/tool-result mit structuredContent. Partielle/ungeprüfte Eingaben werden nicht gezeichnet. Nur direkter Parent und nach Handshake dieselbe Origin dürfen Ergebnisse übergeben.
- CSP-Metadaten erlauben OpenFreeMap-Ressourcen sowie blob-Ressourcen für Worker. Der konkrete Langdock-Host muss WebGL, Worker, diese Quellen und die Ressourcengröße unterstützen. Lokal im sandboxed iframe geprüft; echter Workspace-Test steht aus.

In Langdock MCP-Integration mit tatsächlicher HTTPS-Adresse und Bearer-Secret anlegen. Verbindung testen, „List Server Features“ ausführen, Werkzeug/Kartenressource auswählen und dem LeadRadar-Agenten als Aktion zuweisen. LeadRadar muss den gewünschten vollständigen records-Bestand ausdrücklich übergeben. Andere Chats oder ERP-Daten werden nicht automatisch gelesen. Eine Langdock Agents API ist für diesen Aufrufweg nicht erforderlich.

Agentenanweisung:
> Wenn Unternehmen geografisch dargestellt werden sollen, rufe show_georadar_map mit dem gewünschten vollständigen records-Bestand auf. Nutze belegte Koordinaten; ohne Nachweis lon/lat weglassen. Erfinde keine Kundenbeziehungen oder PLZ-Gebiete. Status existing, prospect, priority oder unknown. Personalnummern nur aus vorhandenen Daten übernehmen: CO=93, SR=42, SH=11, GD=2. territories nur als ausdrücklich gewünschte vollständige Zuordnung übergeben. Eine leere records-Liste löscht die Firmenansicht. Geringe Kundenzahlen beweisen kein Marktpotenzial.

## Tests und Quellen

check.cjs prüft Status, Legacy-Daten, fehlende/ungültige Koordinaten, PLZ, IDs, Gebietskonfiguration, 10.000 Firmen, HTML-Bundle, Host-Handschlag/Origin, HTTP-Authentifizierung, Fehler und leere Ergebnisse. preview.cjs ist ausschließlich ein lokaler Testhost und kein produktiver Endpunkt.

- OSM/ODbL: https://www.openstreetmap.org/copyright
- OpenFreeMap: https://openfreemap.org/quick_start/ und https://openfreemap.org/tos/
- MapLibre 5.13.0/BSD-3-Clause und Liberty-Lizenzen: dist/licenses/
- Original-Logo/Standort: https://www.mangoldgmbh.com/kontakt
- MCP Apps: https://modelcontextprotocol.io/extensions/apps/overview ; stabile Spezifikation 2026-01-26.
- Langdock: https://docs.langdock.com/en/using-langdock/guides/integrations/mcp/mcp

Karten sind zoomabhängig generalisiert, keine amtliche Vermessung. Browser benötigt Internet und sendet IP/Kachelanfragen an OpenFreeMap. Firmendaten werden nicht an den Tile-Anbieter übermittelt. Keine automatische Marktpotenzial-/White-Spot-Bewertung. Stand: 29.10.2026.


Darstellung der Nachbarländer: blasse Kontextmaske in Übersichtszooms auf Basis vorhandener echter Länder-/Bundesland-Geometrien. Bei Detailzoom blendet sie aus. Quellen und Bearbeitung: dist/licenses/context-mask-SOURCES.txt. OSM-Grenzlinien und Unternehmensmarker bleiben erhalten.


## MCP auf Vercel

Der neue Adapter api/mcp.mjs stellt denselben MCP-Kern serverlos unter /mcp bereit. Karte und dist-Dateien bleiben unverändert. Vercel Production benötigt GEORADAR_TOKEN als Secret; ohne gültige Konfiguration bleibt der Endpunkt geschlossen. Einrichtung, zusätzliche Vercel-Zugriffsschutzebene und Tests: [LANGDOCK-VERCEL.md](LANGDOCK-VERCEL.md).


## GK 10 – isolierter Teststand

Details, Änderungen, Importgrenzen und Tests stehen in `GK10-TESTSTAND.md`. Dieser Branch wurde nicht produktiv veröffentlicht. Bestehende MCP-Adressen, Authentifizierung und Supabase-Verbindungen sind unverändert.
