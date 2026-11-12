// Werkzeuge fuer den KI-Agenten: automatisch aus Schema + Services gebaut.
// Die KI bedient damit dieselben Funktionen wie die Oberflaeche (Validierung inklusive).
import { schema } from './db/schema.js';
import { META, AI_FEATURES } from './meta.js';
import { SERVICES } from './aitools.js';

const BASE = new Set(['list', 'get', 'count', 'create', 'update', 'remove', 'samples']);
const DANGER = /^(remove|delete|clear|reset|purge|wipe)/i;

export function fieldText(name) {
  const c = schema.collections[name];
  if (!c) return '';
  return Object.entries(c.fields).map(([f, d]) => {
    let t = f + ':' + d.type;
    if (d.values) t += '(' + d.values.join('|') + ')';
    if (d.to) t += '→' + d.to;
    if (d.required) t += '*';
    return t;
  }).join(', ');
}

const compact = (doc, max = 400) => { const s = JSON.stringify(doc); return s.length > max ? JSON.parse(JSON.stringify(doc, (k, v) => (typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v))) : doc; };

function matchText(doc, q) {
  const s = String(q || '').toLowerCase();
  if (!s) return true;
  return Object.values(doc).some(v => v != null && String(v).toLowerCase().includes(s));
}

export function buildTools() {
  const tools = [];
  for (const m of META) {
    const svc = SERVICES[m.name];
    if (!svc) continue;
    const label = m.label || m.name;
    tools.push({
      name: m.name + '_list',
      params: '{ suche?: Text, where?: { feld: wert }, limit?: Zahl }',
      description: `Eintraege aus "${label}" auflisten/suchen. Felder: ${fieldText(m.name)}`,
      run: async a => {
        let rows = svc.list(a && a.where && typeof a.where === 'object' ? { where: a.where } : undefined);
        if (a && a.suche) rows = rows.filter(d => matchText(d, a.suche));
        const lim = Math.min(Number(a && a.limit) || 30, 60);
        return { anzahl: rows.length, eintraege: rows.slice(0, lim).map(d => compact(d)) };
      },
    });
    tools.push({ name: m.name + '_get', params: '{ id }', description: `Einen Eintrag aus "${label}" lesen`, run: async a => svc.get(String(a.id)) || { fehler: 'nicht gefunden' } });
    tools.push({ name: m.name + '_create', params: '{ daten: { ... } }', description: `Neuen Eintrag in "${label}" anlegen (Pflichtfelder mit *). Felder: ${fieldText(m.name)}`, run: async a => svc.create(a.daten || a.data || {}) });
    tools.push({ name: m.name + '_update', params: '{ id, daten: { nur geaenderte Felder } }', description: `Eintrag in "${label}" aendern`, run: async a => svc.update(String(a.id), a.daten || a.data || {}) });
    tools.push({ name: m.name + '_remove', params: '{ id }', danger: true, description: `Eintrag aus "${label}" loeschen`, run: async a => svc.remove(String(a.id)) });
    for (const fn of Object.keys(svc)) {
      if (BASE.has(fn) || typeof svc[fn] !== 'function') continue;
      tools.push({
        name: m.name + '_' + fn,
        params: `{ args: [ ${svc[fn].length} Argument(e) ] }`,
        danger: DANGER.test(fn),
        description: `Fachfunktion "${fn}" von "${label}"`,
        run: async a => { const r = await svc[fn](...(Array.isArray(a && a.args) ? a.args : [])); return r === undefined ? 'ok' : r; },
      });
    }
  }
  return tools;
}

// Kurzer Ueberblick ueber die Daten (fuer den System-Prompt)
export function dataSummary() {
  return META.map(m => {
    const svc = SERVICES[m.name];
    const n = svc ? svc.count() : 0;
    return `${m.emoji || ''} ${m.label} (${m.name}): ${n} Eintraege`;
  }).join('\n');
}

// Daten einer Sammlung kompakt fuer KI-Auswertungen
export function dataFor(name, limit = 60) {
  const svc = SERVICES[name];
  if (!svc) return [];
  return svc.list().slice(-limit).map(d => { const { createdAt, updatedAt, ...rest } = d; return compact(rest, 300); });
}

// Schnellaktionen: aus dem Bauplan (AI_FEATURES), sonst sinnvolle Standards je Sammlung
export function features() {
  if (Array.isArray(AI_FEATURES) && AI_FEATURES.length) return AI_FEATURES.filter(f => META.some(m => m.name === f.entity));
  const out = [];
  for (const m of META.slice(0, 3)) {
    out.push({ title: `${m.label} auswerten`, emoji: '📊', entity: m.name, output: 'text', task: `Werte die Eintraege aus "${m.label}" aus: Auffaelligkeiten, Trends, 3 konkrete Tipps.` });
    out.push({ title: `${m.label}: Ideen`, emoji: '✨', entity: m.name, output: 'entries', task: `Schlage 3 neue, sinnvolle Eintraege fuer "${m.label}" vor, passend zu den vorhandenen Daten.` });
  }
  return out;
}
