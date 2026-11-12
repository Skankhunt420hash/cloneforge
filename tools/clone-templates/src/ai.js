// KI-Baustein der App: Text, JSON und ein Agent, der die App-Funktionen (Tools) selbst bedient.
// Zugang (einer reicht):
//  1) eigener Server mit KI-Schluessel (server/ → Variable AI_API_KEY): der Schluessel bleibt auf dem Server
//  2) API-Key direkt in der App (Einstellungen → KI): OpenRouter, Google AI Studio, Groq oder OpenAI
import { getSettings } from './settings.js';
import { api, serverInfo, hasServer } from './server.js';

export const PROVIDERS = {
  openrouter: { label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', models: ['nvidia/nemotron-3-super-120b-a12b:free', 'qwen/qwen3.8-27b:free', 'qwen/qwen3-coder:free', 'poolside/laguna-xs-2.1:free'] },
  google: { label: 'Google AI Studio', base: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'] },
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'] },
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', models: ['gpt-5.4-mini', 'gpt-5.5'], tokenField: 'max_completion_tokens' },
};

export function detectProvider(key) {
  const k = String(key || '').trim();
  if (/^sk-or-/.test(k)) return 'openrouter';
  if (/^AIza/.test(k)) return 'google';
  if (/^gsk_/.test(k)) return 'groq';
  if (/^sk-/.test(k)) return 'openai';
  return null;
}

// Wie wird die KI gerade erreicht? { mode: 'server' | 'key' | null, label }
export async function aiStatus() {
  const s = getSettings();
  if (hasServer()) {
    const i = await serverInfo();
    if (i && i.ok && i.ai) return { mode: 'server', label: 'Eigener Server' + (i.aiProvider ? ' · ' + i.aiProvider : '') };
  }
  const p = detectProvider(s.aiKey);
  if (p) return { mode: 'key', label: PROVIDERS[p].label };
  return { mode: null, label: 'Nicht eingerichtet' };
}

export async function aiReady() { return !!(await aiStatus()).mode; }

const wait = ms => new Promise(r => setTimeout(r, ms));

async function callProvider({ key, model, messages, maxTokens, json, temperature }) {
  const provider = detectProvider(key);
  if (!provider) throw new Error('Unbekanntes Key-Format. Erlaubt: OpenRouter (sk-or-…), Google (AIza…), Groq (gsk_…), OpenAI (sk-…).');
  const P = PROVIDERS[provider];
  const list = model ? [model, ...P.models.filter(m => m !== model)] : P.models;
  let last = null;
  for (const m of list) {
    const body = { model: m, messages, temperature: temperature == null ? 0.4 : temperature };
    body[P.tokenField || 'max_tokens'] = maxTokens || 1500;
    if (json && provider !== 'openrouter') body.response_format = { type: 'json_object' };
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await fetch(P.base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body) });
      } catch (e) { last = new Error('Netzwerkfehler: ' + e.message); break; }
      let j = null;
      try { j = await res.json(); } catch (e) { j = null; }
      if (res.ok) {
        const text = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
        if (text) return { text: String(text), model: m, provider };
        last = new Error('Leere Antwort von ' + m);
        break;
      }
      const msg = (j && j.error && (j.error.message || j.error)) || 'HTTP ' + res.status;
      last = new Error(String(msg).slice(0, 300));
      if (res.status === 401 || res.status === 403) throw new Error('KI-Key ungueltig oder ohne Rechte: ' + last.message);
      if (res.status === 429 && attempt === 0) { await wait(2500); continue; }
      break; // 404 / 400 / 5xx → naechstes Modell
    }
  }
  throw last || new Error('Kein KI-Modell erreichbar');
}

// Grundfunktion: schickt Nachrichten an die KI und liefert den Antworttext.
export async function chat(messages, { system, maxTokens = 1500, json = false, temperature } = {}) {
  const msgs = [...(system ? [{ role: 'system', content: system }] : []), ...messages.map(m => ({ role: m.role, content: String(m.content) }))];
  const st = await aiStatus();
  if (st.mode === 'server') {
    const r = await api('/api/ai/chat', { method: 'POST', body: { messages: msgs, maxTokens, json, temperature }, timeoutMs: 120000 });
    return String(r.text || '');
  }
  if (st.mode === 'key') {
    const s = getSettings();
    return (await callProvider({ key: String(s.aiKey).trim(), model: String(s.aiModel || '').trim(), messages: msgs, maxTokens, json, temperature })).text;
  }
  throw new Error('KI ist noch nicht eingerichtet: Einstellungen → KI (kostenloser Key) oder eigener Server.');
}

