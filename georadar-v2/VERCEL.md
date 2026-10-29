# Mangold GeoRadar auf Vercel

Diese Bereitstellung veröffentlicht ausschließlich die vorhandene Kartenanwendung aus `dist/`. Keine Änderung an HTML, CSS, JavaScript oder Unternehmensdaten. Keine API-Schlüssel notwendig.

## GitHub-Import

- Repository: `Mary201514/GeoRadar-Langdock-MCP` (privat)
- Branch: `georadar-marker-mcp-v2`
- Framework Preset: Other
- Root Directory: `.` (Repository-Wurzel)
- Output Directory: `georadar-v2/dist`
- Build Command: leer / deaktiviert
- Install Command: leer / deaktiviert
- Environment Variables: keine

Die `vercel.json` an der Repository-Wurzel setzt diese Build-/Output-Werte. Alternativ kann die Root Directory auf `georadar-v2` gesetzt werden; die dortige `vercel.json` verwendet entsprechend `dist`. Die Anwendung ist buildlos und benötigt keinen laufenden Node.js-Server.

Beim GitHub-Import muss der ausgewählte Branch tatsächlich `georadar-marker-mcp-v2` sein; der ältere main-Stand ist nicht die aktuelle Karte. Erst nach erfolgreichem Deployment und Prüfung der echten URL ist die Veröffentlichung abgeschlossen. Zugriffsschutz und Sichtbarkeit nach den verfügbaren Einstellungen des Vercel-Kontos prüfen. Die bisherige ChatGPT-Anmeldung wird nicht automatisch auf eine Vercel-Adresse übertragen.

## Lokaler CLI-Weg

Im Ordner dieser Datei `vercel --prod` ausführen, nachdem die Vercel-CLI angemeldet und das richtige Konto/Team ausgewählt ist. Projektordner-Konfiguration: `outputDirectory: dist`. Keine Zugangsdaten ins Repository schreiben.

## Umfang

Veröffentlicht werden nur statische Kartendateien. Der zusätzliche Adapter `api/mcp.mjs` stellt den bestehenden MCP-Kern serverlos unter `/mcp` bereit. Er benötigt GEORADAR_TOKEN als Production-Secret und wird ohne gültigen Secret nicht freigeschaltet. Details und Langdock-Einrichtung: LANGDOCK-VERCEL.md. Die Firmen werden beim Aufruf nicht automatisch importiert oder gespeichert.

Kartenkacheln, Glyphen und Sprites benötigen Zugriff auf `https://tiles.openfreemap.org`. MapLibre-Bibliothek, CSS, Logo und Kontextmaske sind bereits lokal enthalten.

Offizielle Dokumentation: https://vercel.com/docs/builds/configure-a-build und https://vercel.com/docs/project-configuration/vercel-json
