// Synchronisation mit dem eigenen Backend-Server (server/). Optional: ohne Server-Adresse passiert nichts.
// - Offline zuerst: die App arbeitet immer mit der lokalen Datenbank, Aenderungen gehen im Hintergrund zum Server.
// - Mehrere Geraete / Nutzer teilen sich so dieselben Daten. Konflikte: die zuletzt beim Server angekommene Aenderung gewinnt.
// - Der Server prueft jede Aenderung gegen dasselbe Schema wie die App.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './db/index.js';
import { api, hasServer } from './server.js';
import { subscribeSettings, getSettings } from './settings.js';

const KEY = 'app_sync';
let meta = null; // { seq, base: { sammlung: { id: hash } }, server }
let status = { state: 'off', lastSync: null, error: null, pushed: 0, pulled: 0 };
const listeners = new Set();
const setStatus = patch => { status = { ...status, ...patch }; listeners.forEach(fn => { try { fn(status); } catch (e) { /* egal */ } }); };

export const getSyncStatus = () => status;
export const onSyncStatus = fn => { listeners.add(fn); return () => listeners.delete(fn); };

function hash(doc) {
  const { updatedAt, ...rest } = doc;
  const s = JSON.stringify(rest);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ':' + s.length;
}

async function loadMeta() {
  if (meta) return meta;
  try { const raw = await AsyncStorage.getItem(KEY); meta = raw ? JSON.parse(raw) : null; } catch (e) { meta = null; }
  if (!meta || typeof meta !== 'object') meta = { seq: 0, base: {}, server: '' };
  return meta;
}
async function saveMeta() { try { await AsyncStorage.setItem(KEY, JSON.stringify(meta)); } catch (e) { /* egal */ } }

const localDocs = () => { const out = {}; for (const n of db.names) out[n] = db.collection(n).list(); return out; };

// Server-Daten lokal uebernehmen. skip(n, id) → true = lokale Aenderung behalten (wurde waehrend der Anfrage gemacht).
// Liefert, was uebernommen wurde: { put: [[n, id]], del: [[n, id]], failed }
async function applyRemote(changes, deletes, skip, replaceAll) {
  const put = [], del = [];
  let failed = 0;
  await db.transaction(async () => {
    if (replaceAll) {
      for (const n of db.names) {
        const keep = new Set((changes[n] || []).map(d => d.id));
        await db.collection(n).removeWhere(d => !keep.has(d.id));
      }
    }
    for (const [n, ids] of Object.entries(deletes || {})) {
      if (!db.names.includes(n)) continue;
      for (const id of ids) {
        if (skip(n, id)) continue;
        try { await db.collection(n).remove(id); del.push([n, id]); } catch (e) { failed++; }
      }
    }
    // mehrere Durchgaenge, damit Verweise (ref) auf neue Eintraege aufgehen
    let todo = [];
    for (const [n, docs] of Object.entries(changes || {})) if (db.names.includes(n)) for (const d of docs) if (!skip(n, d.id)) todo.push([n, d]);
    for (let pass = 0; pass < 5 && todo.length; pass++) {
      const next = [];
      for (const [n, d] of todo) {
        const cur = db.collection(n).get(d.id);
        if (cur && hash(cur) === hash(d)) { put.push([n, d.id]); continue; }
        try { await db.collection(n).upsert(d.id, d); put.push([n, d.id]); } catch (e) { next.push([n, d]); }
      }
      todo = next;
    }
    failed += todo.length;
  });
  return { put, del, failed };
}

const snapshot = () => { const out = {}; for (const n of db.names) { out[n] = {}; for (const d of db.collection(n).list()) out[n][d.id] = hash(d); } return out; };

let running = null;
let again = false;

