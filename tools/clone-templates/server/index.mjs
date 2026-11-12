// Backend-Server der App (Node.js 18+, ohne Zusatzpakete).
// - REST-API fuer jede Tabelle:   GET/POST /api/<sammlung>   GET/PATCH/DELETE /api/<sammlung>/<id>
// - Fachfunktionen:               POST /api/fn/<Service>/<funktion>  { "args": [...] }
// - Sync fuer die App:            POST /api/sync   (mehrere Geraete/Personen teilen dieselben Daten)
// - KI-Proxy:                     POST /api/ai/chat (der KI-Schluessel bleibt auf dem Server)
// - Liefert die Web-Version aus:  dist/ (npm run build:web) unter /
// Daten: gleiche Datenbank-Engine und dasselbe Schema wie die App, gespeichert in server/data/.
//
// Umgebungsvariablen: PORT (8787), APP_TOKEN (Zugangsschluessel; fehlt er, wird einer erzeugt),
// AI_API_KEY (OpenRouter/Google/Groq/OpenAI), AI_MODEL (optional), DATA_DIR, CORS_ORIGIN (*)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.PORT) || 8787;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(HERE, 'data'));
const DIST = path.join(ROOT, 'dist');
const CORS = process.env.CORS_ORIGIN || '*';
const MAX_BODY = 4 * 1024 * 1024;
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadEnvFile() {
  const f = path.join(HERE, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnvFile();

// ---------- Zugangsschluessel ----------
let TOKEN = String(process.env.APP_TOKEN || '').trim();
const tokenFile = path.join(DATA_DIR, 'token.txt');
if (!TOKEN) {
  try { TOKEN = fs.readFileSync(tokenFile, 'utf8').trim(); } catch (e) { /* neu */ }
  if (!TOKEN) { TOKEN = crypto.randomBytes(18).toString('base64url'); fs.writeFileSync(tokenFile, TOKEN); }
}

// ---------- App-Code (Schema, Seeds, Services) fuer den Server bereitstellen ----------
const RT = path.join(HERE, '.runtime');
function prepareRuntime() {
  fs.rmSync(RT, { recursive: true, force: true });
  fs.mkdirSync(path.join(RT, 'db'), { recursive: true });
  fs.writeFileSync(path.join(RT, 'package.json'), '{"type":"module"}\n');
  for (const f of ['engine.js', 'schema.js', 'seed.js']) fs.copyFileSync(path.join(ROOT, 'src/db', f), path.join(RT, 'db', f));
  // Die Services importieren '../db/index.js' → hier zeigt das auf die Server-Datenbank
  fs.writeFileSync(path.join(RT, 'db/index.js'), 'export const db = globalThis.__APP_SERVER_DB__;\nexport default db;\n');
  const svcDir = path.join(ROOT, 'src/services');
  if (fs.existsSync(svcDir)) fs.cpSync(svcDir, path.join(RT, 'services'), { recursive: true });
}
prepareRuntime();
const imp = p => import(pathToFileURL(path.join(RT, p)).href);
const { createDb } = await imp('db/engine.js');
const { schema } = await imp('db/schema.js');
const { seed } = await imp('db/seed.js');

let APP_NAME = 'App';
try { APP_NAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.name || APP_NAME; } catch (e) { /* egal */ }

// Datei-Speicher (atomar: erst .tmp, dann umbenennen)
const fileStorage = {
  async getItem(k) { try { return fs.readFileSync(path.join(DATA_DIR, k + '.json'), 'utf8'); } catch (e) { return null; } },
  async setItem(k, v) { const f = path.join(DATA_DIR, k + '.json'); fs.writeFileSync(f + '.tmp', String(v)); fs.renameSync(f + '.tmp', f); },
  async removeItem(k) { try { fs.unlinkSync(path.join(DATA_DIR, k + '.json')); } catch (e) { /* egal */ } },
};
const db = createDb({ schema, seed, storage: fileStorage, key: 'db' });
globalThis.__APP_SERVER_DB__ = db;
await db.init();

const services = {};
for (const f of fs.existsSync(path.join(RT, 'services')) ? fs.readdirSync(path.join(RT, 'services')) : []) {
  if (!/Service\.js$/.test(f)) continue;
  try { services[f.replace(/\.js$/, '')] = await imp('services/' + f); } catch (e) { console.warn('Service ' + f + ' nicht geladen: ' + e.message); }
}

// ---------- Aenderungs-Protokoll fuer den Sync ----------
const metaFile = path.join(DATA_DIR, 'sync-meta.json');
let meta = { seq: 0, docSeq: {}, tomb: {} };
try { meta = { ...meta, ...JSON.parse(fs.readFileSync(metaFile, 'utf8')) }; } catch (e) { /* neu */ }
const hashDoc = d => { const { updatedAt, ...rest } = d; return crypto.createHash('sha1').update(JSON.stringify(rest)).digest('base64'); };
let hashes = {};
function track() {
  let changed = false;
  for (const n of db.names) {
    const cur = {};
    for (const d of db.collection(n).list()) cur[d.id] = hashDoc(d);
    const old = hashes[n] || {};
    meta.docSeq[n] = meta.docSeq[n] || {};
    meta.tomb[n] = meta.tomb[n] || {};
    for (const [id, h] of Object.entries(cur)) if (old[id] !== h) { meta.docSeq[n][id] = ++meta.seq; delete meta.tomb[n][id]; changed = true; }
    for (const id of Object.keys(old)) if (!(id in cur)) { meta.tomb[n][id] = ++meta.seq; delete meta.docSeq[n][id]; changed = true; }
    hashes[n] = cur;
  }
  if (changed) { fs.writeFileSync(metaFile + '.tmp', JSON.stringify(meta)); fs.renameSync(metaFile + '.tmp', metaFile); }
}
// Startzustand: Dokumente ohne Eintrag im Protokoll bekommen eine Nummer
for (const n of db.names) {
  hashes[n] = {};
  meta.docSeq[n] = meta.docSeq[n] || {};
  for (const d of db.collection(n).list()) { hashes[n][d.id] = hashDoc(d); if (!meta.docSeq[n][d.id]) meta.docSeq[n][d.id] = ++meta.seq; }
}
fs.writeFileSync(metaFile, JSON.stringify(meta));
db.subscribe(ev => { if (ev && ev.type !== 'ready' && ev.type !== 'rollback') track(); });

// Schreibzugriffe nacheinander ausfuehren (keine Ueberschneidungen)
let queue = Promise.resolve();
const serial = fn => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };

async function applySync({ since = 0, changes = {}, deletes = {} }) {
  const rejected = [];
  const touched = new Set();
  await db.transaction(async () => {
    for (const [n, ids] of Object.entries(deletes || {})) {
      if (!db.names.includes(n) || !Array.isArray(ids)) continue;
      for (const id of ids) {
        try { await db.collection(n).remove(String(id)); } catch (e) { rejected.push({ collection: n, id, error: e.message }); touched.add(n + '/' + id); }
      }
    }
    let todo = [];
    for (const [n, docs] of Object.entries(changes || {})) if (db.names.includes(n) && Array.isArray(docs)) for (const d of docs) if (d && typeof d.id === 'string') todo.push([n, d]);
    let lastErr = {};
    for (let pass = 0; pass < 5 && todo.length; pass++) {
      const next = [];
      for (const [n, d] of todo) {
        try { await db.collection(n).upsert(d.id, d); } catch (e) { lastErr[n + '/' + d.id] = e.message; next.push([n, d]); }
      }
      todo = next;
    }
    for (const [n, d] of todo) { rejected.push({ collection: n, id: d.id, error: lastErr[n + '/' + d.id] }); touched.add(n + '/' + d.id); }
  });
  track();
  const outChanges = {}, outDeletes = {};
  let total = 0;
  for (const n of db.names) {
    total += db.collection(n).count();
    for (const d of db.collection(n).list()) if ((meta.docSeq[n][d.id] || 0) > since || touched.has(n + '/' + d.id)) (outChanges[n] = outChanges[n] || []).push(d);
    for (const [id, s] of Object.entries(meta.tomb[n] || {})) if (s > since || touched.has(n + '/' + id)) (outDeletes[n] = outDeletes[n] || []).push(id);
  }
  return { seq: meta.seq, changes: outChanges, deletes: outDeletes, rejected, total };
}

// ---------- KI-Proxy ----------
const AI_PROVIDERS = {
  openrouter: { base: 'https://openrouter.ai/api/v1', models: ['nvidia/nemotron-3-super-120b-a12b:free', 'qwen/qwen3.8-27b:free', 'qwen/qwen3-coder:free'] },
  google: { base: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'] },
  groq: { base: 'https://api.groq.com/openai/v1', models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'] },
  openai: { base: 'https://api.openai.com/v1', models: ['gpt-5.4-mini', 'gpt-5.5'], tokenField: 'max_completion_tokens' },
};
const AI_KEY = String(process.env.AI_API_KEY || '').trim();
const detect = k => (/^sk-or-/.test(k) ? 'openrouter' : /^AIza/.test(k) ? 'google' : /^gsk_/.test(k) ? 'groq' : /^sk-/.test(k) ? 'openai' : null);
const AI_PROVIDER = process.env.AI_PROVIDER || detect(AI_KEY);
const AI_BASE = process.env.AI_BASE_URL || (AI_PROVIDER && AI_PROVIDERS[AI_PROVIDER] ? AI_PROVIDERS[AI_PROVIDER].base : '');
const aiEnabled = !!(AI_KEY && AI_BASE);
const hits = new Map();
function rateOk(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter(t => now - t < 60000);
  h.push(now); hits.set(ip, h);
  return h.length <= Number(process.env.AI_RATE_PER_MIN || 30);
}
async function aiChat({ messages, maxTokens = 1500, json = false, temperature = 0.4 }) {
  if (!aiEnabled) throw Object.assign(new Error('Auf dem Server ist keine KI eingerichtet (AI_API_KEY fehlt).'), { status: 501 });
  if (!Array.isArray(messages) || !messages.length) throw Object.assign(new Error('messages fehlt'), { status: 400 });
  const P = AI_PROVIDERS[AI_PROVIDER] || {};
  const models = process.env.AI_MODEL ? [process.env.AI_MODEL, ...(P.models || [])] : (P.models || []);
  let last = null;
  for (const model of models) {
    const body = { model, messages: messages.slice(-40).map(m => ({ role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content).slice(0, 60000) })), temperature };
    body[P.tokenField || 'max_tokens'] = Math.min(Number(maxTokens) || 1500, 8000);
    if (json && AI_PROVIDER !== 'openrouter') body.response_format = { type: 'json_object' };
    const r = await fetch(AI_BASE + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + AI_KEY }, body: JSON.stringify(body) }).catch(e => ({ ok: false, status: 0, json: async () => ({ error: { message: e.message } }) }));
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.choices && j.choices[0]) return { text: String(j.choices[0].message.content || ''), model };
    last = (j && j.error && (j.error.message || j.error)) || 'HTTP ' + r.status;
    if (r.status === 401 || r.status === 403) break;
  }
  throw Object.assign(new Error('KI-Anbieter: ' + String(last).slice(0, 300)), { status: 502 });
}

