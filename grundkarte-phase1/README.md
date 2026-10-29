# MANGOLD GEORADAR 3D — Phase 1

Funktionsfähige eigenständige HTML5/JavaScript-Anwendung. Diese Lieferung setzt bewusst nur die ausdrücklich zuerst beauftragte geografische Grundkarte um. Keine synthetischen Länderumrisse oder Kundendaten. Die älteren ERP-Testdaten im Projekt werden nicht verwendet.

## Start

`node serve.cjs` im Projektordner ausführen und http://127.0.0.1:4387 öffnen. Node.js 18 oder neuer erforderlich. Der Server bindet ausschließlich an Loopback. Alternativ den Inhalt von `dist/` auf einem statischen HTTPS-Host bereitstellen. Nicht direkt als file:// starten, da der lokale Kartenstil per fetch geladen wird.

Kartenkacheln, Glyphen und Sprites benötigen Internetzugang zu `https://tiles.openfreemap.org`. MapLibre 5.13.0 und CSS werden mitgeliefert. Der Browser benötigt WebGL und Web Worker. Keine API-Schlüssel und kein Anwendungsbackend erforderlich.

## Nutzbare Funktionen

- Gemeinsame geografische Karte für Deutschland und Österreich; beide Länder werden beim Start vollständig eingepasst, inklusive norddeutscher Küste und östlichem Österreich.
- Verschieben, Zoomen, Maßstab, Tastaturbedienung, Gebietswechsel DE/AT/beide, Gesamtansicht.
- Umschaltbare Staats- und Bundesländergrenzen, Kreis-/Bezirkslinien ab Zoom 8 nach Verfügbarkeit in den Vektorkacheln, Ortsnamen, Verkehrsachsen und Gewässer.
- Lokale Ortssuche unter den aktuell geladenen OSM-Ortsmerkmalen. Kein vollständiger Ortsindex und kein Adress-/PLZ-Geocoding. Es werden keine Suchtexte an externe Geocoder gesendet. Ergebnisse sind Ortspositionen und keine Firmenkoordinaten.
- Klick auf Ortsnamen öffnet OSM-Ortsinformation. Export der tatsächlichen Kamera- und Ebeneneinstellungen als JSON (keine Kartenkacheln, keine Unternehmensdaten).
- Responsive Oberfläche, ein-/ausblendbare Gebietsauswahl, verständliche Fehler bei WebGL-/Netzwerkproblemen.

## Grenzen dieser Phase

Die App ist eine 2D-Grundkarte. Der 3D-Schalter ist ausdrücklich deaktiviert. Echtes DEM, PLZ-Polygone/-Punkte, amtliche Verwaltungsflächen, Import, Unternehmensfilter, Firmenmarker und White-Spot-Analysen sind nicht implementiert. Die vier Statusfarben sind nur als spätere verbindliche Legende vorhanden. Es gibt keine simulierte Langdock-Verbindung und keine behaupteten Analysewerte. Die Angabe 16/9 Bundesländer beschreibt die Länderstruktur, nicht die Zahl einer bereits durchgeführten Regionen-Analyse.

OSM/OpenMapTiles sind echte geografische Daten, werden jedoch abhängig vom Zoom vereinfacht. Weder amtliche Grenzgenauigkeit noch eine vollständige Ebene aller Landkreise und politischen Bezirke sind zugesichert. Verwaltungsgrenzen in den Vektorkacheln werden anhand `admin_level=2`, `4`, `6` gezeichnet. Inseln, Küsten, Orte und Straßen folgen den Originalgeometrien der Quelle. Keine erfundenen PLZ-Flächen. Länder-Auswahl verändert den Kartenausschnitt, sie schneidet Nachbarländer nicht aus.

## Quellen und Lizenzen

Geprüft am 29.10.2026:

- OpenFreeMap: https://openfreemap.org/quick_start/ — öffentliche Vektorkacheln, Glyphen und Sprites; https://openfreemap.org/tos/ und https://openfreemap.org/privacy/ beachten. Anbieter erhält IP-Adresse und angefragte Kartenressourcen; Internet erforderlich, keine Verfügbarkeitsgarantie. Für hohe betriebliche Verfügbarkeit eigenen Tile-Service oder vertraglichen Anbieter einsetzen.
- OpenStreetMap © Mitwirkende, ODbL: https://www.openstreetmap.org/copyright. Laufende Attribution bleibt sichtbar.
- OpenMapTiles-Schema: https://openmaptiles.org/. Liberty-Stil von OpenFreeMap für Blautöne angepasst; Originalstil als `base-style.json` mitgeliefert. Stil-Lizenz siehe `dist/licenses/`.
- MapLibre GL JS 5.13.0: BSD-3-Clause, Lizenz in `dist/licenses/`.
- Original-Logo unverändert aus dem bereits vorhandenen Projektasset `sites/deutschland-dashboard/dist/mangold.svg`. Website-Referenz bestätigt unter https://www.mangoldgmbh.com/fileadmin/platzhirsche/mitglieder/1/144075/Logo_Mangold_2022.svg . Nutzung für den vom Auftraggeber beauftragten Mangold-Auftritt; daraus folgt keine allgemeine Weiterlizenzierung.

Keine Google-Maps-Dienste. Keine Kunden- oder Umsatzdaten werden geladen, gespeichert oder versendet. Der Ansichtsexport enthält Einstellungen und den Hinweis companyCount=0.

## Langdock-Prüfung und nächste Integrationsschritte

Die öffentlich zugängliche Dokumentation https://docs.langdock.com/llms.txt führt die Agents API und die Freigabe von Agenten für API-Keys auf. Es liegt hier weder eine authentifizierte Langdock-Build-Sitzung noch eine verifizierbare Spezifikation dieser Build-Laufzeit vor. Daher bleiben Unterstützung für benutzerdefinierte HTML-Anwendungen, externe Tile-/Glyph-/Sprite-Requests, CORS/CSP, Blob-Worker, WebGL, Downloads und Einbettung ungeprüft. Die eigenständige Bereitstellung ist der nutzbare Weg dieser Lieferung; eine Einbettung in Langdock darf erst nach einem Test im konkreten Workspace zugesichert werden.

Offizielle Ausgangspunkte:

- https://docs.langdock.com/en/developer/agents-api/agents-overview
- https://docs.langdock.com/en/developer/agents-api/agent-api-guide
- https://docs.langdock.com/en/developer/agents-api/agent

Für Phase 7: Agent-ID und Freigabe für passenden API-Key prüfen, serverseitigen Adapter mit sicherer Secret-Verwaltung implementieren und anhand der dann gültigen Agents-API-Spezifikation testen. Niemals API-Schlüssel im Browser hinterlegen. Keine API-Endpunkte oder laufende Verbindung werden in Phase 1 simuliert.

## Nächste Phasen

2: Lizenzierter DEM-Dienst, echtes Höhenrelief, 2D/3D-Umschaltung.
3: Verifizierte Verwaltungsdaten und lizenzierte PLZ-Daten, Genauigkeit ausweisen.
4: SheetJS-Import mit Blatt-/Spaltenauswahl, Validierung und datenschutzgerechter Standortzuordnung.
5: Echte Unternehmensdaten, verbindliche Statusfarben, Clustering und Filter.
6: Ausschließlich datenbasierte Analysen, Unsicherheiten sichtbar machen.
7: Dokumentiertes Unternehmens-JSON und echter serverseitiger Langdock-Adapter.
