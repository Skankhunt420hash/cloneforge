import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Card, Btn, Chip, Field, H2, Muted, Row } from '../ui/kit.js';
import { useSettings, updateSettings } from '../settings.js';
import { ACCENTS, theme } from '../theme.js';
import { getLog, onActivity, clearLog } from '../activity.js';
import { APP } from '../meta.js';
import { aiStatus, ask, detectProvider, PROVIDERS } from '../ai.js';
import { serverInfo } from '../server.js';
import { syncNow, getSyncStatus, onSyncStatus, resetSync } from '../sync.js';

const MODES = [['auto', '🌗 Automatisch'], ['light', '☀️ Hell'], ['dark', '🌙 Dunkel']];
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.round(m / 60)} Std.` : new Date(t).toLocaleDateString(); };
const SYNC_TEXT = { off: 'Aus (nur dieses Geraet)', idle: 'Bereit', syncing: 'Synchronisiert …', ok: 'Synchron', warn: 'Synchron mit Hinweisen', error: 'Fehler' };

function AiCard() {
  const st = useSettings();
  const [key, setKey] = useState(st.aiKey || '');
  const [model, setModel] = useState(st.aiModel || '');
  const [status, setStatus] = useState(null);
  const [test, setTest] = useState('');
  useEffect(() => { setKey(st.aiKey || ''); setModel(st.aiModel || ''); }, [st.loaded]);
  useEffect(() => { aiStatus().then(setStatus).catch(() => setStatus(null)); }, [st.aiKey, st.serverUrl, st.serverToken]);
  const prov = detectProvider(key);
  const save = async () => { await updateSettings({ aiKey: key.trim(), aiModel: model.trim() }); setTest(''); };
  const run = async () => {
    await save();
    setTest('Teste …');
    try { const r = await ask('Antworte nur mit: Alles klar!', { maxTokens: 50 }); setTest('✅ KI antwortet: ' + r.trim().slice(0, 80)); } catch (e) { setTest('❌ ' + e.message); }
  };
  return (
    <Card>
      <H2>🤖 KI</H2>
      <Muted>Status: {status ? status.label : '…'}</Muted>
      <Muted>Kostenlose Keys gibt es bei OpenRouter (openrouter.ai/keys), Google AI Studio (aistudio.google.com/apikey) oder Groq (console.groq.com/keys). Der Key bleibt auf diesem Geraet und geht nur an den Anbieter.</Muted>
      <Field label={'API-Key' + (prov ? ' · erkannt: ' + PROVIDERS[prov].label : '')} value={key} onChangeText={setKey} placeholder="sk-or-v1-… / AIza… / gsk_… / sk-…" secure />
      <Field label="Modell (optional, sonst automatisch)" value={model} onChangeText={setModel} placeholder={prov ? PROVIDERS[prov].models[0] : 'automatisch'} />
      <Row>
        <Btn small label="Speichern" onPress={save} />
        <Btn small kind="ghost" label="Verbindung testen" onPress={run} />
        {st.aiKey ? <Btn small kind="ghost" label="Key entfernen" onPress={() => { setKey(''); updateSettings({ aiKey: '' }); }} /> : null}
      </Row>
      {test ? <Text style={{ color: theme.text, marginTop: 6 }}>{test}</Text> : null}
    </Card>
  );
}

function ServerCard() {
  const st = useSettings();
  const [url, setUrl] = useState(st.serverUrl || '');
  const [token, setToken] = useState(st.serverToken || '');
  const [sync, setSync] = useState(getSyncStatus());
  const [info, setInfo] = useState('');
  useEffect(() => { setUrl(st.serverUrl || ''); setToken(st.serverToken || ''); }, [st.loaded]);
  useEffect(() => onSyncStatus(setSync), []);
  const connect = async () => {
    await updateSettings({ serverUrl: url.trim(), serverToken: token.trim() });
    if (!url.trim()) { setInfo(''); return; }
    setInfo('Pruefe Server …');
    const i = await serverInfo(true);
    if (!i || !i.ok) { setInfo('❌ ' + ((i && i.error) || 'Server nicht erreichbar')); return; }
    setInfo(`✅ Verbunden mit „${i.app}" · ${i.ai ? 'KI auf dem Server aktiv' : 'ohne Server-KI'}`);
    await syncNow();
  };
  const disconnect = async () => { setUrl(''); setToken(''); await updateSettings({ serverUrl: '', serverToken: '' }); await resetSync(); setInfo('Getrennt. Die Daten bleiben auf diesem Geraet.'); };
  return (
    <Card>
      <H2>☁️ Server & Sync</H2>
      <Muted>Optional: Mit dem mitgelieferten Backend (Ordner server/) teilen sich mehrere Geraete und Personen dieselben Daten. Start: npm run server – Adresse und Zugangsschluessel stehen dann in der Konsole.</Muted>
      <Field label="Server-Adresse" value={url} onChangeText={setUrl} placeholder="z. B. 192.168.1.20:8787 oder meine-app.example.com" />
      <Field label="Zugangsschluessel" value={token} onChangeText={setToken} placeholder="steht beim Serverstart in der Konsole" secure />
      <Row>
        <Btn small label="Verbinden" onPress={connect} />
        {st.serverUrl ? <Btn small kind="ghost" label="Jetzt synchronisieren" onPress={() => syncNow()} /> : null}
        {st.serverUrl ? <Btn small kind="ghost" label="Trennen" onPress={disconnect} /> : null}
      </Row>
      {info ? <Text style={{ color: theme.text, marginTop: 6 }}>{info}</Text> : null}
      <Muted>Sync: {SYNC_TEXT[sync.state] || sync.state}{sync.lastSync ? ' · ' + ago(sync.lastSync) : ''}{sync.state === 'ok' || sync.state === 'warn' ? ` · ↑${sync.pushed} ↓${sync.pulled}` : ''}</Muted>
      {sync.error ? <Text style={{ color: theme.danger, marginTop: 4 }}>{sync.error}</Text> : null}
    </Card>
  );
}