// ---------- HTTP ----------
const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': CORS, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' });
  res.end(JSON.stringify(data));
};
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Anfrage zu gross'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(Object.assign(new Error('Kein gueltiges JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const authed = req => {
  const h = String(req.headers.authorization || '');
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  return t.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res, pathname) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta charset="utf-8"><title>${APP_NAME} Server</title><body style="font-family:sans-serif;padding:24px"><h1>${APP_NAME} – Server laeuft ✅</h1><p>API unter <code>/api</code>. Fuer die Web-App vorher <code>npm run build:web</code> ausfuehren, dann wird sie hier ausgeliefert.</p></body>`);
  }
  let f = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
  if (!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}

const BASE_FNS = new Set(['list', 'get', 'count', 'create', 'update', 'remove']);

async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (parts[0] !== 'api') return serveStatic(req, res, url.pathname);
  if (parts[1] === 'health') return send(res, 200, { ok: true, app: APP_NAME, version: db.version, ai: aiEnabled, aiProvider: aiEnabled ? AI_PROVIDER : null, collections: db.names, auth: authed(req) });
  if (!authed(req)) return send(res, 401, { error: 'Zugangsschluessel fehlt oder falsch (Header Authorization: Bearer <APP_TOKEN>)' });

  const [, a, b, c] = parts;
  if (a === 'schema') return send(res, 200, schema);
  if (a === 'export' && req.method === 'GET') return send(res, 200, JSON.parse(db.exportJSON()));
  if (a === 'import' && req.method === 'POST') { const body = await readBody(req); await serial(() => db.importJSON(JSON.stringify(body))); track(); return send(res, 200, { ok: true }); }
  if (a === 'sync' && req.method === 'POST') { const body = await readBody(req); return send(res, 200, await serial(() => applySync({ since: Number(body.since) || 0, changes: body.changes, deletes: body.deletes }))); }
  if (a === 'ai' && b === 'chat' && req.method === 'POST') {
    if (!rateOk(req.socket.remoteAddress || '')) return send(res, 429, { error: 'Zu viele KI-Anfragen, kurz warten.' });
    return send(res, 200, await aiChat(await readBody(req)));
  }
  if (a === 'fn' && b && c && req.method === 'POST') {
    const svc = services[b];
    if (!svc || BASE_FNS.has(c) || c === 'samples' || typeof svc[c] !== 'function') return send(res, 404, { error: `Funktion ${b}.${c} gibt es nicht. Vorhanden: ${Object.entries(services).flatMap(([k, s]) => Object.keys(s).filter(f => typeof s[f] === 'function' && !BASE_FNS.has(f)).map(f => k + '.' + f)).join(', ')}` });
    const body = await readBody(req);
    const result = await serial(() => svc[c](...(Array.isArray(body.args) ? body.args : [])));
    track();
    return send(res, 200, { result: result === undefined ? null : result });
  }
  if (a && db.names.includes(a)) {
    const col = db.collection(a);
    if (!b) {
      if (req.method === 'GET') {
        const q = {};
        if (url.searchParams.get('where')) { try { q.where = JSON.parse(url.searchParams.get('where')); } catch (e) { return send(res, 400, { error: 'where muss JSON sein' }); } }
        if (url.searchParams.get('orderBy')) q.orderBy = url.searchParams.get('orderBy');
        if (url.searchParams.get('order')) q.order = url.searchParams.get('order');
        let rows = col.list(q);
        const s = String(url.searchParams.get('q') || '').toLowerCase();
        if (s) rows = rows.filter(d => Object.values(d).some(v => v != null && String(v).toLowerCase().includes(s)));
        const offset = Number(url.searchParams.get('offset')) || 0;
        const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 5000);
        return send(res, 200, { total: rows.length, items: rows.slice(offset, offset + limit) });
      }
      if (req.method === 'POST') { const body = await readBody(req); return send(res, 201, await serial(() => col.insert(body))); }
    } else {
      if (req.method === 'GET') { const d = col.get(b); return d ? send(res, 200, d) : send(res, 404, { error: 'nicht gefunden' }); }
      if (req.method === 'PATCH' || req.method === 'PUT') { const body = await readBody(req); return send(res, 200, await serial(() => col.update(b, body))); }
      if (req.method === 'DELETE') { const ok = await serial(() => col.remove(b)); return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: 'nicht gefunden' }); }
    }
    return send(res, 405, { error: 'Methode nicht erlaubt' });
  }
  return send(res, 404, { error: 'Unbekannter Pfad. Sammlungen: ' + db.names.join(', ') });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(e => {
    const status = e.status || (e.name === 'DbError' ? (e.code === 'NOT_FOUND' ? 404 : 400) : 500);
    if (status >= 500) console.error(e);
    send(res, status, { error: e.message || String(e), code: e.code });
  });
});
server.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`\n✅ ${APP_NAME} – Server laeuft`);
  console.log(`   Lokal:      http://localhost:${PORT}`);
  for (const ip of lan) console.log(`   Im WLAN:    http://${ip}:${PORT}`);
  console.log(`   Zugangsschluessel (in der App unter Einstellungen → Server eintragen): ${TOKEN}`);
  console.log(`   KI: ${aiEnabled ? 'aktiv (' + AI_PROVIDER + ')' : 'aus – AI_API_KEY setzen, um KI ueber den Server anzubieten'}`);
  console.log(`   Daten: ${DATA_DIR}\n`);
});
const stop = () => { db.flush().finally(() => process.exit(0)); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
