# Mangold GeoRadar – MapLibre & Langdock MCP v2

**Neu in GeoRadar 4:** geteilte Karten mit kryptischem Link, 5-stelligen PLZ-Gebieten, Adresssuche (SerpApi), Filtern nach Typ und Merkmalen sowie Routenoptimierung (OpenRouteService). MCP-Werkzeuge `karte_anlegen` und `punkte_hinzufuegen`. Einrichtung und Details: [GEORADAR-4-GETEILTE-KARTEN.md](georadar-v2/GEORADAR-4-GETEILTE-KARTEN.md).

Die aktuelle Anwendung liegt unter [georadar-v2](georadar-v2/README.md). Der Wurzel-Server wurde auf die neue MapLibre-Karte umgestellt: `npm start` oder `node server.cjs` startet den kompatiblen MCP-Endpunkt `/mcp` mit `show_georadar_map` und `ui://georadar/map-v1.html`. Dockerfile an der Wurzel verwendet ebenfalls v2.

Enthalten: Firmenmarker mit vier Statusfarben, Clustering, JSON-Datenübergabe, eigener Mangold-Standort, PLZ-Präfixe und Außendienstzuordnung CO=93, SR=42, SH=11, GD=2. PLZ-Gebiete bleiben bis zur Eingabe leer. [Prompt zum Ergänzen](georadar-v2/dist/Vertriebsgebiete-ergaenzen-Prompt.txt).

Für die eigenständige Website oder Tests zuerst `cd georadar-v2`, dann die dortige Anleitung verwenden. Die bisherige Phase 1 ist in [grundkarte-phase1](grundkarte-phase1/README.md) archiviert. Alte Dateien wie map.html an der Wurzel werden vom v2-Server nicht mehr geladen.

Der MCP-Server muss noch auf einem erreichbaren HTTPS-Host mit geeignetem GEORADAR_TOKEN betrieben und im konkreten Langdock-Workspace verbunden werden. Die private Online-Website ist kein MCP-Endpunkt. Der lokale Testhost mit synthetischen Daten dient nur der technischen Prüfung.
