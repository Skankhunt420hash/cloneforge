# cloneforge
CloneForge Web-Build

## Was jeder Klon jetzt enthält

| Teil | Inhalt |
|---|---|
| Frontend | Expo/React-Native-App (Android, iOS, Web, Desktop) mit Screens je Tabelle, Dashboard, Detailansicht, Einstellungen |
| Datenbank | Lokale, schema-geprüfte Datenbank (offline zuerst) |
| Backend-Logik | `src/services/*` – läuft in der App **und** auf dem Server |
| Backend-Server | `server/index.mjs` (Node 18+, ohne Zusatzpakete): REST-API für alle Tabellen, Fachfunktionen, Sync zwischen Geräten/Personen, KI-Proxy, liefert die Web-App aus. Start: `npm run server`, Docker: `Dockerfile` |
| KI-Import | Beliebigen Text (Liste, Mail, Notizen, CSV) einfügen → die KI macht daraus geprüfte Einträge in der gewählten Tabelle |
| KI | `src/ai.js` (OpenRouter, Google AI Studio, Groq, OpenAI – oder über den eigenen Server) und Tab **KI**: Chat-Agent, der die App über Werkzeuge bedient (suchen, anlegen, ändern, löschen mit Rückfrage, Fachfunktionen), plus app-spezifische KI-Schnellaktionen aus dem Bauplan |

In der CloneForge-Vorschau („▶️ Starten“) nutzt der Klon automatisch den KI-Key von CloneForge – die KI ist sofort testbar.

Alte Klone bekommen KI, Server und Sync automatisch, sobald man sie im „Bearbeiten“-Chat an der Struktur ändert.

## Bedienung

| Tab | Wofür |
|---|---|
| ⚡ Klonen | App-Namen eingeben, mit **➕ App dazumischen** bis zu 4 Apps zu einer neuen kombinieren. Nach dem Bauen: Fertig-Karte mit Testen / Studio / Launch / Packen, Prüfberichte eingeklappt |
| 🧬 Apps | Alle gebauten Apps (starten, bearbeiten, packen) |
| ✏️ Studio | Aktuelle App per Chat ändern, mit Projektleiste (Testen, Launch-Kit, Packen) |
| 🚀 Launch | Launch-Kit: macht aus der App ein verkaufbares Produkt |
| ☰ Mehr | Packen, Mission, Doctor, Einstellungen, Info |

Auf breiten Bildschirmen (ab 1040 px) steht die Navigation als Seitenleiste links.

### Launch-Kit

- 🎨 **Icon, Store-Grafik, Screenshots** ohne KI, in den Farben der App und mit ihren echten Beispieldaten: Icon 512/1024, Play-Grafik 1024×500, Screenshots für Android (1080×1920) und iPhone (1290×2796)
- 🏪 **Store-Eintrag** für Play Store und App Store, Deutsch und Englisch. Die Zeichenlimits werden geprüft, zu lange Texte kürzt die KI automatisch
- 💶 **Preise & Geldverdienen**: Modell, Preisstufen, Upgrade-Momente und ein Umsatzrechner (Downloads, Conversion, Kündigungen, Store-Gebühr)
- 🌐 **Landingpage**: fertige, responsive Website mit Screenshots, Preisen und FAQ. Ein Kaufen-Link (Stripe, PayPal, Gumroad, Store) lässt sich eintragen
- ⚖️ **Rechtstexte**: Impressum, Datenschutzerklärung (passend zu Offline-Datenbank, Sync und KI) und Nutzungsbedingungen, jeweils als Vorlage
- 📣 **Marketing-Kit**: Posts je Kanal, 30-Sekunden-Videoskript, Hashtags, Product Hunt, Mail an Tester, Launch-Plan
- 🎯 **Markt & Pitch**: Zielgruppen, Wettbewerb, Alleinstellung, Pitch, Risiken, nächste 30 Tage
- ⬇️ **Launch-Paket (ZIP)** mit allen Texten, der Website und allen Grafiken als SVG und PNG. Alles liegt zusätzlich im Projekt unter `launch/`

Namen der Original-Apps werden aus allen öffentlichen Texten automatisch entfernt.

## Änderungen an den Bundles

Im Repo liegen nur gebaute Dateien (`index.html`, `runner.mjs`). Die Fullstack-/KI-Erweiterung wird mit
`tools/patch_fullstack.py` in beide Bundles eingebaut. Die Vorlagen für die Klone liegen in `tools/clone-templates/`.

Die neue Oberfläche (Navigation, Studio, Mixer, Launch-Kit) liegt als Quelltext in `tools/app-src/cfx.jsx`. Sie wird mit esbuild zu `cfx.build.js` gebaut (Befehl im Kopf von `tools/patch_ui.py`) und von `tools/patch_ui.py` als eigenes Modul in `index.html` eingesetzt. `sucrase.js` wird bei Bedarf nachgeladen, damit die Syntax- und Backend-Prüfung auch im Browser läuft.

Nach einer Änderung an den Vorlagen:

```
git checkout <stand-vor-dem-patch> -- index.html runner.mjs
python3 tools/patch_fullstack.py
python3 tools/patch_ui.py
```

Kommt ein neuer Build aus dem Quellprojekt, das Skript einfach erneut darauf laufen lassen. Bricht es mit „Anker nicht eindeutig“ ab, hat sich die entsprechende Stelle im Build geändert.