export default function SettingsScreen() {
  const st = useSettings();
  const [log, setLog] = useState([]);
  useEffect(() => { const f = () => getLog().then(setLog); f(); return onActivity(f); }, []);
  return (
    <Screen title="Einstellungen" subtitle={`${APP.name} · Version ${APP.version}`}>
      <Card>
        <H2>Darstellung</H2>
        <Muted>Modus</Muted>
        <Row>{MODES.map(([k, l]) => <Chip key={k} label={l} active={st.mode === k} onPress={() => updateSettings({ mode: k })} />)}</Row>
        <Muted>Akzentfarbe</Muted>
        <Row>
          {ACCENTS.map(c => (
            <Text key={c} onPress={() => updateSettings({ accent: c })} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, marginRight: 10, marginTop: 6, borderWidth: 3, borderColor: (st.accent || ACCENTS[0]) === c ? theme.text : 'transparent', overflow: 'hidden' }}> </Text>
          ))}
        </Row>
      </Card>
      <AiCard />
      <ServerCard />
      <Card>
        <H2>Verlauf</H2>
        {log.length === 0 ? <Muted>Noch keine Aenderungen.</Muted> : log.slice(0, 25).map((l, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: theme.text, flex: 1 }}>{l.text}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>{ago(l.t)}</Text>
          </View>
        ))}
        {log.length ? <Btn small kind="ghost" label="Verlauf leeren" onPress={clearLog} /> : null}
      </Card>
      <Card>
        <H2>Ueber die App</H2>
        <Muted>{APP.name} · Version {APP.version}</Muted>
        <Muted>Datenschutz: Deine Daten liegen auf diesem Geraet. Nur wenn du oben einen eigenen Server verbindest, werden sie dorthin synchronisiert. KI-Anfragen gehen nur an den KI-Anbieter deines Keys (oder ueber deinen Server). Sicherungen findest du unter „Daten", die Gesundheit der App unter „Gesund".</Muted>
        <Btn small kind="ghost" label="Willkommens-Tour nochmal zeigen" onPress={() => updateSettings({ onboarded: false })} />
      </Card>
    </Screen>
  );
}
