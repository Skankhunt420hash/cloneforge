# cloneforge
CloneForge Web-Build

## Was jeder Klon jetzt enthält

| Teil | Inhalt |
|---|---|
| Frontend | Expo/React-Native-App (Android, iOS, Web, Desktop) mit Screens je Tabelle, Dashboard, Detailansicht, Einstellungen |
| Datenbank | Lokale, schema-geprüfte Datenbank (offline zuerst) |
| Backend-Logik | `src/services/*` – läuft in der App **und** auf dem Server |
| Backend-Server | `server/index.mjs` (Node 18+, ohne Zusatzpakete): REST-API für alle Tabellen, Fachfunktionen, Sync zwischen Geräten/Personen, KI-Proxy, liefert die Web-App aus. Start: `npm run server`, Docker: `Dockerfile` |
| KI | `src/ai.js` (OpenRouter, Google AI Studio, Groq, OpenAI – oder über den eigenen Server) und Tab **KI**: Chat-Agent, der die App über Werkzeuge bedient (suchen, anlegen, ändern, löschen mit Rückfrage, Fachfunktionen), plus app-spezifische KI-Schnellaktionen aus dem Bauplan |

Alte Klone bekommen KI, Server und Sync automatisch, sobald man sie im „Bearbeiten“-Chat an der Struktur ändert.

## Änderungen an den Bundles

Im Repo liegen nur gebaute Dateien (`index.html`, `runner.mjs`). Die Fullstack-/KI-Erweiterung wird mit
`tools/patch_fullstack.py` in beide Bundles eingebaut. Die Vorlagen für die Klone liegen in `tools/clone-templates/`.

Nach einer Änderung an den Vorlagen:

```
git checkout <stand-vor-dem-patch> -- index.html runner.mjs
python3 tools/patch_fullstack.py
```

Kommt ein neuer Build aus dem Quellprojekt, das Skript einfach erneut darauf laufen lassen. Bricht es mit „Anker nicht eindeutig“ ab, hat sich die entsprechende Stelle im Build geändert.
