import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Screen, Card, Btn, Chip, H2, Muted, Row } from '../ui/kit.js';
import { theme } from '../theme.js';
import { useNav } from '../nav.js';
import { useSettings } from '../settings.js';
import { APP, META } from '../meta.js';
import { aiStatus, runAgent, ask, askJSON } from '../ai.js';
import { buildTools, dataSummary, dataFor, features, fieldText } from '../agenttools.js';
import { SERVICES } from '../aitools.js';
import { schema } from '../db/schema.js';
import { toast } from '../toast.js';

// KI-Assistent: Chat, der die App wirklich bedient (Eintraege suchen, anlegen, aendern, auswerten),
// plus Schnellaktionen aus dem Bauplan der App.
function confirmAsync(text) {
  return new Promise(resolve => {
    if (Platform.OS === 'web') { resolve(typeof window !== 'undefined' ? window.confirm('Darf die KI das tun?\n\n' + text) : false); return; }
    Alert.alert('Darf die KI das tun?', text, [{ text: 'Nein', style: 'cancel', onPress: () => resolve(false) }, { text: 'Ja', style: 'destructive', onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

const STORE = [];
const short = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > 140 ? s.slice(0, 140) + '…' : s; };

export default function AssistantScreen() {
  const nav = useNav();
  const st = useSettings();
  const [status, setStatus] = useState({ mode: null, label: '…' });
  const [msgs, setMsgs] = useState(STORE);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [imp, setImp] = useState(null); // { entity, text }
  const scroll = useRef(null);
  const tools = useMemo(() => buildTools(), []);
  const quick = useMemo(() => features(), []);

  useEffect(() => { aiStatus().then(setStatus).catch(() => setStatus({ mode: null, label: 'Nicht eingerichtet' })); }, [st.aiKey, st.serverUrl, st.serverToken]);
  const push = m => { STORE.push(m); if (STORE.length > 60) STORE.splice(0, STORE.length - 60); setMsgs([...STORE]); };
  useEffect(() => { setTimeout(() => scroll.current && scroll.current.scrollToEnd && scroll.current.scrollToEnd({ animated: true }), 60); }, [msgs.length]);

  const system = () => `App: ${APP.name}. Heute: ${new Date().toISOString().slice(0, 10)}.\nDATEN:\n${dataSummary()}`;

  async function send(text) {
    const q = String(text || input).trim();
    if (!q || busy) return;
    setInput('');
    const history = [...STORE.filter(m => m.role === 'user' || m.role === 'assistant').slice(-11), { role: 'user', content: q }];
    push({ role: 'user', content: q });
    setBusy(true);
    try {
      const r = await runAgent({ messages: history, tools, system: system(), confirm: confirmAsync, onStep: s => push({ role: 'step', content: `🔧 ${s.tool} ${short(s.args)} → ${s.error ? '❌ ' + s.error : '✅ ' + short(s.result)}` }) });
      push({ role: 'assistant', content: r.answer });
    } catch (e) {
      push({ role: 'error', content: e.message || String(e) });
    } finally { setBusy(false); }
  }

  async function runFeature(f) {
    if (busy) return;
    const m = META.find(x => x.name === f.entity);
    if (!m) return;
    push({ role: 'user', content: `${f.emoji || '✨'} ${f.title}` });
    setBusy(true);
    try {
      const rows = dataFor(f.entity);
      const base = `App: ${APP.name}. Sammlung "${m.label}" (${f.entity}). Heute: ${new Date().toISOString().slice(0, 10)}.\nVORHANDENE DATEN (JSON):\n${JSON.stringify(rows).slice(0, 12000)}\n\nAUFGABE: ${f.task}`;
      if (f.output === 'entries') {
        const j = await askJSON(`${base}\n\nGib {"eintraege":[{...}]} zurueck. Jeder Eintrag nutzt NUR diese Felder: ${fieldText(f.entity)} (Pflichtfelder mit *, ref-Felder = id aus den Daten, Datum als ISO-Text).`, { maxTokens: 2500 });
        const list = (Array.isArray(j) ? j : j.eintraege || j.entries || []).filter(x => x && typeof x === 'object').slice(0, 10);
        if (!list.length) throw new Error('Die KI hat keine Vorschlaege geliefert.');
        setProposal({ entity: f.entity, label: m.label, titleField: m.titleField, items: list });
        push({ role: 'assistant', content: `${list.length} Vorschlaege fuer „${m.label}" – unten pruefen und uebernehmen.` });
      } else {
        push({ role: 'assistant', content: await ask(base + '\n\nAntworte auf Deutsch, klar gegliedert, maximal 200 Woerter.', { maxTokens: 1500 }) });
      }
    } catch (e) {
      push({ role: 'error', content: e.message || String(e) });
    } finally { setBusy(false); }
  }

  // KI-Import: beliebiger Text (Liste, Mail, Notizen, CSV) → fertige Eintraege
  async function runImport() {
    const m = META.find(x => x.name === imp.entity);
    const text = String(imp.text || '').trim();
    if (!m || !text || busy) return;
    push({ role: 'user', content: `📥 Import nach „${m.label}" (${text.length} Zeichen)` });
    setBusy(true);
    try {
      const fields = schema.collections[m.name].fields;
      const refs = Object.entries(fields).filter(([, d]) => d.type === 'ref').map(([f, d]) => {
        const t = META.find(x => x.name === d.to);
        const rows = SERVICES[d.to] ? SERVICES[d.to].list().slice(0, 60).map(r => ({ id: r.id, name: t ? r[t.titleField] : r.id })) : [];
        return `${f} → ${d.to}: ${JSON.stringify(rows)}`;
      }).join('\n');
      const j = await askJSON(`Lies den folgenden Text und erzeuge daraus Datensaetze fuer die Sammlung "${m.label}".
Felder: ${fieldText(m.name)} (Pflichtfelder mit *; enum nur erlaubte Werte; Datum als ISO-Text JJJJ-MM-TTT00:00:00.000Z; Zahlen als Zahl).
${refs ? 'Verweise (ref) NUR mit diesen ids:\n' + refs + '\n' : ''}Gib {"eintraege":[{...}]} zurueck, hoechstens 30 Eintraege, nichts erfinden, was nicht im Text steht.
TEXT:
${text.slice(0, 15000)}`, { maxTokens: 4000 });
      const list = (Array.isArray(j) ? j : j.eintraege || j.entries || []).filter(x => x && typeof x === 'object').slice(0, 30);
      if (!list.length) throw new Error('Die KI hat im Text keine passenden Eintraege gefunden.');
      setProposal({ entity: m.name, label: m.label, titleField: m.titleField, items: list });
      setImp(null);
      push({ role: 'assistant', content: `${list.length} Eintraege erkannt – unten pruefen und uebernehmen.` });
    } catch (e) {
      push({ role: 'error', content: e.message || String(e) });
    } finally { setBusy(false); }
  }

  async function accept(items) {
    const svc = SERVICES[proposal.entity];
    const allowed = Object.keys(schema.collections[proposal.entity].fields);
    let ok = 0; const errs = [];
    for (const raw of items) {
      const it = {};
      for (const k of allowed) if (raw[k] !== undefined && raw[k] !== '') it[k] = raw[k];
      try { await svc.create(it); ok++; } catch (e) { errs.push(e.message); }
    }
    toast(ok + ' Eintrag/Eintraege angelegt' + (errs.length ? ', ' + errs.length + ' fehlerhaft' : ''), errs.length ? 'warn' : 'ok');
    if (errs.length) push({ role: 'error', content: 'Nicht uebernommen: ' + errs.slice(0, 3).join('; ') });
    setProposal(null);
  }

  const bubble = m => {
    const mine = m.role === 'user';
    if (m.role === 'step') return <Text style={{ color: theme.muted, fontSize: 12, marginVertical: 2 }}>{m.content}</Text>;
    return (
      <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: mine ? theme.primary : m.role === 'error' ? theme.danger : theme.card, borderColor: theme.border, borderWidth: mine ? 0 : 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginVertical: 4 }}>
        <Text selectable style={{ color: mine || m.role === 'error' ? '#fff' : theme.text, lineHeight: 20 }}>{m.content}</Text>
      </View>
    );
  };

  if (!status.mode) {
    return (
      <Screen title="KI-Assistent" subtitle="Noch nicht eingerichtet">
        <Card>
          <H2>🤖 KI einschalten</H2>
          <Muted>Der Assistent kann deine Daten durchsuchen, auswerten, Eintraege anlegen und aendern – per Chat.</Muted>
          <Muted>So geht's: kostenlosen API-Key holen (z. B. bei OpenRouter, Google AI Studio oder Groq) und unter Einstellungen → KI einfuegen. Oder einen eigenen Server mit KI-Schluessel verbinden.</Muted>
          <Btn label="Zu den Einstellungen" onPress={() => nav.goTab('SettingsScreen')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="KI-Assistent" subtitle={'Verbunden: ' + status.label} scroll={false} padded={false}
      right={msgs.length ? <Pressable onPress={() => { STORE.length = 0; setMsgs([]); setProposal(null); }}><Text style={{ color: theme.muted, paddingBottom: 6 }}>🧹 Neu</Text></Pressable> : null}>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {quick.length ? (
          <View style={{ marginBottom: 8 }}>
            <Muted>Schnellaktionen</Muted>
            <Row>
              {quick.map((f, i) => <Chip key={i} label={(f.emoji || '✨') + ' ' + f.title} onPress={() => runFeature(f)} />)}
              <Chip label="📥 Text importieren" active={!!imp} onPress={() => setImp(imp ? null : { entity: META[0] ? META[0].name : '', text: '' })} />
            </Row>
          </View>
        ) : null}
        {imp ? (
          <Card>
            <H2>📥 Mit KI importieren</H2>
            <Muted>Text, Liste, E-Mail, Notizen oder CSV einfuegen – die KI macht daraus Eintraege. Wohin?</Muted>
            <Row>{META.map(m => <Chip key={m.name} label={(m.emoji || '') + ' ' + m.label} active={imp.entity === m.name} onPress={() => setImp({ ...imp, entity: m.name })} />)}</Row>
            <TextInput value={imp.text} onChangeText={t => setImp({ ...imp, text: t })} multiline placeholder="Hier Text einfuegen …" placeholderTextColor={theme.muted}
              style={{ minHeight: 120, color: theme.text, backgroundColor: theme.bg, borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: theme.border, textAlignVertical: 'top' }} />
            <Row><Btn small label="Eintraege erkennen" disabled={busy || !imp.text.trim()} onPress={runImport} /><Btn small kind="ghost" label="Abbrechen" onPress={() => setImp(null)} /></Row>
          </Card>
        ) : null}
        {msgs.length === 0 ? (
          <Card>
            <Muted>Frag mich etwas oder gib mir einen Auftrag, z. B.:</Muted>
            {[`Was steht in ${META[0] ? META[0].label : 'meinen Daten'}?`, `Leg einen neuen Eintrag in ${META[0] ? META[0].label : 'der App'} an`, 'Fass meine Daten kurz zusammen'].map(s => (
              <Pressable key={s} onPress={() => send(s)}><Text style={{ color: theme.primary, marginTop: 8 }}>› {s}</Text></Pressable>
            ))}
          </Card>
        ) : msgs.map((m, i) => <View key={i}>{bubble(m)}</View>)}
        {proposal ? (
          <Card>
            <H2>Vorschlaege: {proposal.label}</H2>
            {proposal.items.map((it, i) => (
              <View key={i} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{String(it[proposal.titleField] || Object.values(it)[0] || 'Eintrag')}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{short(it)}</Text>
                <Btn small kind="ghost" label="Nur diesen uebernehmen" onPress={() => accept([it])} />
              </View>
            ))}
            <Row><Btn small label="Alle uebernehmen" onPress={() => accept(proposal.items)} /><Btn small kind="ghost" label="Verwerfen" onPress={() => setProposal(null)} /></Row>
          </Card>
        ) : null}
        {busy ? <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted, marginLeft: 8 }}>KI arbeitet …</Text></View> : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.card }}>
        <TextInput value={input} onChangeText={setInput} placeholder="Nachricht an die KI …" placeholderTextColor={theme.muted} multiline onSubmitEditing={() => send()} blurOnSubmit
          style={{ flex: 1, color: theme.text, backgroundColor: theme.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120, borderWidth: 1, borderColor: theme.border }} />
        <Pressable onPress={() => send()} disabled={busy || !input.trim()} style={{ marginLeft: 8, backgroundColor: theme.primary, opacity: busy || !input.trim() ? 0.5 : 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Senden</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
