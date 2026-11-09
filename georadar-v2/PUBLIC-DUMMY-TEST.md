# Tokenfreier Test beendet

Der öffentliche Dummy-Test wurde auf Wunsch beendet. Der Testmodus wurde aus mcp/transport.cjs entfernt. GEORADAR_TEST_MODE ist disabled und GEORADAR_TEST_UNTIL liegt in der Vergangenheit; bestehende GEORADAR_TOKEN-Secrets bleiben unverändert. Vercel-Schutz all_except_custom_domains wiederhergestellt. Die Karte bleibt unverändert.

Neustart: einen neuen zufälligen Schlüssel mit mindestens 32, empfohlen 64 Zeichen im Passwortmanager erzeugen. Vercel → mangold-georadar → Settings → Environment Variables → ausdrücklich GEORADAR_TOKEN mit Ziel Production bearbeiten. Nur den Wert ohne Bearer speichern. Anschließend neu deployen und denselben neuen Wert in Langdock im geschützten API-Key-Feld für Authorization: Bearer hinterlegen. Den Schlüssel nicht in Chat/GitHub schreiben. Mit aktiviertem Vercel-Schutz benötigt Langdock zusätzlich einen separaten x-vercel-protection-bypass aus Protection Bypass for Automation.

MCP-URL bleibt https://mangold-georadar.vercel.app/mcp, Transport Streamable HTTP. Der bisherige Token ist bis zur ausdrücklichen Ersetzung weiter gültig. Code und Anleitung enthalten keine Zugangsschlüssel.