export async function ask(prompt, opts = {}) {
  return chat([{ role: 'user', content: prompt }], opts);
}

export function parseJSON(text) {
  const t = String(text || '').replace(/```(?:json)?/gi, '');
  const starts = [t.indexOf('{'), t.indexOf('[')].filter(i => i >= 0);
  if (!starts.length) throw new Error('Die KI hat kein JSON geliefert.');
  const a = Math.min(...starts);
  const close = t[a] === '{' ? '}' : ']';
  const b = t.lastIndexOf(close);
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error('Die KI hat ungueltiges JSON geliefert.'); }
}

export async function askJSON(prompt, opts = {}) {
  const sys = (opts.system ? opts.system + '\n' : '') + 'Antworte NUR mit gueltigem JSON, ohne Erklaerung.';
  try { return parseJSON(await ask(prompt, { ...opts, system: sys, json: true })); } catch (e) {
    return parseJSON(await ask(prompt + '\n\nWICHTIG: Nur reines JSON ausgeben.', { ...opts, system: sys, json: true }));
  }
}

// Agent: die KI darf Werkzeuge (Funktionen der App) aufrufen, bis sie die Aufgabe erledigt hat.
// tools: [{ name, description, params: 'Beschreibung der Argumente', danger?: bool, run: async args => result }]
// confirm(text) → Promise<boolean> fuer gefaehrliche Aktionen (Loeschen). onStep({ tool, args, result, error }) zum Anzeigen.
export async function runAgent({ messages, tools = [], system = '', maxSteps = 8, onStep = () => {}, confirm = async () => true }) {
  const toolText = tools.map(t => `- ${t.name}(${t.params || ''}): ${t.description}${t.danger ? ' [braucht Bestaetigung]' : ''}`).join('\n');
  const sys = `${system}
Du bist der eingebaute KI-Assistent dieser App. Du kannst die Daten der App lesen und aendern, indem du Werkzeuge aufrufst.
WERKZEUGE:
${toolText || '(keine)'}
ANTWORTFORMAT (immer genau EIN JSON-Objekt, nichts sonst):
{"tool":"name","args":{...}}   → ein Werkzeug ausfuehren (du bekommst das Ergebnis und machst weiter)
{"answer":"..."}               → fertige Antwort an den Nutzer (Deutsch, kurz, freundlich)
Regeln: Erfinde keine IDs – hol sie dir mit den Listen-Werkzeugen. Nutze nur Felder, die es gibt. Fasse am Ende zusammen, was du getan hast.`;
  const convo = messages.map(m => ({ role: m.role, content: String(m.content) }));
  for (let step = 0; step < maxSteps; step++) {
    const raw = await chat(convo, { system: sys, maxTokens: 1800, json: true, temperature: 0.2 });
    let msg;
    try { msg = parseJSON(raw); } catch (e) { return { answer: String(raw).trim() }; }
    if (msg && typeof msg.answer === 'string' && !msg.tool) return { answer: msg.answer };
    const tool = tools.find(t => t.name === (msg && msg.tool));
    convo.push({ role: 'assistant', content: JSON.stringify(msg) });
    if (!tool) { convo.push({ role: 'user', content: `Werkzeug "${msg && msg.tool}" gibt es nicht. Erlaubt: ${tools.map(t => t.name).join(', ')}. Antworte wieder im JSON-Format.` }); continue; }
    const args = msg.args && typeof msg.args === 'object' ? msg.args : {};
    let result, error = null;
    try {
      if (tool.danger && !(await confirm(`${tool.description}\n${JSON.stringify(args)}`))) throw new Error('Vom Nutzer abgelehnt');
      result = await tool.run(args);
    } catch (e) { error = e && e.message ? e.message : String(e); }
    onStep({ tool: tool.name, args, result, error });
    const shown = error ? { error } : { result: result === undefined ? 'ok' : result };
    convo.push({ role: 'user', content: 'ERGEBNIS ' + tool.name + ': ' + JSON.stringify(shown).slice(0, 6000) });
  }
  return { answer: 'Ich habe die maximale Anzahl Schritte erreicht. Sag mir, ob ich weitermachen soll.' };
}