export async function syncNow() {
  if (!hasServer()) { setStatus({ state: 'off', error: null }); return status; }
  if (running) { again = true; return running; }
  running = (async () => {
    setStatus({ state: 'syncing', error: null });
    try {
      await db.init();
      await loadMeta();
      const server = String(getSettings().serverUrl || '').trim();
      if (meta.server !== server) meta = { seq: 0, base: {}, server };
      const mm = meta;
      let pushed = 0, pulled = 0;
      if (!mm.seq && !Object.keys(mm.base).length) {
        const r = await api('/api/sync', { method: 'POST', body: { since: 0, changes: {}, deletes: {} } });
        if (r.total > 0) { // Server hat schon Daten → Server ist massgeblich, lokale Demo-Daten werden ersetzt
          const res = await applyRemote(r.changes || {}, {}, () => false, true);
          mm.base = res.failed ? {} : snapshot();
          mm.seq = res.failed ? 0 : (r.seq || 0);
          await saveMeta();
          setStatus({ state: res.failed ? 'warn' : 'ok', lastSync: Date.now(), pulled: r.total, pushed: 0, error: res.failed ? res.failed + ' Eintrag/Eintraege vom Server passten nicht' : null });
          return status;
        }
        mm.seq = r.seq || 0; // Server leer → lokale Daten werden jetzt hochgeladen
      }
      const atSend = snapshot();
      const docs = localDocs();
      const changes = {}, deletes = {};
      const known = {};
      for (const n of db.names) known[n] = { ...(mm.base[n] || {}) };
      for (const n of db.names) {
        for (const d of docs[n]) {
          const h = atSend[n][d.id];
          if (known[n][d.id] !== h) { (changes[n] = changes[n] || []).push(d); known[n][d.id] = h; pushed++; }
        }
        for (const id of Object.keys(mm.base[n] || {})) if (!(id in atSend[n])) { (deletes[n] = deletes[n] || []).push(id); delete known[n][id]; pushed++; }
      }
      const r = await api('/api/sync', { method: 'POST', body: { since: mm.seq, changes, deletes } });
      const before = snapshot();
      const changedInFlight = (n, id) => (before[n] || {})[id] !== (atSend[n] || {})[id];
      const res = await applyRemote(r.changes || {}, r.deletes || {}, changedInFlight, false);
      const after = snapshot();
      for (const [n, id] of res.put) { if (after[n][id] !== undefined) known[n][id] = after[n][id]; }
      for (const [n, id] of res.del) delete known[n][id];
      for (const n of Object.keys(r.changes || {})) pulled += r.changes[n].length;
      if (res.failed) { mm.base = {}; mm.seq = 0; } else { mm.base = known; mm.seq = r.seq || mm.seq; }
      await saveMeta();
      const rej = (r.rejected || []).length;
      setStatus({ state: rej ? 'warn' : 'ok', lastSync: Date.now(), pushed, pulled, error: rej ? rej + ' Aenderung(en) vom Server abgelehnt: ' + r.rejected.map(x => x.error).slice(0, 2).join('; ') : null });
    } catch (e) {
      setStatus({ state: 'error', error: e && e.message ? e.message : String(e) });
    } finally {
      running = null;
    }
    if (again) { again = false; setTimeout(syncNow, 50); }
    return status;
  })();
  return running;
}

let started = false;
let timer = null;
let poll = null;
export function startSync({ intervalMs = 15000 } = {}) {
  if (started) return;
  started = true;
  const kick = (delay = 1200) => { clearTimeout(timer); timer = setTimeout(() => { if (hasServer()) syncNow(); }, delay); };
  db.subscribe(ev => { if (ev && ev.type !== 'ready' && hasServer()) kick(); });
  const sig = s => String(s.serverUrl || '') + '|' + String(s.serverToken || '');
  let last = sig(getSettings());
  subscribeSettings(s => { const k = sig(s); if (k !== last) { last = k; kick(300); } });
  poll = setInterval(() => { if (hasServer()) syncNow(); }, intervalMs);
  kick(500);
}

// Verbindung trennen: lokale Daten bleiben, Sync-Stand wird vergessen
export async function resetSync() {
  meta = { seq: 0, base: {}, server: '' };
  await saveMeta();
  setStatus({ state: hasServer() ? 'idle' : 'off', error: null, lastSync: null });
}
