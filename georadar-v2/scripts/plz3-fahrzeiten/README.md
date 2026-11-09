# PLZ3-Fahrzeitmatrix

Erzeugt `GeoRadar4-Supabase-komplett.sql` (Tabellen georadar_plz3_zentren und georadar_plz3_fahrzeiten, plus geteilte Karten).

1. `centers.py`: 3-stellige PLZ-Bereiche aus den 5-stelligen OSM-Flächen (yetzt/postleitzahlen, mit mapshaper zu plz3.geojson aufgelöst). Bezugspunkt je Bereich = einwohnerstärkster Ort (GeoNames DE, CC BY 4.0), bestätigt über die Ortsnamen der GeoNames-Postleitzahlen; Großstadtbereiche erhalten ihr Stadtteilzentrum, Ersatz = Ortspunkt der Postleitzahl.
2. `build_matrix.py <germany.osm.pbf> <matrix.npz>`: OSM-Straßennetz Autobahn bis Kreisstraße (Geofabrik/openstreetmap.fr-Auszug), Geschwindigkeit nach Straßenklasse bzw. Tempolimit, Einbahnstraßen, Verdichtung auf Kreuzungen, Dijkstra (SciPy) je Zentrum; plus Zufahrt Zentrum→Netz mit 30 km/h. Rund 8 Minuten auf 2 Kernen / 7 GB RAM.
3. `make_sql.py`: schreibt das SQL-Skript (Zeilen als Arrays, im SQL entpackt).

Stand der Berechnung: OSM 09.11.2026 01:15 UTC, 671 Bereiche, 450.241 Paare. Fähren/Autozüge nicht enthalten.
