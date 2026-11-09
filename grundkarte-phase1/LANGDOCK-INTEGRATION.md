# GeoRadar Phase 1 in Langdock integrieren

Stand: 29. Oktober 2026. Diese Anleitung beschreibt die nächsten Schritte; es wurde noch keine Langdock-Verbindung eingerichtet.

## 1. Die aktuelle Version verwenden

Die gespeicherte Phase-1-Anwendung liegt in diesem Versionszweig unter `grundkarte-phase1/`. Startanleitung: `grundkarte-phase1/README.md`. Die Dateien entsprechen der ausgelieferten Grundkarte; die Langdock-Anleitung ist zusätzlich beigelegt.

Private Onlineversion: https://mangold-georadar-grundkarte.mangoldgmbh-4649.chatgpt.site/

Der Link kann in die Anweisungen des Agenten „Mangold LeadRadar“ aufgenommen werden:

> Wenn der Benutzer die geografische Kartenansicht öffnen möchte, zeige diesen Link: [Mangold GeoRadar öffnen](https://mangold-georadar-grundkarte.mangoldgmbh-4649.chatgpt.site/). Die Karte läuft als separate Webanwendung. Sie übernimmt noch keine Daten aus diesem Agenten.

Die Karte öffnet separat. Die aktuelle Bereitstellung verlangt eine berechtigte ChatGPT-Anmeldung. Langdock-Anmeldungen gewähren keinen automatischen Zugriff. Ein Link oder ein ZIP in einer Wissenssammlung startet keinen MCP-Server und erzeugt keinen Datenaustausch.

## 2. Die Karte direkt im Langdock-Chat anzeigen

Empfohlener nächster Ausbau: die neue MapLibre-Grundkarte in eine MCP App einbinden. Langdock dokumentiert externe MCP-Integrationen und interaktive MCP Apps. Die konkrete MapLibre-Anwendung ist noch nicht in der Langdock-Sandbox getestet.

Das Repository enthält an der Wurzel bereits einen älteren MCP-Prototyp (`server.cjs`, `map.html`, `Dockerfile`). Dieser verwendet eine andere Kartendarstellung und ist keine fertige Anbindung der neuen Phase-1-Karte. Der Hauptzweig bleibt erhalten. Den alten Server unverändert zu starten würde die alte Karte bereitstellen.

Noch zu entwickeln und zu prüfen:

1. Den MCP-Server so erweitern, dass er die neue Grundkarte als MCP-App-Ressource ausliefert. Bibliothek, Styles, Bilder und weitere Ressourcen müssen im Einbettungskontext korrekt aufgelöst werden; relative Dateipfade aus der eigenständigen Website reichen dafür allein nicht.
2. Die Kommunikation zwischen Langdock und Karte implementieren: ein validiertes Unternehmens-JSON, ein Werkzeug zur Übergabe und die Verarbeitung seiner Ergebnisse in der Karte. Die Phase-1-Karte hat noch keine Unternehmensmarker oder Datenannahme.
3. WebGL, Worker und die erforderlichen Freigaben für OpenFreeMap-Kacheln, Glyphen und Sprites im tatsächlichen Langdock-Workspace prüfen. CSP-Metadaten gemäß der dann gültigen MCP-Apps-Spezifikation konfigurieren. Werden diese Funktionen blockiert, die eigenständige Karte als Alternative beibehalten.
4. Server auf einer von Langdock erreichbaren HTTPS-Adresse hosten. Ein privates GitHub-Repository ist Codeablage und führt den Server nicht aus. API-Zugriff schützen; Geheimnisse ausschließlich als Hosting-Secrets und in den vorgesehenen Langdock-Verbindungsfeldern speichern.

Anschließend in Langdock:

1. Im Bereich Integrationen eine MCP-Integration anlegen.
2. Die tatsächlich bereitgestellte HTTPS-Adresse des MCP-Endpunkts eintragen. Die GitHub-URL und die private ChatGPT-Site sind keine MCP-Endpunkte.
3. Bei einem Bearer-geschützten Server API Key und den Header-Typ „Authorization: Bearer“ auswählen; Token im Geheimnisfeld hinterlegen.
4. Verbindung testen, „List Server Features“ ausführen, das implementierte GeoRadar-Werkzeug und die Kartenressource auswählen und speichern.
5. Die Integration im Agenten „Mangold LeadRadar“ als nutzbare Aktion hinterlegen.
6. Mit wenigen ausdrücklich als Testdaten gekennzeichneten Datensätzen prüfen: Firmenname, Statusfarbe, tatsächliche Koordinaten, fehlende Koordinaten und leere Ergebnisse. Danach mit freigegebenen echten Daten testen. Kein automatischer Zugriff auf andere Chats oder Kundenbestände entsteht durch diese Einrichtung.

## 3. LeadRadar aus der eigenständigen Website aufrufen

Alternative: Karte bleibt auf einem Firmen-Webserver oder anderem geschützten Host. Ein zusätzlicher Backend-Adapter ruft die Langdock Agents API auf und gibt validierte Ergebnisse an die Karte weiter.

Langdock verlangt dafür einen API-Key mit passenden Rechten und eine Freigabe des Agenten für diesen Key. Die Dokumentation nennt dafür einen Administrator. Agent-ID aus der Agenten-URL übernehmen. Der dokumentierte Endpunkt lautet `POST https://api.langdock.com/agent/v1/chat/completions`; bei Dedicated Deployments die dokumentierte Basisadresse verwenden.

Langdock blockiert direkte Browser-Anfragen an diese API. Deshalb sind ein Backend und serverseitige Secret-Verwaltung nötig. Niemals einen API-Key in HTML, JavaScript, GitHub oder einen Agentenprompt schreiben. Die Marker-/Importfunktionen und die Ergebnisvalidierung sind vor dieser Verbindung noch zu ergänzen.

## Empfehlung

Jetzt die Phase-1-Version als stabile Grundlage behalten und per Link erreichbar machen. Danach Kundenimport, validiertes Datenformat und Firmenmarker ergänzen. Anschließend die neue Karte als MCP App verpacken und mit LeadRadar im konkreten Langdock-Workspace testen. Für die eigentliche Einrichtung werden eine geeignete Hosting-Umgebung und die passenden Langdock-Berechtigungen benötigt.

## Offizielle Quellen

- Langdock MCP: https://docs.langdock.com/en/using-langdock/guides/integrations/mcp/mcp
- Agent für API-Key freigeben: https://docs.langdock.com/en/developer/agents-api/agent-api-guide
- Agents Completions API: https://docs.langdock.com/en/developer/agents-api/agent

Öffentliche Dokumentation wurde geprüft; die Build-Laufzeit und Freigaben des konkreten Mangold-Workspaces wurden nicht geprüft. Es wird keine funktionierende Integration behauptet.
