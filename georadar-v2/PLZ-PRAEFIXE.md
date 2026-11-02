# Zweistellige PLZ-Präfixe und Überschrift

Die Überschrift und der Seitentitel heißen jetzt GEORADAR ohne 3D-Zusatz. Andere Kartenfunktionen und der Zugriffsschutz bleiben erhalten.

Unternehmensdatensätze akzeptieren postalCode als vollständige DE-/AT-PLZ oder als zweistelligen Text (z. B. "88"). Alternativ kann postalPrefix als zweistelliger Text übergeben werden. Führende Nullen bleiben erhalten. Widersprüchliche PLZ/Präfixe, Zahlen statt Text und andere Teil-PLZ-Längen werden abgewiesen.

Ohne lon/lat wird nur bei vorhandener Referenz ein schematischer PLZ-Gebietspunkt dargestellt, kein Firmenstandort und keine PLZ-Gebietsgrenze. Die Darstellung verwendet einen größeren, transparenten Ring in der Statusfarbe und ein Präfixlabel (88…). Liste und Popup kennzeichnen den Genauigkeitsunterschied. Vorhandene Firmenkoordinaten haben Vorrang. Fehlt eine Präfixreferenz, bleibt die Firma ohne Marker in der Liste.

Die zweistelligen Referenzpunkte stammen aus den GeoNames-Postcodedaten DE/AT, Abruf 2026-11-02, CC BY 4.0. Erst werden Stützpunkte pro vollständiger PLZ gemittelt, danach diese PLZ-Mittelpunkte je Präfix gleich gewichtet gemittelt. Keine erfundenen Flächen, kein Geocoding einzelner Kundendaten und keine ERP-Anbindung. Quellen/Lizenz und Regenerierung: dist/licenses/postal-prefixes-SOURCES.txt und scripts/build-postal-prefixes.py.

Beispiel für JSON-Import oder show_georadar_map:

```json
{"records":[{"id":"DUMMY-DE-88","name":"Fiktive Präfix-Testfirma DE","country":"DE","postalCode":"88","status":"existing"},{"id":"DUMMY-AT-10","name":"Fiktive Präfix-Testfirma AT","country":"AT","postalPrefix":"10","status":"priority"}]}
```

Die Präfix- und Länderfilter berücksichtigen diese Daten. Ein engerer vollständiger PLZ-Filter ordnet einen nur grob bekannten Präfixdatensatz nicht automatisch einer bestimmten vollständigen PLZ zu. Flächen bleiben ausschließlich importierte echte PLZ-Polygone.

Prüfungen erfolgreich: node mcp/check-postal-prefix.cjs; bestehende Datenmodell-, MCP-Transport- und Bridge-Tests; echter Chrome-Browser mit OpenFreeMap, zwei sichtbaren Präfixpunkten ohne Firmenkoordinaten, Präfixfilter 88 und AT-Länderfilter. Überschrift im Browser GEORADAR. MCP-Ressource map-v3.html; alte v1/v2-Adressen bleiben lesbar. Ein erneuter tatsächlicher Langdock-Chat-Test dieser Änderung ist nicht bestätigt.
