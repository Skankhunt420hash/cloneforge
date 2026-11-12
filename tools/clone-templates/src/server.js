// Verbindung zum eigenen Backend-Server (optional, Ordner server/ im Projekt).
// Ohne Server-Adresse laeuft die App komplett lokal weiter.
import { getSettings } from './settings.js';

export function serverBase() {
  let u = String(getSettings().serverUrl || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^[a-z]+:\/\//i.test(u)) u = (/^(localhost|127\.|10\.|192\.168\.)/.test(u) ? 'http' : 'https') + '://' + u;
  return u;
}

export const hasServer = () => !!serverBase();

export async function api(path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
  const base = serverBase();
  if (!base) throw new Error('Kein Server eingetragen (Einstellungen → Server).');
  const headers = { 'Content-Type': 'application/json' };
  const token = String(getSettings().serverToken || '').trim();
  if (token) headers.Authorization = 'Bearer ' + token;
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Server antwortet nicht (Zeitlimit)')), timeoutMs); });
  try {
    const res = await Promise.race([fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), timeout]);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = data && data.error ? data.error : 'HTTP ' + res.status;
      throw Object.assign(new Error(res.status === 401 ? 'Server verweigert den Zugang: Zugangsschluessel pruefen.' : msg), { status: res.status });
    }
    return data;
  } catch (e) {
    if (e && e.status) throw e;
    throw new Error('Server nicht erreichbar: ' + (e && e.message ? e.message : e));
  } finally { clearTimeout(timer); }
}

let info = null;
let infoAt = 0;
// Fragt den Server, was er kann ({ ok, ai, app, version }). Ergebnis wird 60 s gemerkt.
export async function serverInfo(force) {
  if (!hasServer()) return null;
  if (!force && info && Date.now() - infoAt < 60000) return info;
  try { info = await api('/api/health', { timeoutMs: 8000 }); } catch (e) { info = { ok: false, error: e.message }; }
  infoAt = Date.now();
  return info;
}
