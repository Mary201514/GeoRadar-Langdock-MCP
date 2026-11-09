# GeoRadar 4 – geteilte Karten mit PLZ-Gebieten, Adresssuche und Routenplanung

Branch `georadar-4-plz-links-routing`, Basis `georadar-3-analysis-save-preview` (c3f0865). Additiv: Bestehende Werkzeuge (`show_georadar_map`, `save_georadar_research`, `load_georadar_research`), `/AB382`-Links, private Ansichten und alle bestehenden Tabellen bleiben unverändert.

## Was neu ist

**Ablauf:** Der Langdock-Agent legt eine Karte an, schickt Punkte per Bulk und gibt dem Nutzer einen Link zurück.

1. `karte_anlegen(titel, beschreibung?)` → `karten_id` und `url`, z. B. `https://mangold-georadar.vercel.app/k/q7Vh2Lw9xT0aBcD3eFgH1iJk`
2. `punkte_hinzufuegen(karten_id, punkte[], modus?)` → bis 500 Punkte je Aufruf, beliebig oft (max. 10.000 je Karte)
   - Position über `lon`/`lat` **oder** `address` (bzw. `street`, `postalCode`, `city`). Adressen werden über SerpApi (Google-Maps-Suche) gesucht. Jede Adresse wird nur einmal abgefragt (Cache in Supabase), gleiche Adressen im selben Aufruf auch nur einmal.
   - Die 5-stellige PLZ wird aus der Position ermittelt, wenn sie fehlt. Passt eine angegebene PLZ nicht zur Position, wird der Punkt als „zu prüfen“ markiert, ebenso bei mehreren Treffern der Adresssuche.
   - Hintergrundinfos: `type` (z. B. Kläranlage), `status` (existing/prospect/priority/unknown, Statusfarben wie bisher) und `attributes` als freie Merkmale `{"Potenzial":"hoch","Mitarbeiter":120,"Wartungsvertrag":true}`. Alle bisherigen Felder (Branche, Vertreter, Quellen, Website …) bleiben nutzbar.
   - `modus: "ergaenzen"` (Standard) fügt hinzu bzw. aktualisiert gleiche `id`; `"ersetzen"` leert die Karte vorher.
   - Die Antwort enthält Zählungen (mit Position, nicht gefunden, ohne Adresse, zu prüfen) und die URL. Reicht die Zeit eines Aufrufs nicht für alle Adressen (Budget ca. 18 s), meldet sie `adresse_offen` > 0; dann erneut mit derselben `karten_id` und leerer `punkte`-Liste aufrufen.

**Kartenseite `/k/<schlüssel>`** (wer den Link hat, sieht die Karte; der Schlüssel hat 144 Bit Zufall, ist nicht erratbar und nicht auflistbar; `noindex`, `no-referrer`):

- **PLZ-Gebiete 5-stellig** dauerhaft hinterlegt (`dist/plz/plz5.geojson`, 8.174 Flächen, OSM/ODbL, Stand 02/2026). Grenzen ab Zoom 6, Nummern ab Zoom 9. Gebiete mit Punkten werden je nach Anzahl eingefärbt. Klick auf ein Gebiet zeigt die Anzahl und kann die Liste auf diese PLZ filtern. Die Ebene lässt sich unter „Ebenen“ abschalten und ist auch auf der normalen GeoRadar-Seite zuschaltbar.
- **Filter nach Typ & Merkmalen** entstehen automatisch aus den gelieferten Daten: Ankreuzlisten für Texte und ja/nein-Werte, von–bis für Zahlen. Sie wirken zusammen mit Status-, Such-, Länder- und Vertreterfiltern.
- **Route planen:** Punkte im Popup mit „Zur Route“ auswählen oder „Gefilterte übernehmen“ (höchstens 48 Stopps). Start bei Mangold Friedrichshafen oder einem gewählten Punkt, Rundtour optional. „Optimale Route berechnen“ optimiert die Reihenfolge (OpenRouteService/VROOM) und zeichnet die Straßenroute mit Kilometern und Fahrzeit je Etappe. Ein Link öffnet die Route in Google Maps zur Navigation (bei mehr als 10 Stopps in Etappen).

Die Routen-API nimmt nur IDs der gespeicherten Punkte an; Koordinaten kommen aus der Datenbank, nicht aus dem Browser. Höchstens 30 Routen je Karte in 10 Minuten.

## Einrichtung (einmalig, durch Maria)

