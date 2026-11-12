# Backend-Server

Der Server nutzt **dieselbe Datenbank-Engine, dasselbe Schema und dieselbe Backend-Logik** (`src/services`) wie die App. Er braucht nur Node.js 18 oder neuer, keine Zusatzpakete.

## Starten

```
npm run server
```

In der Konsole stehen danach die Adresse, die WLAN-Adresse und der **Zugangsschluessel**. Beides in der App unter *Einstellungen → Server & Sync* eintragen. Ab dann synchronisiert die App automatisch, auch zwischen mehreren Geraeten und Personen.

Web-App mit ausliefern: `npm run build:web` und danach `npm run server`. Die App ist dann unter derselben Adresse erreichbar.

## Einstellungen (Umgebungsvariablen oder `server/.env`)

| Variable | Bedeutung |
|---|---|
| `PORT` | Port, Standard 8787 |
| `APP_TOKEN` | Zugangsschluessel. Fehlt er, wird einer erzeugt und in `server/data/token.txt` gespeichert |
| `AI_API_KEY` | KI-Schluessel (OpenRouter `sk-or-…`, Google `AIza…`, Groq `gsk_…`, OpenAI `sk-…`). Damit bekommt die App KI ueber den Server, ohne dass ein Key auf dem Handy liegen muss |
| `AI_MODEL` | Optional: bestimmtes Modell |
| `AI_BASE_URL` | Optional: eigener OpenAI-kompatibler Endpunkt (z. B. lokales Modell) |
| `DATA_DIR` | Datenordner, Standard `server/data` |
| `CORS_ORIGIN` | Erlaubte Web-Herkunft, Standard `*` |

## API

Alle Aufrufe ausser `/api/health` brauchen `Authorization: Bearer <APP_TOKEN>`.

| Aufruf | Funktion |
|---|---|
| `GET /api/health` | Status, Sammlungen, KI aktiv? |
| `GET /api/schema` | Datenbank-Schema |
| `GET /api/<sammlung>?q=&where=&orderBy=&order=&limit=&offset=` | Liste |
| `POST /api/<sammlung>` | Anlegen (wird gegen das Schema geprueft) |
| `GET / PATCH / DELETE /api/<sammlung>/<id>` | Lesen, Aendern, Loeschen |
| `POST /api/fn/<Name>Service/<funktion>` `{"args":[…]}` | Fachfunktion aus `src/services` auf dem Server ausfuehren |
| `POST /api/ai/chat` `{"messages":[…]}` | KI-Anfrage ueber den Server-Schluessel |
| `GET /api/export`, `POST /api/import` | Sicherung als JSON |
| `POST /api/sync` | Abgleich mit der App |

## Online stellen

Mit Docker: `docker build -t app . && docker run -p 8787:8787 -e AI_API_KEY=… -v appdata:/app/server/data app`.
Ohne Docker: auf jedem Node-Hoster (Render, Railway, Fly.io, eigener VPS) mit Startbefehl `npm run server`. Den Ordner `server/data` als dauerhaften Speicher einbinden.
