# GeoRadar für Langdock

Wiederverwendbare interaktive Deutschland-Österreich-Karte als MCP App. GeoRadar übergibt die aktuellen LeadRadar-Ergebnisse an `show_georadar_map`; die Karte zeigt Bestandskunden, potenzielle Neukunden und White-Spot-Kandidaten.

## Enthalten

- Alle 25 Bundesländer in Deutschland und Österreich
- Land- und Regionsfilter, zuschaltbare Kartenebenen und Standortdetails
- Eingabeprüfung und leere Ansicht ohne automatische Demo-Kunden
- MCP-Endpunkt `/mcp`, Kartenressource `ui://georadar/map-v1.html`
- Beispiel mit fiktiven Datensätzen in [beispiel.json](beispiel.json)
- Vollständige Einrichtung und Agentenanweisung in [Einrichtung.txt](Einrichtung.txt)

## Lokal starten

Node.js 22 oder neuer; keine zusätzlichen Pakete erforderlich.

```sh
npm start
```

Lokal lauscht der Dienst auf `127.0.0.1:8787`. `/health` liefert den Status. `map.html` kann auch direkt im Browser geöffnet werden; über „LeadRadar-Ergebnisse übernehmen“ lässt sich `beispiel.json` einfügen.

## In Langdock verwenden

1. Den Dienst auf einer für Langdock erreichbaren HTTPS-Adresse betreiben.
2. Beim Hosting `HOST=0.0.0.0`, einen passenden `PORT` und `GEORADAR_TOKEN` mit mindestens 32 zufälligen Zeichen als Geheimnis setzen. Keine Schlüssel ins Repository schreiben.
3. In Langdock eine Remote-MCP-Integration zur echten Serveradresse mit `/mcp` anlegen.
4. API-Key-Authentifizierung mit Header `Authorization: Bearer` auswählen und den Token im Geheimnisfeld hinterlegen.
5. „List Server Features“ ausführen, Werkzeug und Kartenressource auswählen und die Integration im GeoRadar-Agenten hinterlegen.
6. Die aktuellen LeadRadar-Ergebnisse und die bekannten Bestandskunden an das Werkzeug übergeben.

GitHub speichert dieses Projekt. Der MCP-Dienst läuft dadurch noch nicht; GitHub Pages kann den Node.js-Server nicht ausführen. Für Hosting kann das enthaltene Dockerfile verwendet werden. HTTPS wird vom Hosting oder Reverse Proxy bereitgestellt.

## Daten und White-Spots

`category` ist `Bestandskunde` oder `Neukunde`; letzteres bedeutet **potenzieller** Neukunde. IDs müssen eindeutig sein; Ortskoordinaten müssen bereits vorliegen. Es ist kein Geocoding-Dienst eingebaut.

Ein White-Spot-Kandidat ist ein Bundesland mit mindestens einem übergebenen potenziellen Neukunden und keinem übergebenen Bestandskunden. Das ist eine Bewertung der gelieferten Daten, kein Nachweis einer realen Marktlücke. Maximal 2.000 Datensätze je Aufruf. Der Server speichert keine Kunden zwischen Aufrufen. Andere Agenten oder Chats werden nicht automatisch ausgelesen.

## Prüfstand

Lokal geprüft: MCP-Initialisierung und Werkzeugerkennung, Kartenressource, Übergabe der Ergebnisse per MCP-Apps-Handshake, 25 Bundesländer, Regionsfilter, Firmendetails sowie leere und ungültige Eingaben. Der Ende-zu-Ende-Test im konkreten Langdock-Arbeitsbereich und die Verbindung der beiden Agenten stehen aus.

## Quellen

- [Langdock MCP-Dokumentation](https://docs.langdock.com/en/using-langdock/guides/integrations/mcp/mcp)
- [MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui)
- Deutschland: [isellsoap/deutschlandGeoJSON](https://github.com/isellsoap/deutschlandGeoJSON), Unlicense
- Österreich: [Flooh Perlot / Statistik Austria](https://github.com/ginseng666/GeoJSON-TopoJSON-Austria), CC BY 4.0, Grenzen 2021; Darstellung aus vorhandenen Projektdateien vereinfacht
- D3 7.9.0, ISC-Lizenz; Copyright-Hinweis im eingebetteten Quellcode

Stand: 28.10.2026.