1. **Supabase-Migration** im bestehenden Projekt `vljhiyxgcbfjyytopxnl` ausführen: `supabase/migrations/20261109_georadar_shared_maps.sql`. Sie legt nur neue Tabellen an (`georadar_maps`, `georadar_map_points`, `georadar_geocode_cache`), RLS aktiv, kein Zugriff für anon/authenticated, nur der Server (service_role).
2. **Vercel → mangold-georadar → Settings → Environment Variables** (Production, bei Bedarf auch Preview):

   | Variable | Wert |
   | --- | --- |
   | `SERPAPI_KEY` | API-Key aus serpapi.com → Dashboard (als Secret) |
   | `ORS_API_KEY` | API-Key aus openrouteservice.org → Dashboard (kostenloser Standard-Plan reicht für den Start) |
   | `GEORADAR_PUBLIC_URL` | optional; Standard `https://mangold-georadar.vercel.app`. Nur setzen, wenn die Links eine andere Domain haben sollen |

   `SUPABASE_URL`, `SUPABASE_SECRET_KEY` und `GEORADAR_TOKEN` sind bereits gesetzt und werden mitverwendet.
3. **Deployen.** Das Vercel-Projekt hat keine direkte Git-Verbindung, also nach dem Merge wie bisher deployen (`vercel --prod` im Repo-Stamm). Ohne `SERPAPI_KEY` bleiben Adressen offen; ohne `ORS_API_KEY` zeigt die Karte „Routing nicht eingerichtet“. Beides fällt sauber zurück, nichts bricht.
4. **Langdock:** In der bestehenden MCP-Integration „Mangold GeoRadar – Supabase“ → *Server-Funktionen auflisten* → `karte_anlegen` und `punkte_hinzufuegen` aktivieren → speichern → im Agenten unter Aktionen zuweisen → Agent aktualisieren. Agentenanweisung: `langdock/KARTEN-PROMPT-GETEILTE-KARTE.txt`.

## Kosten und Grenzen

- **SerpApi:** eine Suche pro neuer Adresse; wiederholte Adressen kommen aus dem Cache und kosten nichts. Für 1.000 neue Adressen also 1.000 Suchen.
- **OpenRouteService:** Optimierung und Route je Berechnung; der kostenlose Plan hat ein Tageskontingent (bei Überschreitung erscheint eine verständliche Meldung).
- Positionen aus der Adresssuche sind als „ungefähr“ gekennzeichnet (Google-Treffer, nicht vermessen). PLZ-Grenzen stammen aus OpenStreetMap und sind keine amtlichen Grenzen der Deutschen Post. PLZ-Zuordnung derzeit nur Deutschland; österreichische Punkte werden angezeigt, aber ohne PLZ-Flächen.
- **Datenschutz:** Jeder mit dem Link sieht alle Punkte dieser Karte inklusive Merkmale. Links nur gezielt weitergeben, keine sensiblen Personendaten in Merkmale schreiben. Eine Karte lässt sich derzeit nicht per Werkzeug löschen; bei Bedarf in Supabase den Eintrag in `georadar_maps` löschen (Punkte werden mitgelöscht, der Link ist dann tot).

## Tests

- `node test/check-shared-maps.cjs`: 10 Vertragstests mit Testdoubles für Supabase, SerpApi und OpenRouteService (Link-Format, Bulk, Cache, PLZ-Ermittlung und -Abgleich, Mehrfachtreffer, Zeitbudget/Fortsetzen, Eingabefehler, fehlende Schlüssel, Lesen nur mit gültigem Schlüssel, Routenoptimierung nur mit gespeicherten Koordinaten, Origin-Prüfung, Rate-Limit).
- `node test/check-shared-maps-browser.cjs`: Chrome headless gegen den lokalen Server: 24 Testpunkte, PLZ-Flächen mit Zählung, Merkmalfilter, Auswahl, optimierte Route, unbekannter Link. Screenshot in `test/output/`.
- Bestehende Tests weiter grün: `mcp/check.cjs`, `mcp/check-vercel.cjs`, `mcp/check-app-bridge.cjs`, `mcp/check-postal-prefix.cjs`, `mcp/check-embedded.cjs`, `test/check-research.cjs`, `test/check-private-views.cjs`, `test/check-representatives.cjs`. Angepasst wurden nur die erwartete Werkzeuganzahl (5) und die Serverversion (4.0.0).
- Noch offen: echter Lauf mit Live-Supabase, echten SerpApi-/ORS-Schlüsseln und aus Langdock heraus.

## Dateien

- `supabase/migrations/20261109_georadar_shared_maps.sql`: neue Tabellen
- `backend/maps-store.cjs`, `maps-service.cjs`, `geocode.cjs`, `plz-lookup.cjs`, `route.cjs`, `maps-api.cjs`: Speicher, Bulk-Ablauf, Adresssuche, PLZ-Zuordnung, Routing, öffentliche API
- `api/karte.mjs`, `api/route.mjs` (+ Adapter an der Repo-Wurzel), `vercel.json`: Funktionen und Route `/k/:key`
- `mcp/server.cjs`: Werkzeuge `karte_anlegen`, `punkte_hinzufuegen`
- `dist/shared-map.js`, `plz-layer.js`, `attribute-filters.js`, `route-planner.js`, `plz/`: Kartenseite
- `dist/data-model.js`: Felder `type`, `address`, `attributes`, `formattedAddress`, `geocodeNote`
- `dist/licenses/plz5-SOURCES.txt`: Quelle und Bearbeitung der PLZ-Daten
