// CloneForge UI-Erweiterung: Navigation, Projektleiste, App-Mixer, Launch-Kit.
// Wird mit esbuild zu einem Metro-Modul gebaut und von tools/patch_ui.py in index.html eingesetzt.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Platform, Linking, useWindowDimensions } from 'react-native';
import { C, GLOW, Btn, Chip } from 'cf/ui';
import { askJSON, makeTally } from 'cf/ai';
import { saveBytes } from 'cf/save';

const WEB = Platform.OS === 'web';
const hexA = (h, a) => { const n = parseInt(String(h || '#000000').slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const clip = (s, n) => String(s || '').slice(0, n);
const escH = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugOf = p => (p && (p.slug || String(p.name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))) || 'app';

/* ------------------------------------------------------------------ Layout */

export function useWide() {
  const { width } = useWindowDimensions();
  return width >= 1040;
}
export const SIDEBAR = 232;

const MAIN = [
  { key: 'clone', icon: '⚡', label: 'Klonen' },
  { key: 'lib', icon: '🧬', label: 'Apps' },
  { key: 'chat', icon: '✏️', label: 'Studio' },
  { key: 'launch', icon: '🚀', label: 'Launch' },
];
const MORE = [
  { key: 'pack', icon: '📦', label: 'Packen', sub: 'ZIP, APK, Web, Desktop' },
  { key: 'mission', icon: '🎯', label: 'Mission', sub: 'Autopilot baut die App weiter aus' },
  { key: 'doctor', icon: '🩺', label: 'Doctor', sub: 'Keys, Models und Projekt prüfen' },
  { key: 'settings', icon: '⚙️', label: 'Einstellungen', sub: 'API-Keys, Strategie, GitHub' },
  { key: 'about', icon: 'ℹ️', label: 'Info', sub: 'Version und Updates' },
];
const GROUPS = [
  { title: 'Bauen', items: ['clone', 'lib', 'chat', 'mission'] },
  { title: 'Verkaufen', items: ['launch', 'pack'] },
  { title: 'System', items: ['doctor', 'settings', 'about'] },
];
const ALL = Object.fromEntries([...MAIN, ...MORE].map(t => [t.key, t]));

function docBadge(key, doctor) {
  if (key !== 'doctor' || !doctor) return '';
  return doctor.errors ? ' ❌' : doctor.warnings ? ' ⚠️' : ' ✅';
}

export function Nav({ tab, setTab, more, setMore, inset = 0, doctor, missionRunning, wide, project }) {
  if (wide) {
    return (
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR, backgroundColor: 'rgba(6,9,20,0.97)', borderRightWidth: 1, borderRightColor: 'rgba(0,229,255,0.25)', paddingTop: 18, paddingHorizontal: 12, zIndex: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 18 }}>
          <View style={[{ width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, borderColor: C.acc, alignItems: 'center', justifyContent: 'center' }, GLOW(C.acc, 0.5, 12)]}>
            <Text style={{ color: C.acc, fontWeight: '900', fontSize: 13 }}>CF</Text>
          </View>
          <Text style={{ color: C.txt, fontWeight: '900', letterSpacing: 2, fontSize: 15 }}>CLONEFORGE</Text>
        </View>
        {project ? (
          <Pressable onPress={() => setTab('chat')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, marginBottom: 14 }}>
            <AppIcon project={project} size={30} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: C.txt, fontWeight: '800' }}>{project.name}</Text>
              <Text style={{ color: C.mut, fontSize: 11 }}>Aktuelles Projekt</Text>
            </View>
          </Pressable>
        ) : null}
        <ScrollView style={{ flex: 1 }}>
          {GROUPS.map(g => (
            <View key={g.title} style={{ marginBottom: 14 }}>
              <Text style={{ color: C.mut, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, paddingHorizontal: 10, marginBottom: 4 }}>{g.title.toUpperCase()}</Text>
              {g.items.map(k => {
                const t = ALL[k]; const on = tab === k;
                return (
                  <Pressable key={k} onPress={() => setTab(k)} style={({ hovered }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10 }, on && { backgroundColor: 'rgba(0,229,255,0.12)' }, hovered && !on && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                    <Text style={{ fontSize: 17 }}>{t.icon}</Text>
                    <Text style={{ color: on ? C.acc : C.txt, fontWeight: on ? '800' : '600', flex: 1 }}>{t.label}{docBadge(k, doctor)}{k === 'mission' && missionRunning ? ' 🟢' : ''}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }
  const moreOn = MORE.some(t => t.key === tab);
  return (
    <>
      {more ? (
        <Pressable onPress={() => setMore(false)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(2,3,8,0.7)', justifyContent: 'flex-end', zIndex: 20 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: 'rgba(0,229,255,0.4)', padding: 16, paddingBottom: 84 + inset, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 10 }} />
            {MORE.map(t => (
              <Pressable key={t.key} onPress={() => { setTab(t.key); setMore(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tab === t.key ? C.acc : C.txt, fontSize: 16, fontWeight: '700' }}>{t.label}{docBadge(t.key, doctor)}{t.key === 'mission' && missionRunning ? ' 🟢' : ''}</Text>
                  <Text style={{ color: C.mut, fontSize: 12 }}>{t.sub}</Text>
                </View>
                <Text style={{ color: C.mut }}>{'›'}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      ) : null}
      <View style={{ backgroundColor: 'rgba(6,9,20,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(0,229,255,0.3)', paddingBottom: Math.max(inset, 6), zIndex: 30 }}>
        <View style={{ flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          {[...MAIN, { key: '__more', icon: '☰', label: 'Mehr' }].map(t => {
            const on = t.key === '__more' ? moreOn || more : tab === t.key && !more;
            return (
              <Pressable key={t.key} onPress={() => (t.key === '__more' ? setMore(m => !m) : (setMore(false), setTab(t.key)))} style={{ flex: 1, alignItems: 'center', paddingTop: 9, paddingBottom: 5 }}>
                <View style={[{ position: 'absolute', top: 0, width: 28, height: 2, borderRadius: 1, backgroundColor: on ? C.acc : 'transparent' }, on && GLOW(C.acc, 0.9, 10)]} />
                <Text style={{ fontSize: 21, color: on ? C.acc : C.txt, opacity: on ? 1 : 0.65 }}>{t.icon}{t.key === '__more' && missionRunning ? '🟢' : ''}</Text>
                <Text numberOfLines={1} style={{ fontSize: 11, marginTop: 2, color: on ? C.acc : C.mut, fontWeight: on ? '800' : '500' }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

/* ------------------------------------------------------------ Kleinteile */

function emojiOf(p) {
  const b = (p && p.blueprint) || {};
  return (b.screens && b.screens[0] && b.screens[0].emoji) || (b.entities && b.entities[0] && b.entities[0].emoji) || '✨';
}
function pal(p) {
  const d = { bg: '#0b1020', card: '#141a2e', text: '#f2f5f7', muted: '#9aa5b1', border: '#2b333c', primary: '#00b3cc', accent: '#ff2bd6', danger: '#d64545' };
  return { ...d, ...((p && p.blueprint && p.blueprint.palette) || {}) };
}

export function AppIcon({ project, size = 44 }) {
  const P = pal(project);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, alignItems: 'center', justifyContent: 'center', backgroundImage: `linear-gradient(135deg, ${P.primary}, ${P.accent})`, backgroundColor: P.primary }}>
      <Text style={{ fontSize: size * 0.52 }}>{(project && project.launch && project.launch.iconEmoji) || emojiOf(project)}</Text>
    </View>
  );
}

function Panel({ title, sub, right, children, tone }) {
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: tone === 'acc' ? 'rgba(0,229,255,0.45)' : C.line, padding: 16, marginBottom: 12 }}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sub ? 2 : 10, gap: 8 }}>
          <Text style={{ color: C.txt, fontWeight: '800', fontSize: 16, flex: 1 }}>{title}</Text>
          {right}
        </View>
      ) : null}
      {sub ? <Text style={{ color: C.mut, fontSize: 13, marginBottom: 10, lineHeight: 18 }}>{sub}</Text> : null}
      {children}
    </View>
  );
}

function Tile({ icon, label, sub, onPress, primary, disabled }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [{ flexGrow: 1, flexBasis: '46%', minWidth: 130, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: primary ? C.acc : C.line, backgroundColor: primary ? 'rgba(0,229,255,0.10)' : C.card2 }, primary && GLOW(C.acc, 0.35, 14), pressed && { opacity: 0.8 }, disabled && { opacity: 0.4 }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ color: primary ? C.acc : C.txt, fontWeight: '800', marginTop: 4 }}>{label}</Text>
      {sub ? <Text style={{ color: C.mut, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
    </Pressable>
  );
}

function SmallBtn({ title, onPress, disabled, tone }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: tone === 'acc' ? C.acc : C.line, backgroundColor: tone === 'acc' ? 'rgba(0,229,255,0.12)' : C.card2 }, pressed && { opacity: 0.8 }, disabled && { opacity: 0.4 }]}>
      <Text style={{ color: tone === 'acc' ? C.acc : C.txt, fontWeight: '700', fontSize: 13 }}>{title}</Text>
    </Pressable>
  );
}

export function Collapse({ title, children, initial = false }) {
  const [open, setOpen] = useState(initial);
  return (
    <View style={{ marginBottom: 8 }}>
      <Pressable onPress={() => setOpen(o => !o)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, marginBottom: open ? 10 : 0 }}>
        <Text style={{ color: C.txt, fontWeight: '700', flex: 1 }}>{title}</Text>
        <Text style={{ color: C.acc, fontWeight: '800' }}>{open ? '▾ ausblenden' : '▸ anzeigen'}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

function stats(p) {
  const b = (p && p.blueprint) || {};
  return `${(b.entities || []).length} Tabellen · ${(b.screens || []).length} Screens · ${(p.files || []).length} Dateien`;
}

/* --------------------------------------------- Projektleiste + Fertig-Karte */

export function ProjectBar({ project, onPlay, onPack, onLaunch, onApps }) {
  if (!project) {
    return (
      <Panel title={'✏️ Studio'} sub="Hier bearbeitest du deine App per Chat: neue Funktionen, andere Farben, mehr Felder. Wähle zuerst eine App aus oder klone eine neue.">
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <SmallBtn tone="acc" title={'🧬 Meine Apps'} onPress={onApps} />
        </View>
      </Panel>
    );
  }
  const score = project.report && project.report.audit && typeof project.report.audit.score === 'number' ? project.report.audit.score : null;
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(0,229,255,0.35)', padding: 12, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AppIcon project={project} size={46} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: C.txt, fontWeight: '900', fontSize: 18 }}>{project.name}</Text>
          <Text numberOfLines={1} style={{ color: C.mut, fontSize: 12 }}>{stats(project)}{score != null ? ` · Qualität ${score}` : ''}</Text>
        </View>
        <Pressable onPress={onApps}><Text style={{ color: C.acc, fontWeight: '700', fontSize: 13 }}>Wechseln</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <SmallBtn tone="acc" title={'▶️ Testen'} onPress={onPlay} />
        <SmallBtn title={'🚀 Launch-Kit'} onPress={onLaunch} />
        <SmallBtn title={'📦 Packen'} onPress={onPack} />
      </View>
    </View>
  );
}

export function ReadyCard({ project, onPlay, onStudio, onLaunch, onPack }) {
  if (!project) return null;
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.ok, padding: 16, marginBottom: 12, marginTop: 4 }, GLOW(C.ok, 0.25, 18)]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <AppIcon project={project} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ok, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>{'✅ FERTIG GEBAUT'}</Text>
          <Text numberOfLines={1} style={{ color: C.txt, fontWeight: '900', fontSize: 20 }}>{project.name}</Text>
          <Text style={{ color: C.mut, fontSize: 12 }}>{stats(project)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tile primary icon={'▶️'} label="Jetzt testen" sub="Läuft direkt hier" onPress={onPlay} />
        <Tile icon={'✏️'} label="Im Studio ändern" sub="Per Chat erweitern" onPress={onStudio} />
        <Tile icon={'🚀'} label="Launch-Kit" sub="Store, Website, Preise" onPress={onLaunch} />
        <Tile icon={'📦'} label="Packen" sub="ZIP, APK, Web" onPress={onPack} />
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- Mixer (+) */

const MIX_IDEAS = ['Notion', 'Duolingo', 'Spotify', 'Strava', 'Trello', 'Airbnb', 'Headspace', 'Splitwise', 'Tinder', 'Instagram'];

export function MixBar({ value, setValue, max = 4 }) {
  const parts = String(value || '').split('+').map(s => s.trim()).filter(Boolean);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const setParts = ps => setValue(ps.join(' + '));
  const add = name => {
    const n = String(name || '').trim();
    if (!n) return;
    if (!parts.some(p => p.toLowerCase() === n.toLowerCase())) setParts([...parts, n].slice(0, max));
    setDraft(''); setAdding(false);
  };
  const canAdd = parts.length >= 1 && parts.length < max;
  return (
    <View style={{ marginTop: 10 }}>
      {parts.length >= 2 ? (
        <View style={{ backgroundColor: 'rgba(255,43,214,0.07)', borderColor: 'rgba(255,43,214,0.45)', borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 }}>
          <Text style={{ color: '#ff8de9', fontWeight: '800', marginBottom: 6 }}>{'🧬 App-Mix aus ' + parts.length + ' Apps → eine neue App'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {parts.map((p, i) => (
              <React.Fragment key={p + i}>
                {i ? <Text style={{ color: '#ff8de9', fontWeight: '900' }}>+</Text> : null}
                <Pressable onPress={() => setParts(parts.filter((_, j) => j !== i))} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line }}>
                  <Text style={{ color: C.txt, fontWeight: '700' }}>{p}</Text>
                  <Text style={{ color: C.mut }}>{'✕'}</Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </View>
      ) : null}
      {adding ? (
        <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 10, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput autoFocus value={draft} onChangeText={setDraft} onSubmitEditing={() => add(draft)} placeholder="Weitere App, z. B. Spotify" placeholderTextColor={C.mut} style={{ flex: 1, backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: C.txt, fontSize: 15 }} />
            <SmallBtn tone="acc" title="Dazu" onPress={() => add(draft)} disabled={!draft.trim()} />
            <SmallBtn title={'✕'} onPress={() => { setAdding(false); setDraft(''); }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {MIX_IDEAS.filter(n => !parts.some(p => p.toLowerCase() === n.toLowerCase())).slice(0, 8).map(n => (
              <Chip key={n} label={'+ ' + n} onPress={() => add(n)} />
            ))}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Pressable disabled={!canAdd} onPress={() => setAdding(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: canAdd ? '#ff8de9' : C.line }, pressed && { opacity: 0.8 }, !canAdd && { opacity: 0.5 }]}>
            <Text style={{ color: canAdd ? '#ff8de9' : C.mut, fontWeight: '800' }}>{'➕ App dazumischen'}</Text>
          </Pressable>
          <Text style={{ color: C.mut, fontSize: 12, flex: 1, minWidth: 160 }}>
            {parts.length === 0 ? 'Erst eine App eingeben, dann bis zu ' + max + ' kombinieren.' : parts.length >= max ? 'Maximum erreicht (' + max + ' Apps).' : 'Kombiniere bis zu ' + max + ' Apps zu einer neuen.'}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ================================================================ LAUNCH-KIT */

function facts(p) {
  const b = p.blueprint || {};
  const ents = (b.entities || []).map(e => `- ${e.label || e.name}: ${(e.fields || []).map(f => f.name).join(', ')}`).join('\n');
  const scr = (b.screens || []).map(s => `${s.emoji || ''} ${s.title}`).join(', ');
  const ai = (b.aiFeatures || []).map(f => `${f.emoji || ''} ${f.title}: ${f.task}`).join('\n');
  const fn = ((p.compare && p.compare.rows) || []).filter(r => r.status !== 'nein').map(r => r.funktion).join(', ');
  return `APP-NAME: ${p.name}\nDATEN/TABELLEN:\n${ents}\nBILDSCHIRME: ${scr}\nFUNKTIONEN: ${fn || '(siehe Tabellen)'}\nKI-FUNKTIONEN:\n${ai || '- KI-Assistent, der Eintraege anlegt, sucht und auswertet\n- KI-Import: Text rein, Eintraege raus'}\nTECHNIK: laeuft auf Android, iOS, Web und Desktop; offline-faehig mit lokaler Datenbank; optionaler eigener Sync-Server fuer mehrere Geraete/Personen; KI-Assistent im Tab "KI".`;
}
function origNames(p) {
  const a = Array.isArray(p.app) ? p.app : String(p.app || '').split('+');
  return a.map(s => String(s).trim()).filter(s => s.length > 2);
}
function scrub(v, p) {
  const names = origNames(p).filter(n => n.toLowerCase() !== String(p.name || '').toLowerCase());
  if (!names.length) return v;
  const re = new RegExp(names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  const walk = x => (typeof x === 'string' ? x.replace(re, p.name) : Array.isArray(x) ? x.map(walk) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, walk(y)])) : x);
  return walk(v);
}
const NOBRAND = 'Erwaehne NIEMALS fremde Marken- oder App-Namen; die App heisst ausschliesslich wie unter APP-NAME angegeben. Keine erfundenen Auszeichnungen, Nutzerzahlen, Bewertungen oder Kundenstimmen. Antworte NUR mit JSON.';

const TOOLS = {
  store: {
    icon: '🏪', title: 'Store-Eintrag', sub: 'Play Store + App Store, Deutsch + Englisch, mit Längenprüfung',
    system: 'Du bist ASO-Experte (App Store Optimization). Schreibe verkaufsstarke, ehrliche Store-Texte. ' + NOBRAND,
    user: p => facts(p) + `\n\nLiefere JSON:\n{"de":{"titel":"max 30 Zeichen, App-Name + Nutzen-Keyword","untertitel":"max 30 Zeichen","kurz":"max 80 Zeichen (Play Kurzbeschreibung)","beschreibung":"700-1800 Zeichen, mit Absaetzen, Aufzaehlung mit •, starkem ersten Satz, Abschluss mit Handlungsaufforderung","keywords":"max 100 Zeichen, kommagetrennt ohne Leerzeichen, keine Woerter aus dem Titel","neu":"max 170 Zeichen (Neuerungen v1.0)"},"en":{gleiche Felder auf Englisch},"kategorie_play":"...","kategorie_apple":"...","altersfreigabe":"z. B. USK 0 / 4+ mit Begruendung","screenshot_texte":["5 kurze Bildunterschriften, je max 32 Zeichen, Nutzen statt Funktion"]}`,
    max: 5000,
  },
  pricing: {
    icon: '💶', title: 'Preise & Geldverdienen', sub: 'Modell, Preisstufen und Umsatzrechner',
    system: 'Du bist Pricing-Stratege fuer Apps (Freemium, Abo, Einmalkauf). Realistische Preise fuer den DACH-Markt. ' + NOBRAND,
    user: p => facts(p) + `\n\nLiefere JSON:\n{"modell":"Freemium-Abo | Einmalkauf | Freemium + Einmalkauf | ...","warum":"2-3 Saetze","stufen":[{"name":"Gratis","preis_monat":0,"preis_jahr":0,"fuer":"Zielgruppe in 5 Worten","features":["4-6 konkrete Leistungen"],"empfohlen":false},{"name":"Pro",...,"empfohlen":true},{"name":"Team/Business",...}],"paywall_momente":["3 Stellen in DIESER App, an denen ein Upgrade-Hinweis Sinn ergibt"],"conversion_tipps":["4 konkrete Tipps"],"annahmen":{"downloads_monat":500,"conversion_prozent":3,"churn_prozent":6}}`,
    max: 2500,
  },
  landing: {
    icon: '🌐', title: 'Landingpage', sub: 'Fertige Website mit Preisen, FAQ und Rechtstexten',
    system: 'Du bist Conversion-Copywriter fuer Landingpages. Kurze, konkrete Saetze, Nutzen vor Funktion. ' + NOBRAND,
    user: p => facts(p) + `\n\nLiefere JSON (Deutsch):\n{"headline":"max 60 Zeichen","subline":"max 160 Zeichen","cta":"max 24 Zeichen","features":[{"emoji":"🔥","titel":"max 32 Zeichen","text":"max 140 Zeichen"} x6],"schritte":[{"titel":"...","text":"..."} x3],"faq":[{"frage":"...","antwort":"..."} x6, inkl. Datenschutz, Offline-Nutzung, Preise, Geraete],"schluss_headline":"...","schluss_text":"...","seo_titel":"max 60","seo_beschreibung":"max 155"}`,
    max: 3000,
  },
  marketing: {
    icon: '📣', title: 'Marketing-Kit', sub: 'Posts, Video-Skript, Launch-Plan, Mail an Tester',
    system: 'Du bist Growth-Marketer fuer App-Launches mit kleinem Budget. Konkret, sofort nutzbar, plattformgerecht. ' + NOBRAND,
    user: p => facts(p) + `\n\nLiefere JSON (Deutsch):\n{"slogan":"max 40 Zeichen","pitch":"Elevator Pitch, 2 Saetze","posts":[{"kanal":"Instagram","text":"..."},{"kanal":"TikTok/Reels-Hook","text":"..."},{"kanal":"LinkedIn","text":"..."},{"kanal":"X/Threads","text":"..."},{"kanal":"Reddit/Forum","text":"ehrlich, nicht werblich"}],"video_skript":[{"sekunde":"0-3","bild":"...","text":"..."} 6 Szenen fuer 30 s],"hashtags":["12 Stueck ohne #"],"product_hunt":{"tagline":"max 60","beschreibung":"max 260","erster_kommentar":"..."},"mail_tester":{"betreff":"...","text":"..."},"launch_plan":[{"tag":"Tag -7","aufgabe":"..."} 10 Eintraege bis Tag +14]}`,
    max: 4000,
  },
  market: {
    icon: '🎯', title: 'Markt & Pitch', sub: 'Zielgruppen, Wettbewerb, Alleinstellung, Investoren-Pitch',
    system: 'Du bist nuechterner Startup-Berater. Ehrlich, konkret, keine erfundenen Marktzahlen (Schaetzungen klar als Schaetzung kennzeichnen). Antworte NUR mit JSON.',
    user: p => facts(p) + `\nINSPIRIERT VON (nur intern, als Wettbewerber verwenden): ${origNames(p).join(', ') || '-'}\n\nLiefere JSON (Deutsch):\n{"zielgruppen":[{"name":"...","problem":"...","nutzen":"...","wo_erreichen":"..."} x3],"usp":["4 Alleinstellungsmerkmale gegenueber Wettbewerbern"],"wettbewerb":[{"name":"...","staerke":"...","luecke":"...","unser_vorteil":"..."} x3-4],"nische_zuerst":"die beste Einstiegs-Nische, 2 Saetze","pitch":{"problem":"...","loesung":"...","markt":"Schaetzung mit Begruendung","geschaeftsmodell":"...","traktion_plan":"...","ask":"..."},"risiken":[{"risiko":"...","gegenmittel":"..."} x3],"naechste_schritte":["5 Schritte fuer die naechsten 30 Tage"]}`,
    max: 3500,
  },
};
const LIMITS = { titel: 30, untertitel: 30, kurz: 80, keywords: 100, neu: 170, beschreibung: 4000 };
async function fitStore(rotator, d, p, onEv) {
  const over = {};
  for (const lang of ['de', 'en']) for (const [k, n] of Object.entries(LIMITS)) {
    const v = d[lang] && d[lang][k];
    if (typeof v === 'string' && v.length > n) (over[lang] = over[lang] || {})[k] = { text: v, max: n };
  }
  if (!Object.keys(over).length) return d;
  try {
    const r = await askJSON(rotator, makeTally(), onEv, { task: 'analyze', system: 'Du kuerzt App-Store-Texte auf ein Zeichenlimit, ohne den Sinn zu verlieren. ' + NOBRAND, user: 'Kuerze jeden Text auf hoechstens "max" Zeichen (lieber deutlich kuerzer). Gib dieselbe Struktur zurueck, aber nur mit dem gekuerzten Text als String:\n' + JSON.stringify(over), maxTokens: 1200 });
    const out = { ...d };
    for (const lang of Object.keys(over)) {
      out[lang] = { ...d[lang] };
      for (const k of Object.keys(over[lang])) {
        const v = r && r[lang] && (typeof r[lang][k] === 'string' ? r[lang][k] : r[lang][k] && r[lang][k].text);
        if (typeof v === 'string' && v.trim()) out[lang][k] = v.trim();
      }
    }
    return scrub(out, p);
  } catch (e) { return d; }
}
const ORDER = ['store', 'pricing', 'landing', 'marketing', 'market'];

/* --------------------------------------------------------------- Grafiken */

function seedOf(p) {
  try {
    const f = (p.files || []).find(f => f.path === 'src/db/seed.js');
    if (!f) return {};
    const m = /export\s+const\s+seed\s*=\s*([\s\S]*?);?\s*$/.exec(f.content.trim());
    if (!m) return {};
    // eslint-disable-next-line no-new-func
    return new Function('return (' + m[1] + ')')() || {};
  } catch (e) { return {}; }
}
function wrapText(t, n) {
  const words = String(t || '').split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
}
const FONT = "font-family=\"-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif\"";

function iconSVG(p, variant = 'grad', size = 1024) {
  const P = pal(p); const e = (p.launch && p.launch.iconEmoji) || emojiOf(p);
  const initials = String(p.name || 'A').replace(/[^A-Za-z0-9\u00c0-\u017f ]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'A';
  const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.primary}"/><stop offset="1" stop-color="${P.accent}"/></linearGradient><radialGradient id="h" cx="0.3" cy="0.2" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
  let body;
  if (variant === 'dark') body = `<rect width="1024" height="1024" fill="${P.bg}"/><circle cx="512" cy="512" r="360" fill="none" stroke="url(#g)" stroke-width="44"/><text x="512" y="520" font-size="420" text-anchor="middle" dominant-baseline="central">${e}</text>`;
  else if (variant === 'letter') body = `<rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#h)"/><text x="512" y="540" ${FONT} font-weight="900" font-size="${initials.length > 1 ? 440 : 560}" fill="#fff" text-anchor="middle" dominant-baseline="central" letter-spacing="-20">${escH(initials)}</text>`;
  else body = `<rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#h)"/><text x="512" y="530" font-size="560" text-anchor="middle" dominant-baseline="central">${e}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${defs}${body}</svg>`;
}

function featureSVG(p, tagline) {
  const P = pal(p); const e = (p.launch && p.launch.iconEmoji) || emojiOf(p);
  const lines = wrapText(tagline || 'Deine Daten. Deine App. Mit KI.', 30).slice(0, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.primary}"/><stop offset="1" stop-color="${P.accent}"/></linearGradient></defs><rect width="1024" height="500" fill="${P.bg}"/><circle cx="900" cy="80" r="260" fill="${P.accent}" opacity="0.18"/><circle cx="80" cy="480" r="220" fill="${P.primary}" opacity="0.18"/><rect x="80" y="150" width="200" height="200" rx="46" fill="url(#g)"/><text x="180" y="256" font-size="120" text-anchor="middle" dominant-baseline="central">${e}</text><text x="330" y="215" ${FONT} font-size="64" font-weight="900" fill="${P.text}">${escH(clip(p.name, 22))}</text>${lines.map((l, i) => `<text x="330" y="${280 + i * 44}" ${FONT} font-size="34" fill="${P.muted}">${escH(l)}</text>`).join('')}</svg>`;
}

function shotSVG(p, idx, caption, W = 1080, H = 1920) {
  const P = pal(p); const b = p.blueprint || {}; const seed = seedOf(p);
  const screens = (b.screens || []).filter(s => s.entity);
  const sc = screens[idx % Math.max(1, screens.length)] || { title: p.name, emoji: emojiOf(p) };
  const ent = (b.entities || []).find(e => e.name === sc.entity) || (b.entities || [])[0] || { fields: [] };
  const rows = (seed[ent.name] || []).slice(0, 5);
  const tf = ent.titleField || 'title';
  const k = W / 1080;
  const capLines = wrapText(caption || sc.title, 20).slice(0, 2);
  const px = 140 * k, py = (H - 1500 * k) - 60 * k, pw = W - 280 * k, ph = 1500 * k;
  const rowH = 150 * k;
  const items = (rows.length ? rows : [1, 2, 3, 4].map(i => ({ [tf]: `${ent.label || 'Eintrag'} ${i}` }))).map((r, i) => {
    const y = py + 250 * k + i * (rowH + 22 * k);
    const sub = (ent.fields || []).filter(f => f.name !== tf && r[f.name] != null && !/Id$/.test(f.name)).slice(0, 2).map(f => String(r[f.name]).slice(0, 16)).join(' · ');
    return `<rect x="${px + 40 * k}" y="${y}" width="${pw - 80 * k}" height="${rowH}" rx="${26 * k}" fill="${P.card}" stroke="${P.border}"/><circle cx="${px + 110 * k}" cy="${y + rowH / 2}" r="${36 * k}" fill="${hexA(P.primary, 0.25)}"/><text x="${px + 110 * k}" y="${y + rowH / 2 + 2 * k}" font-size="${34 * k}" text-anchor="middle" dominant-baseline="central">${sc.emoji || '•'}</text><text x="${px + 170 * k}" y="${y + 62 * k}" ${FONT} font-size="${36 * k}" font-weight="700" fill="${P.text}">${escH(clip(r[tf] != null ? r[tf] : '', 22))}</text><text x="${px + 170 * k}" y="${y + 110 * k}" ${FONT} font-size="${28 * k}" fill="${P.muted}">${escH(sub)}</text>`;
  }).join('');
  const tabs = (b.screens || []).slice(0, 5);
  const tabY = py + ph - 130 * k;
  const tabW = (pw - 40 * k) / Math.max(1, tabs.length);
  const tabsSvg = tabs.map((t, i) => `<text x="${px + 20 * k + tabW * (i + 0.5)}" y="${tabY + 52 * k}" font-size="${44 * k}" text-anchor="middle" dominant-baseline="central" opacity="${t === sc ? 1 : 0.45}">${t.emoji || '•'}</text><text x="${px + 20 * k + tabW * (i + 0.5)}" y="${tabY + 100 * k}" ${FONT} font-size="${22 * k}" text-anchor="middle" fill="${t === sc ? P.primary : P.muted}">${escH(clip(t.title, 10))}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.primary}"/><stop offset="1" stop-color="${P.accent}"/></linearGradient><clipPath id="c"><rect x="${px}" y="${py}" width="${pw}" height="${ph + 200 * k}" rx="${70 * k}"/></clipPath></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${capLines.map((l, i) => `<text x="${W / 2}" y="${(H - ph) / 2 - 90 * k + i * 92 * k - (capLines.length - 1) * 46 * k}" ${FONT} font-size="${80 * k}" font-weight="900" fill="#fff" text-anchor="middle">${escH(l)}</text>`).join('')}<rect x="${px - 18 * k}" y="${py - 18 * k}" width="${pw + 36 * k}" height="${ph + 300 * k}" rx="${86 * k}" fill="#0a0a0f"/><g clip-path="url(#c)"><rect x="${px}" y="${py}" width="${pw}" height="${ph + 200 * k}" fill="${P.bg}"/><text x="${px + 50 * k}" y="${py + 110 * k}" ${FONT} font-size="${30 * k}" fill="${P.muted}">${escH(clip(p.name, 26))}</text><text x="${px + 50 * k}" y="${py + 180 * k}" ${FONT} font-size="${58 * k}" font-weight="900" fill="${P.text}">${escH(clip((sc.emoji ? sc.emoji + ' ' : '') + sc.title, 18))}</text>${items}<rect x="${px}" y="${tabY}" width="${pw}" height="${360 * k}" fill="${P.card}"/>${tabsSvg}<circle cx="${px + pw - 90 * k}" cy="${tabY - 90 * k}" r="${54 * k}" fill="${P.primary}"/><text x="${px + pw - 90 * k}" y="${tabY - 92 * k}" ${FONT} font-size="${64 * k}" fill="#fff" text-anchor="middle" dominant-baseline="central">+</text></g></svg>`;
}

async function svgToPng(svg, w, h) {
  if (!WEB) throw new Error('PNG-Export geht nur in der Web-Version.');
  const img = new window.Image();
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Grafik konnte nicht gerendert werden.')); img.src = url; });
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/* ------------------------------------------------------------ Rechtstexte */

function legalHTML(p, kind, L) {
  const P = pal(p); const y = new Date().getFullYear();
  const usesAI = true;
  const who = `${escH(L.name || '[Dein Name / Firma]')}<br>${escH(L.street || '[Strasse Nr.]')}<br>${escH(L.city || '[PLZ Ort]')}${L.country ? '<br>' + escH(L.country) : ''}`;
  const head = t => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t} – ${escH(p.name)}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;line-height:1.6;color:#1b1f24;background:#fff}h1{color:${P.primary}}h2{margin-top:28px}a{color:${P.primary}}.note{background:#fff7d6;border:1px solid #f0d36b;padding:12px;border-radius:8px;font-size:14px}</style></head><body>`;
  const note = '<p class="note">Vorlage, automatisch erstellt von CloneForge. Keine Rechtsberatung. Vor der Veröffentlichung prüfen und an dein Land und deine Situation anpassen.</p>';
  if (kind === 'impressum') {
    return head('Impressum') + `<h1>Impressum</h1>${note}<p>Angaben gemäß § 5 DDG (DE) bzw. § 5 ECG (AT) / Art. 3 UWG (CH)</p><p>${who}</p><h2>Kontakt</h2><p>E-Mail: ${escH(L.email || '[E-Mail]')}${L.phone ? '<br>Telefon: ' + escH(L.phone) : ''}</p>${L.vat ? `<h2>Umsatzsteuer-ID</h2><p>${escH(L.vat)}</p>` : ''}<h2>Verantwortlich für den Inhalt</h2><p>${escH(L.name || '[Name]')}, Anschrift wie oben</p><h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p><p>© ${y} ${escH(L.name || p.name)}</p></body></html>`;
  }
  if (kind === 'datenschutz') {
    return head('Datenschutz') + `<h1>Datenschutzerklärung für „${escH(p.name)}“</h1>${note}<p>Stand: ${new Date().toLocaleDateString('de-DE')}</p>
<h2>1. Verantwortlicher</h2><p>${who}<br>E-Mail: ${escH(L.email || '[E-Mail]')}</p>
<h2>2. Das Wichtigste in Kürze</h2><ul><li>Deine Einträge werden <b>lokal auf deinem Gerät</b> gespeichert.</li><li>Kein Konto nötig, keine Werbung, kein Tracking, keine Analyse-Dienste.</li><li>Daten verlassen dein Gerät nur, wenn du selbst die Synchronisation mit einem Server einrichtest oder eine KI-Funktion nutzt.</li></ul>
<h2>3. Lokale Speicherung</h2><p>Alle Inhalte, die du in der App anlegst, werden im Speicher deines Geräts (bzw. im Browser-Speicher der Web-Version) abgelegt. Wir haben darauf keinen Zugriff. Du kannst die Daten jederzeit in der App exportieren oder löschen; beim Deinstallieren werden sie entfernt.</p>
<h2>4. Synchronisation (optional)</h2><p>Wenn du in den Einstellungen einen Sync-Server verbindest, werden deine Einträge verschlüsselt (HTTPS) an diesen Server übertragen und dort gespeichert, um sie zwischen Geräten abzugleichen. ${L.server ? `Betreiber des Servers ist ${escH(L.name || '[Betreiber]')}; Serverstandort: ${escH(L.server)}.` : 'Betreiber ist, wer den Server eingerichtet hat.'} Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der von dir gewünschten Funktion).</p>
${usesAI ? `<h2>5. KI-Funktionen (optional)</h2><p>Nutzt du den KI-Assistenten oder den KI-Import, wird der jeweils eingegebene Text und – soweit für die Antwort nötig – ein Auszug deiner Einträge an einen KI-Anbieter übermittelt (je nach Einstellung Google, Groq, OpenRouter oder OpenAI, ggf. über unseren Server). Diese Anbieter können Daten außerhalb der EU verarbeiten; die Übermittlung stützt sich auf deine Einwilligung (Art. 6 Abs. 1 lit. a, Art. 49 Abs. 1 lit. a DSGVO), die du durch die Nutzung der Funktion erteilst und jederzeit beenden kannst, indem du die KI-Funktionen nicht mehr verwendest. Gib keine sensiblen Daten in KI-Funktionen ein.</p>` : ''}
<h2>6. Website und Server-Logs</h2><p>Beim Aufruf der Web-Version oder unserer Website verarbeitet der Hosting-Anbieter technisch notwendige Daten (IP-Adresse, Zeitpunkt, abgerufene Seite) zur sicheren Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO). Diese Logs werden nach kurzer Zeit gelöscht.</p>
<h2>7. Zahlungen</h2><p>Kaufst du eine Bezahlversion, läuft die Zahlung über den jeweiligen App-Store oder Zahlungsanbieter. Wir erhalten dabei keine Zahlungsdaten, sondern nur eine Kaufbestätigung.</p>
<h2>8. Deine Rechte</h2><p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie auf Widerruf erteilter Einwilligungen. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren. Kontakt: ${escH(L.email || '[E-Mail]')}.</p>
<h2>9. Kinder</h2><p>Die App richtet sich nicht gezielt an Kinder unter 16 Jahren.</p>
<h2>10. Änderungen</h2><p>Wir passen diese Erklärung an, wenn sich die App ändert. Es gilt die jeweils aktuelle Fassung.</p></body></html>`;
  }
  return head('Nutzungsbedingungen') + `<h1>Nutzungsbedingungen für „${escH(p.name)}“</h1>${note}
<h2>1. Anbieter</h2><p>${who}</p>
<h2>2. Leistung</h2><p>„${escH(p.name)}“ ist eine App zur Verwaltung deiner eigenen Inhalte. Die Grundfunktionen sind kostenlos. Erweiterte Funktionen können kostenpflichtig angeboten werden; Preis und Umfang werden vor dem Kauf angezeigt.</p>
<h2>3. Deine Inhalte</h2><p>Deine Inhalte gehören dir. Du bist für sie verantwortlich und erstellst regelmäßig Sicherungen (Export-Funktion).</p>
<h2>4. KI-Ergebnisse</h2><p>KI-Antworten werden automatisch erzeugt und können falsch sein. Prüfe sie, bevor du dich darauf verlässt.</p>
<h2>5. Abonnements</h2><p>Abos verlängern sich automatisch, bis du sie in deinem Store-Konto bzw. beim Zahlungsanbieter kündigst. Es gelten zusätzlich die Bedingungen des jeweiligen Stores.</p>
<h2>6. Haftung</h2><p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie nach zwingendem Recht. Im Übrigen haften wir nur für die Verletzung wesentlicher Pflichten und begrenzt auf den vorhersehbaren Schaden.</p>
<h2>7. Schlussbestimmungen</h2><p>Es gilt das Recht des Landes, in dem der Anbieter seinen Sitz hat, unter Ausschluss zwingender Verbraucherschutzvorschriften deines Wohnsitzlandes nicht. Kontakt: ${escH(L.email || '[E-Mail]')}</p></body></html>`;
}

/* ------------------------------------------------------------ Landingpage */

function landingHTML(p, L) {
  const P = pal(p); const d = L.landing || {}; const pr = L.pricing || {}; const st = (L.store && L.store.de) || {};
  const e = L.iconEmoji || emojiOf(p);
  const cta = L.ctaUrl || (L.legal && L.legal.email ? 'mailto:' + L.legal.email + '?subject=' + encodeURIComponent(p.name + ' – Warteliste') : '#preise');
  const caps = (L.store && L.store.screenshot_texte) || [];
  const shots = [0, 1, 2].map(i => `<figure>${shotSVG(p, i, caps[i], 1080, 1920).replace('<svg ', '<svg class="shot" ')}</figure>`).join('');
  const feats = (d.features || []).map(f => `<div class="card"><div class="em">${escH(f.emoji)}</div><h3>${escH(f.titel)}</h3><p>${escH(f.text)}</p></div>`).join('');
  const steps = (d.schritte || []).map((s, i) => `<div class="step"><span>${i + 1}</span><h3>${escH(s.titel)}</h3><p>${escH(s.text)}</p></div>`).join('');
  const tiers = (pr.stufen || []).map(t => `<div class="tier${t.empfohlen ? ' hot' : ''}">${t.empfohlen ? '<div class="badge">Empfohlen</div>' : ''}<h3>${escH(t.name)}</h3><div class="price">${Number(t.preis_monat) ? escH(String(t.preis_monat).replace('.', ',')) + ' €<small>/Monat</small>' : 'Gratis'}</div>${Number(t.preis_jahr) ? `<div class="year">oder ${escH(String(t.preis_jahr).replace('.', ','))} € im Jahr</div>` : '<div class="year">&nbsp;</div>'}<ul>${(t.features || []).map(x => `<li>${escH(x)}</li>`).join('')}</ul><a class="btn${t.empfohlen ? '' : ' ghost'}" href="${escH(cta)}">${escH(Number(t.preis_monat) ? 'Jetzt holen' : 'Kostenlos starten')}</a></div>`).join('');
  const faq = (d.faq || []).map(f => `<details><summary>${escH(f.frage)}</summary><p>${escH(f.antwort)}</p></details>`).join('');
  const legal = L.legalDone ? '<a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a> · <a href="agb.html">Nutzungsbedingungen</a>' : '';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escH(d.seo_titel || p.name)}</title><meta name="description" content="${escH(d.seo_beschreibung || d.subline || '')}"><meta property="og:title" content="${escH(d.seo_titel || p.name)}"><meta property="og:description" content="${escH(d.seo_beschreibung || d.subline || '')}"><link rel="icon" href="icon.svg"><style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:${P.bg};color:${P.text};line-height:1.55}a{color:inherit}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}nav{display:flex;align-items:center;gap:12px;padding:18px 0}.logo{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,${P.primary},${P.accent});display:grid;place-items:center;font-size:22px}nav b{font-size:18px}nav .sp{flex:1}nav a.l{color:${P.muted};text-decoration:none;margin-left:16px;font-size:15px}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center;padding:48px 0 64px}.hero h1{font-size:clamp(34px,5.4vw,58px);line-height:1.05;margin:0 0 18px;letter-spacing:-1px}.hero p{font-size:19px;color:${P.muted};margin:0 0 28px}
.btn{display:inline-block;background:linear-gradient(135deg,${P.primary},${P.accent});color:#fff;text-decoration:none;font-weight:800;padding:15px 26px;border-radius:14px;box-shadow:0 10px 30px ${hexA(P.primary, 0.35)}}.btn.ghost{background:transparent;border:1.5px solid ${P.border};box-shadow:none;color:${P.text}}
.trust{display:flex;gap:18px;flex-wrap:wrap;margin-top:22px;color:${P.muted};font-size:14px}
.shot{width:100%;height:auto;border-radius:28px;display:block}.hero .shot{max-width:340px;margin:0 auto;transform:rotate(2deg);box-shadow:0 30px 80px rgba(0,0,0,.45)}
section{padding:56px 0}h2{font-size:clamp(26px,3.6vw,38px);margin:0 0 28px;letter-spacing:-.5px;text-align:center}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:${P.card};border:1px solid ${P.border};border-radius:18px;padding:22px}.card .em{font-size:30px}.card h3{margin:10px 0 6px}.card p{margin:0;color:${P.muted}}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.step span{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;background:${hexA(P.primary, 0.2)};color:${P.primary};font-weight:900}.step p{color:${P.muted}}
.shots{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}figure{margin:0}
.tiers{display:grid;grid-template-columns:repeat(${Math.max(1, Math.min(3, (pr.stufen || []).length))},1fr);gap:16px;align-items:stretch}.tier{position:relative;background:${P.card};border:1px solid ${P.border};border-radius:20px;padding:26px;display:flex;flex-direction:column}.tier.hot{border:2px solid ${P.primary};transform:translateY(-6px)}.tier .badge{position:absolute;top:-13px;left:24px;background:${P.primary};color:#fff;font-size:12px;font-weight:800;padding:4px 10px;border-radius:99px}.price{font-size:38px;font-weight:900}.price small{font-size:15px;color:${P.muted};font-weight:500}.year{color:${P.muted};font-size:14px;margin-bottom:12px}.tier ul{padding-left:18px;flex:1}.tier li{margin:6px 0}.tier .btn{text-align:center;margin-top:12px}
details{background:${P.card};border:1px solid ${P.border};border-radius:14px;padding:16px 18px;margin:10px auto;max-width:760px}summary{cursor:pointer;font-weight:700}details p{color:${P.muted};margin:10px 0 0}
.final{text-align:center;background:linear-gradient(135deg,${hexA(P.primary, 0.18)},${hexA(P.accent, 0.18)});border:1px solid ${P.border};border-radius:28px;padding:48px 24px}.final p{color:${P.muted};max-width:600px;margin:0 auto 24px}
footer{color:${P.muted};font-size:14px;padding:40px 0;text-align:center}footer a{color:${P.muted}}
@media(max-width:820px){.hero{grid-template-columns:1fr;padding-top:24px}.grid,.steps,.tiers{grid-template-columns:1fr}.shots{grid-template-columns:1fr 1fr}.shots figure:last-child{display:none}nav a.l{display:none}.tier.hot{transform:none}}
</style></head><body><div class="wrap">
<nav><div class="logo">${e}</div><b>${escH(p.name)}</b><span class="sp"></span><a class="l" href="#funktionen">Funktionen</a>${tiers ? '<a class="l" href="#preise">Preise</a>' : ''}<a class="l" href="#faq">FAQ</a></nav>
<div class="hero"><div><h1>${escH(d.headline || p.name)}</h1><p>${escH(d.subline || st.kurz || '')}</p><a class="btn" href="${escH(cta)}">${escH(d.cta || 'Jetzt starten')}</a><div class="trust"><span>✔ Offline nutzbar</span><span>✔ Mit KI-Assistent</span><span>✔ Ohne Werbung</span><span>✔ Android, iOS, Web</span></div></div><div>${shotSVG(p, 0, caps[0], 1080, 1920).replace('<svg ', '<svg class="shot" ')}</div></div>
${feats ? `<section id="funktionen"><h2>Alles, was du brauchst</h2><div class="grid">${feats}</div></section>` : ''}
${steps ? `<section><h2>So einfach geht's</h2><div class="steps">${steps}</div></section>` : ''}
<section><h2>Einblicke</h2><div class="shots">${shots}</div></section>
${tiers ? `<section id="preise"><h2>Preise</h2><div class="tiers">${tiers}</div></section>` : ''}
${faq ? `<section id="faq"><h2>Häufige Fragen</h2>${faq}</section>` : ''}
<section><div class="final"><h2>${escH(d.schluss_headline || 'Bereit?')}</h2><p>${escH(d.schluss_text || '')}</p><a class="btn" href="${escH(cta)}">${escH(d.cta || 'Jetzt starten')}</a></div></section>
<footer>© ${new Date().getFullYear()} ${escH((L.legal && L.legal.name) || p.name)}${legal ? ' · ' + legal : ''}</footer>
</div></body></html>`;
}

/* ------------------------------------------------------------ Texte (MD) */

function storeMD(p, s) {
  if (!s) return '';
  const part = (t, x) => x ? `## ${t}\n\n**Titel:** ${x.titel}\n\n**Untertitel:** ${x.untertitel}\n\n**Kurzbeschreibung:** ${x.kurz}\n\n**Keywords:** ${x.keywords}\n\n**Beschreibung:**\n\n${x.beschreibung}\n\n**Neu in dieser Version:** ${x.neu}\n` : '';
  return `# Store-Eintrag: ${p.name}\n\nKategorie Play: ${s.kategorie_play || ''}  \nKategorie Apple: ${s.kategorie_apple || ''}  \nAltersfreigabe: ${s.altersfreigabe || ''}\n\n${part('Deutsch', s.de)}\n${part('English', s.en)}\n## Screenshot-Texte\n\n${(s.screenshot_texte || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`;
}
function marketingMD(p, m) {
  if (!m) return '';
  return `# Marketing-Kit: ${p.name}\n\n**Slogan:** ${m.slogan}\n\n**Pitch:** ${m.pitch}\n\n## Posts\n\n${(m.posts || []).map(x => `### ${x.kanal}\n\n${x.text}\n`).join('\n')}\n## Video-Skript (30 s)\n\n| Sekunde | Bild | Text |\n|---|---|---|\n${(m.video_skript || []).map(v => `| ${v.sekunde} | ${v.bild} | ${v.text} |`).join('\n')}\n\n## Hashtags\n\n${(m.hashtags || []).map(h => '#' + String(h).replace(/^#/, '')).join(' ')}\n\n## Product Hunt\n\n**Tagline:** ${(m.product_hunt || {}).tagline}\n\n${(m.product_hunt || {}).beschreibung}\n\n**Erster Kommentar:** ${(m.product_hunt || {}).erster_kommentar}\n\n## Mail an Beta-Tester\n\n**Betreff:** ${(m.mail_tester || {}).betreff}\n\n${(m.mail_tester || {}).text}\n\n## Launch-Plan\n\n${(m.launch_plan || []).map(x => `- **${x.tag}:** ${x.aufgabe}`).join('\n')}\n`;
}
function pricingMD(p, r) {
  if (!r) return '';
  return `# Preise & Geldverdienen: ${p.name}\n\n**Modell:** ${r.modell}\n\n${r.warum}\n\n${(r.stufen || []).map(t => `## ${t.name}${t.empfohlen ? ' (empfohlen)' : ''}\n\n${t.preis_monat ? t.preis_monat + ' €/Monat' : 'Gratis'}${t.preis_jahr ? ' · ' + t.preis_jahr + ' €/Jahr' : ''} · für ${t.fuer || ''}\n\n${(t.features || []).map(f => '- ' + f).join('\n')}\n`).join('\n')}\n## Wo die Upgrade-Hinweise hingehören\n\n${(r.paywall_momente || []).map(f => '- ' + f).join('\n')}\n\n## Tipps\n\n${(r.conversion_tipps || []).map(f => '- ' + f).join('\n')}\n`;
}
function marketMD(p, m) {
  if (!m) return '';
  const pi = m.pitch || {};
  return `# Markt & Pitch: ${p.name}\n\n## Zielgruppen\n\n${(m.zielgruppen || []).map(z => `### ${z.name}\n\n- Problem: ${z.problem}\n- Nutzen: ${z.nutzen}\n- Erreichen: ${z.wo_erreichen}\n`).join('\n')}\n## Alleinstellung\n\n${(m.usp || []).map(x => '- ' + x).join('\n')}\n\n## Wettbewerb\n\n| Name | Stärke | Lücke | Unser Vorteil |\n|---|---|---|---|\n${(m.wettbewerb || []).map(w => `| ${w.name} | ${w.staerke} | ${w.luecke} | ${w.unser_vorteil} |`).join('\n')}\n\n## Einstiegs-Nische\n\n${m.nische_zuerst}\n\n## Pitch\n\n- **Problem:** ${pi.problem}\n- **Lösung:** ${pi.loesung}\n- **Markt:** ${pi.markt}\n- **Geschäftsmodell:** ${pi.geschaeftsmodell}\n- **Traktion:** ${pi.traktion_plan}\n- **Ask:** ${pi.ask}\n\n## Risiken\n\n${(m.risiken || []).map(r => `- ${r.risiko} → ${r.gegenmittel}`).join('\n')}\n\n## Nächste 30 Tage\n\n${(m.naechste_schritte || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}\n`;
}

/* ------------------------------------------------------------- Launch-Dateien */

function launchFiles(p, L) {
  const out = [];
  const tag = (L.store && L.store.de && L.store.de.untertitel) || (L.landing && L.landing.subline) || '';
  const variant = L.iconVariant || 'grad';
  out.push({ path: 'launch/icon.svg', content: iconSVG(p, variant) });
  out.push({ path: 'launch/feature-graphic.svg', content: featureSVG(p, tag) });
  const caps = (L.store && L.store.screenshot_texte) || [];
  for (let i = 0; i < 3; i++) {
    out.push({ path: `launch/screenshots/android-${i + 1}.svg`, content: shotSVG(p, i, caps[i], 1080, 1920) });
    out.push({ path: `launch/screenshots/iphone-${i + 1}.svg`, content: shotSVG(p, i, caps[i], 1290, 2796) });
  }
  if (L.store) out.push({ path: 'launch/store-eintrag.md', content: storeMD(p, L.store) });
  if (L.pricing) out.push({ path: 'launch/preise.md', content: pricingMD(p, L.pricing) });
  if (L.marketing) out.push({ path: 'launch/marketing.md', content: marketingMD(p, L.marketing) });
  if (L.market) out.push({ path: 'launch/markt-und-pitch.md', content: marketMD(p, L.market) });
  if (L.legalDone) {
    const lg = L.legal || {};
    out.push({ path: 'launch/website/impressum.html', content: legalHTML(p, 'impressum', lg) });
    out.push({ path: 'launch/website/datenschutz.html', content: legalHTML(p, 'datenschutz', lg) });
    out.push({ path: 'launch/website/agb.html', content: legalHTML(p, 'agb', lg) });
  }
  if (L.landing) {
    out.push({ path: 'launch/website/index.html', content: landingHTML(p, L) });
    out.push({ path: 'launch/website/icon.svg', content: iconSVG(p, variant, 256) });
  }
  out.push({ path: 'launch/README.md', content: `# Launch-Paket: ${p.name}\n\nErstellt mit CloneForge.\n\n- \`icon.svg\`, \`feature-graphic.svg\`, \`screenshots/\` – Store-Grafiken (PNG-Versionen liegen im Launch-ZIP aus der App)\n- \`store-eintrag.md\` – Texte für Play Store und App Store\n- \`website/\` – fertige Landingpage samt Rechtstexten. Hochladen auf GitHub Pages, Netlify oder jeden Webspace.\n- \`preise.md\`, \`marketing.md\`, \`markt-und-pitch.md\` – Geschäftsmodell, Posts, Launch-Plan\n\nRechtstexte sind Vorlagen, keine Rechtsberatung.\n` });
  return out;
}

// Mini-ZIP (speichert unkomprimiert), kann Text und Bytes.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  const u16 = n => [n & 255, (n >> 8) & 255]; const u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.path); const data = typeof f.content === 'string' ? enc.encode(f.content) : f.content; const c = crc32(data);
    const head = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(head, name, data);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + data.length;
  }
  const clen = central.reduce((a, b) => a + b.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(clen), ...u32(off), ...u16(0)]);
  const all = [...parts, ...central, end]; const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let o = 0;
  for (const a of all) { out.set(a, o); o += a.length; }
  return out;
}

/* --------------------------------------------------------------- Screen */

function Field({ label, value, limit, multiline }) {
  const len = String(value || '').length; const over = limit && len > limit;
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
        <Text style={{ color: C.mut, fontSize: 12, fontWeight: '700', flex: 1 }}>{label}</Text>
        {limit ? <Text style={{ color: over ? C.no : C.ok, fontSize: 11, fontWeight: '700' }}>{len}/{limit} {over ? '⚠️ zu lang' : '✓'}</Text> : null}
        <Pressable onPress={() => copy(String(value || '')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })}>
          <Text style={{ color: C.acc, fontSize: 12, fontWeight: '700' }}>{copied ? 'Kopiert ✓' : 'Kopieren'}</Text>
        </Pressable>
      </View>
      <Text selectable style={{ color: C.txt, backgroundColor: C.card2, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: over ? C.no : C.line, fontSize: 14, lineHeight: multiline ? 20 : undefined }}>{String(value || '')}</Text>
    </View>
  );
}
async function copy(t) {
  try { if (WEB && navigator.clipboard) await navigator.clipboard.writeText(t); } catch (e) {}
}
function Bullets({ items }) {
  return <View>{(items || []).map((x, i) => <Text key={i} style={{ color: C.txt, marginBottom: 4, lineHeight: 20 }}>{'• '}{x}</Text>)}</View>;
}
function Head({ children }) {
  return <Text style={{ color: C.acc, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginTop: 10, marginBottom: 6 }}>{String(children).toUpperCase()}</Text>;
}

function StoreView({ d }) {
  const [lang, setLang] = useState('de');
  const x = d[lang] || {};
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
        <Chip label="Deutsch" on={lang === 'de'} onPress={() => setLang('de')} />
        <Chip label="English" on={lang === 'en'} onPress={() => setLang('en')} />
      </View>
      <Field label="Titel (App Store Name)" value={x.titel} limit={30} />
      <Field label="Untertitel (App Store)" value={x.untertitel} limit={30} />
      <Field label="Kurzbeschreibung (Play Store)" value={x.kurz} limit={80} />
      <Field label="Keywords (App Store)" value={x.keywords} limit={100} />
      <Field label="Beschreibung" value={x.beschreibung} limit={4000} multiline />
      <Field label="Neu in dieser Version" value={x.neu} limit={170} />
      <Text style={{ color: C.mut, fontSize: 13 }}>Kategorie: {d.kategorie_play} (Play) · {d.kategorie_apple} (Apple) · {d.altersfreigabe}</Text>
    </View>
  );
}

function Calc({ a }) {
  const [dl, setDl] = useState(String((a && a.downloads_monat) || 500));
  const [cv, setCv] = useState(String((a && a.conversion_prozent) || 3));
  const [price, setPrice] = useState(String((a && a.preis) || 4.99));
  const [churn, setChurn] = useState(String((a && a.churn_prozent) || 6));
  const [fee, setFee] = useState(15);
  const n = v => Math.max(0, parseFloat(String(v).replace(',', '.')) || 0);
  let payers = 0; let total = 0; const series = [];
  for (let m = 1; m <= 12; m++) { payers = payers * (1 - n(churn) / 100) + n(dl) * n(cv) / 100; const rev = payers * n(price) * (1 - fee / 100); total += rev; series.push(rev); }
  const max = Math.max(...series, 1); const eur = v => v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
  const inp = (label, v, set, suf) => (
    <View style={{ flexGrow: 1, flexBasis: '45%' }}>
      <Text style={{ color: C.mut, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card2, borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10 }}>
        <TextInput value={v} onChangeText={set} keyboardType="decimal-pad" style={{ flex: 1, color: C.txt, paddingVertical: 9, fontSize: 15, minWidth: 40 }} />
        <Text style={{ color: C.mut }}>{suf}</Text>
      </View>
    </View>
  );
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {inp('Neue Downloads pro Monat', dl, setDl, '')}
        {inp('Davon zahlen', cv, setCv, '%')}
        {inp('Preis pro Monat', price, setPrice, '€')}
        {inp('Kündigen pro Monat', churn, setChurn, '%')}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={{ color: C.mut, fontSize: 12 }}>Store-Gebühr:</Text>
        {[0, 15, 30].map(f => <Chip key={f} label={f + ' %'} on={fee === f} onPress={() => setFee(f)} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90, marginTop: 14 }}>
        {series.map((v, i) => <View key={i} style={{ flex: 1, height: Math.max(3, (v / max) * 86), backgroundColor: i === 11 ? C.acc : 'rgba(0,229,255,0.35)', borderRadius: 4 }} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Stat label="Zahlende nach 12 Mon." value={Math.round(payers).toLocaleString('de-DE')} />
        <Stat label="Monatsumsatz (Mon. 12)" value={eur(series[11])} />
        <Stat label="Umsatz Jahr 1 (netto)" value={eur(total)} hi />
      </View>
      <Text style={{ color: C.mut, fontSize: 12, marginTop: 8 }}>Modell: zahlende Nutzer wachsen jeden Monat um Downloads × Conversion und schrumpfen um die Kündigungsrate. Store-Gebühr: 15 % für kleine Entwickler (Google/Apple), 30 % sonst, 0 % bei Verkauf über die eigene Website.</Text>
    </View>
  );
}
function Stat({ label, value, hi }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '30%', minWidth: 100, backgroundColor: hi ? 'rgba(57,255,136,0.08)' : C.card2, borderColor: hi ? C.ok : C.line, borderWidth: 1, borderRadius: 12, padding: 10 }}>
      <Text style={{ color: C.mut, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: hi ? C.ok : C.txt, fontWeight: '900', fontSize: 18 }}>{value}</Text>
    </View>
  );
}

function PricingView({ d }) {
  return (
    <View>
      <Text style={{ color: C.txt, fontWeight: '800', fontSize: 15 }}>{d.modell}</Text>
      <Text style={{ color: C.mut, marginBottom: 10, lineHeight: 19 }}>{d.warum}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(d.stufen || []).map((t, i) => (
          <View key={i} style={{ flexGrow: 1, flexBasis: '30%', minWidth: 150, backgroundColor: C.card2, borderRadius: 14, borderWidth: t.empfohlen ? 2 : 1, borderColor: t.empfohlen ? C.acc : C.line, padding: 12 }}>
            <Text style={{ color: t.empfohlen ? C.acc : C.txt, fontWeight: '900' }}>{t.name}{t.empfohlen ? ' ⭐' : ''}</Text>
            <Text style={{ color: C.txt, fontSize: 22, fontWeight: '900', marginVertical: 4 }}>{Number(t.preis_monat) ? String(t.preis_monat).replace('.', ',') + ' €' : 'Gratis'}<Text style={{ fontSize: 12, color: C.mut }}>{Number(t.preis_monat) ? ' /Monat' : ''}</Text></Text>
            {Number(t.preis_jahr) ? <Text style={{ color: C.mut, fontSize: 12, marginBottom: 6 }}>oder {String(t.preis_jahr).replace('.', ',')} €/Jahr</Text> : null}
            <Bullets items={t.features} />
          </View>
        ))}
      </View>
      <Head>Upgrade-Momente in deiner App</Head>
      <Bullets items={d.paywall_momente} />
      <Head>Umsatzrechner</Head>
      <Calc a={{ ...(d.annahmen || {}), preis: ((d.stufen || []).find(t => t.empfohlen) || (d.stufen || [])[1] || {}).preis_monat }} />
    </View>
  );
}

function MarketingView({ d }) {
  return (
    <View>
      <Field label="Slogan" value={d.slogan} />
      <Field label="Elevator Pitch" value={d.pitch} multiline />
      <Head>Posts</Head>
      {(d.posts || []).map((x, i) => <Field key={i} label={x.kanal} value={x.text} multiline />)}
      <Head>Video-Skript (30 s)</Head>
      {(d.video_skript || []).map((v, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
          <Text style={{ color: C.acc, fontWeight: '800', width: 48 }}>{v.sekunde}s</Text>
          <Text style={{ color: C.txt, flex: 1 }}><Text style={{ color: C.mut }}>{v.bild} – </Text>{v.text}</Text>
        </View>
      ))}
      <Field label="Hashtags" value={(d.hashtags || []).map(h => '#' + String(h).replace(/^#/, '')).join(' ')} />
      <Head>Launch-Plan</Head>
      {(d.launch_plan || []).map((x, i) => <Text key={i} style={{ color: C.txt, marginBottom: 4 }}><Text style={{ color: C.acc, fontWeight: '800' }}>{x.tag}: </Text>{x.aufgabe}</Text>)}
      {d.mail_tester ? <><Head>Mail an Beta-Tester</Head><Field label={'Betreff: ' + d.mail_tester.betreff} value={d.mail_tester.text} multiline /></> : null}
      {d.product_hunt ? <><Head>Product Hunt</Head><Field label="Tagline" value={d.product_hunt.tagline} limit={60} /><Field label="Beschreibung" value={d.product_hunt.beschreibung} limit={260} multiline /><Field label="Erster Kommentar" value={d.product_hunt.erster_kommentar} multiline /></> : null}
    </View>
  );
}

function MarketView({ d }) {
  const pi = d.pitch || {};
  return (
    <View>
      <Head>Zielgruppen</Head>
      {(d.zielgruppen || []).map((z, i) => (
        <View key={i} style={{ backgroundColor: C.card2, borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.txt, fontWeight: '800' }}>{z.name}</Text>
          <Text style={{ color: C.mut, fontSize: 13 }}>Problem: {z.problem}</Text>
          <Text style={{ color: C.mut, fontSize: 13 }}>Nutzen: {z.nutzen}</Text>
          <Text style={{ color: C.mut, fontSize: 13 }}>Erreichen: {z.wo_erreichen}</Text>
        </View>
      ))}
      <Head>Alleinstellung</Head>
      <Bullets items={d.usp} />
      <Head>Wettbewerb</Head>
      {(d.wettbewerb || []).map((w, i) => <Text key={i} style={{ color: C.txt, marginBottom: 6 }}><Text style={{ fontWeight: '800' }}>{w.name}: </Text>{w.luecke} → <Text style={{ color: C.ok }}>{w.unser_vorteil}</Text></Text>)}
      <Head>Beste Einstiegs-Nische</Head>
      <Text style={{ color: C.txt }}>{d.nische_zuerst}</Text>
      <Head>Pitch</Head>
      {[['Problem', pi.problem], ['Lösung', pi.loesung], ['Markt', pi.markt], ['Geschäftsmodell', pi.geschaeftsmodell], ['Traktion', pi.traktion_plan], ['Ask', pi.ask]].map(([k, v]) => <Text key={k} style={{ color: C.txt, marginBottom: 4 }}><Text style={{ color: C.acc, fontWeight: '800' }}>{k}: </Text>{v}</Text>)}
      <Head>Risiken</Head>
      {(d.risiken || []).map((r, i) => <Text key={i} style={{ color: C.txt, marginBottom: 4 }}>{'⚠️ '}{r.risiko} → {r.gegenmittel}</Text>)}
      <Head>Nächste 30 Tage</Head>
      <Bullets items={d.naechste_schritte} />
    </View>
  );
}

function Frame({ html, height = 520 }) {
  if (!WEB) return <Text style={{ color: C.mut }}>Vorschau nur in der Web-Version.</Text>;
  return React.createElement('iframe', { srcDoc: html, title: 'Vorschau', sandbox: 'allow-same-origin', style: { width: '100%', height, border: '1px solid ' + C.line, borderRadius: 14, background: '#fff' } });
}
function Svg({ svg, w, h, radius = 0 }) {
  if (!WEB) return null;
  return React.createElement('img', { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), width: w, height: h, style: { width: w, height: h, borderRadius: radius, display: 'block' } });
}

const LEGAL_FIELDS = [
  ['name', 'Name oder Firma'], ['street', 'Straße, Nr.'], ['city', 'PLZ, Ort'], ['country', 'Land'], ['email', 'E-Mail'], ['phone', 'Telefon (optional)'], ['vat', 'USt-ID (optional)'], ['server', 'Serverstandort Sync (optional, z. B. Deutschland)'],
];

export function LaunchScreen({ project, rotator, setProject, onPlay, goto }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState('');
  const [legalDraft, setLegalDraft] = useState(null);
  const L = (project && project.launch) || {};

  if (!project) {
    return (
      <View>
        <Hero />
        <Panel title={'Zuerst eine App auswählen'} sub="Das Launch-Kit arbeitet mit deiner aktuellen App. Klone eine neue oder öffne eine aus deiner Sammlung.">
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <SmallBtn tone="acc" title={'⚡ App klonen'} onPress={() => goto('clone')} />
            <SmallBtn title={'🧬 Meine Apps'} onPress={() => goto('lib')} />
          </View>
        </Panel>
      </View>
    );
  }

  const save = patch => {
    const nl = { ...L, ...patch, updated: Date.now() };
    const keep = (project.files || []).filter(f => !f.path.startsWith('launch/'));
    setProject({ ...project, launch: nl, files: [...keep, ...launchFiles(project, nl)] });
  };

  const run = async (key, all) => {
    const t = TOOLS[key];
    setBusy(key); setErr(''); if (!all) setMsg('');
    try {
      const data = await askJSON(rotator, makeTally(), ev => ev && ev.label && setMsg(t.title + ': ' + ev.label), { task: 'analyze', system: t.system, user: t.user(project), maxTokens: t.max });
      let clean = key === 'market' ? data : scrub(data, project);
      if (key === 'store') clean = await fitStore(rotator, clean, project, ev => ev && ev.label && setMsg('Kürze Store-Texte: ' + ev.label));
      L[key] = clean; // fuer "Alles erzeugen" sofort sichtbar
      save({ [key]: clean });
      setOpen(key);
      if (!all) setMsg('✅ ' + t.title + ' fertig.');
      return true;
    } catch (e) {
      setErr(t.title + ': ' + e.message);
      return false;
    } finally { setBusy(''); }
  };
  const runAll = async () => {
    for (const k of ORDER) {
      if (L[k]) continue;
      setMsg('Erzeuge ' + TOOLS[k].title + ' …');
      const ok = await run(k, true);
      if (!ok) return;
    }
    setMsg('✅ Alles fertig. Lade jetzt das Launch-Paket herunter.');
  };

  const done = {
    graphics: true,
    store: !!L.store, pricing: !!L.pricing, landing: !!L.landing, legal: !!L.legalDone, marketing: !!L.marketing, market: !!L.market,
  };
  const score = Math.round((Object.values(done).filter(Boolean).length / Object.keys(done).length) * 100);
  const missing = ORDER.filter(k => !L[k]);

  const download = async () => {
    setErr(''); setBusy('zip');
    try {
      const files = launchFiles(project, L).map(f => ({ ...f, path: f.path.replace(/^launch\//, '') }));
      if (WEB) {
        const v = L.iconVariant || 'grad';
        for (const s of [512, 1024]) files.push({ path: `png/icon-${s}.png`, content: await svgToPng(iconSVG(project, v), s, s) });
        files.push({ path: 'png/feature-graphic-1024x500.png', content: await svgToPng(featureSVG(project, (L.store && L.store.de && L.store.de.untertitel) || ''), 1024, 500) });
        const caps = (L.store && L.store.screenshot_texte) || [];
        for (let i = 0; i < 3; i++) {
          files.push({ path: `png/android-${i + 1}-1080x1920.png`, content: await svgToPng(shotSVG(project, i, caps[i], 1080, 1920), 1080, 1920) });
          files.push({ path: `png/iphone-${i + 1}-1290x2796.png`, content: await svgToPng(shotSVG(project, i, caps[i], 1290, 2796), 1290, 2796) });
        }
      }
      setMsg(await saveBytes(slugOf(project) + '-launch.zip', zip(files.map(f => ({ ...f, path: slugOf(project) + '-launch/' + f.path }))), 'application/zip'));
    } catch (e) { setErr('Download: ' + e.message); }
    setBusy('');
  };

  const card = (key, view) => {
    const t = TOOLS[key]; const d = L[key]; const isOpen = open === key;
    return (
      <Panel key={key} title={`${t.icon} ${t.title}`} sub={t.sub} tone={d ? undefined : 'acc'}
        right={d ? <Text style={{ color: C.ok, fontWeight: '800' }}>{'✓'}</Text> : null}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <SmallBtn tone={d ? undefined : 'acc'} disabled={!!busy} title={busy === key ? 'Erzeuge …' : d ? '↻ Neu erzeugen' : '✨ Erzeugen'} onPress={() => run(key)} />
          {d ? <SmallBtn title={isOpen ? 'Zuklappen' : 'Ansehen'} onPress={() => setOpen(isOpen ? '' : key)} /> : null}
        </View>
        {busy === key ? <ActivityIndicator color={C.acc} style={{ marginTop: 10 }} /> : null}
        {d && isOpen ? <View style={{ marginTop: 12 }}>{view(d)}</View> : null}
      </Panel>
    );
  };

  const variants = [['grad', 'Verlauf'], ['letter', 'Initialen'], ['dark', 'Dunkel']];
  const emojis = useMemo(() => {
    const b = project.blueprint || {}; const s = new Set([emojiOf(project)]);
    for (const e of b.entities || []) e.emoji && s.add(e.emoji);
    for (const e of b.screens || []) e.emoji && s.add(e.emoji);
    ['🚀', '✨', '💡', '🎯', '⚡', '🔥'].forEach(x => s.add(x));
    return [...s].slice(0, 10);
  }, [project]);
  const lg = legalDraft || L.legal || {};
  const caps = (L.store && L.store.screenshot_texte) || [];
  const landingHtml = L.landing ? landingHTML(project, L) : '';

  return (
    <View>
      <Hero />
      <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,229,255,0.45)', padding: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppIcon project={project} size={54} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: C.txt, fontWeight: '900', fontSize: 20 }}>{project.name}</Text>
            <Text style={{ color: C.mut, fontSize: 12 }}>Launch-Bereitschaft</Text>
            <View style={{ height: 8, backgroundColor: C.card2, borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
              <View style={[{ height: 8, width: score + '%', backgroundColor: score >= 100 ? C.ok : C.acc, borderRadius: 4 }, GLOW(score >= 100 ? C.ok : C.acc, 0.6, 8)]} />
            </View>
          </View>
          <Text style={{ color: score >= 100 ? C.ok : C.acc, fontWeight: '900', fontSize: 22 }}>{score}%</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {[['graphics', '🎨 Grafiken'], ['store', '🏪 Store'], ['pricing', '💶 Preise'], ['landing', '🌐 Website'], ['legal', '⚖️ Recht'], ['marketing', '📣 Marketing'], ['market', '🎯 Pitch']].map(([k, l]) => (
            <View key={k} style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderColor: done[k] ? C.ok : C.line, backgroundColor: done[k] ? 'rgba(57,255,136,0.08)' : 'transparent' }}>
              <Text style={{ color: done[k] ? C.ok : C.mut, fontSize: 12, fontWeight: '700' }}>{done[k] ? '✓ ' : ''}{l}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {missing.length ? <View style={{ flexGrow: 1 }}><Btn title={busy ? '⏳ Läuft …' : `✨ Alles erzeugen (${missing.length} Teile)`} disabled={!!busy} onPress={runAll} /></View> : null}
          <View style={{ flexGrow: 1 }}><Btn kind={missing.length ? 'sec' : undefined} title={busy === 'zip' ? '⏳ Packe …' : '⬇️ Launch-Paket (ZIP)'} disabled={!!busy} onPress={download} /></View>
        </View>
        {msg ? <Text style={{ color: C.txt, marginTop: 10 }}>{msg}</Text> : null}
        {err ? <Text style={{ color: C.no, marginTop: 10 }}>{err}</Text> : null}
        <Text style={{ color: C.mut, fontSize: 12, marginTop: 8 }}>Alles landet auch im Projekt unter launch/ und ist damit in jedem ZIP und Server-Build dabei.</Text>
      </View>

      <Panel title={'🎨 Icon, Store-Grafik & Screenshots'} sub="Sofort fertig, ohne KI. Icon 512/1024 px, Play-Store-Grafik 1024×500, Screenshots für Android und iPhone mit deinen echten Beispieldaten." right={<Text style={{ color: C.ok, fontWeight: '800' }}>{'✓'}</Text>}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Svg svg={iconSVG(project, L.iconVariant || 'grad', 120)} w={96} h={96} radius={22} />
          <View style={{ flex: 1, minWidth: 180, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {variants.map(([k, l]) => <Chip key={k} label={l} on={(L.iconVariant || 'grad') === k} onPress={() => save({ iconVariant: k })} />)}
            </View>
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              {emojis.map(e => (
                <Pressable key={e} onPress={() => save({ iconEmoji: e })} style={{ width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: (L.iconEmoji || emojiOf(project)) === e ? C.acc : C.line, backgroundColor: C.card2 }}>
                  <Text style={{ fontSize: 17 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        {WEB ? (
          <ScrollView horizontal style={{ marginTop: 12 }} contentContainerStyle={{ gap: 10 }}>
            <Svg svg={featureSVG(project, (L.store && L.store.de && L.store.de.untertitel) || '')} w={256} h={125} radius={10} />
            {[0, 1, 2].map(i => <Svg key={i} svg={shotSVG(project, i, caps[i], 1080, 1920)} w={70} h={125} radius={8} />)}
          </ScrollView>
        ) : null}
        <Text style={{ color: C.mut, fontSize: 12, marginTop: 8 }}>Tipp: Erzeuge zuerst den Store-Eintrag, dann bekommen die Screenshots verkaufsstarke Überschriften.</Text>
      </Panel>

      {card('store', d => <StoreView d={d} />)}
      {card('pricing', d => <PricingView d={d} />)}

      <Panel title={'🌐 Landingpage'} sub={TOOLS.landing.sub} tone={L.landing ? undefined : 'acc'} right={L.landing ? <Text style={{ color: C.ok, fontWeight: '800' }}>{'✓'}</Text> : null}>
        <Text style={{ color: C.mut, fontSize: 12, marginBottom: 4 }}>Wohin führt der Kaufen-Knopf? (Store-Link, Web-App, Zahlungslink von Stripe/PayPal/Gumroad – leer = Warteliste per Mail)</Text>
        <TextInput value={L.ctaUrl || ''} onChangeText={v => save({ ctaUrl: v.trim() })} placeholder="https://…" placeholderTextColor={C.mut} autoCapitalize="none" style={{ backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 10, color: C.txt, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <SmallBtn tone={L.landing ? undefined : 'acc'} disabled={!!busy} title={busy === 'landing' ? 'Erzeuge …' : L.landing ? '↻ Texte neu' : '✨ Erzeugen'} onPress={() => run('landing')} />
          {L.landing ? <SmallBtn title={open === 'landing' ? 'Vorschau zu' : '👁️ Vorschau'} onPress={() => setOpen(open === 'landing' ? '' : 'landing')} /> : null}
          {L.landing && WEB ? <SmallBtn title={'⬇️ index.html'} onPress={async () => setMsg(await saveBytes('index.html', new TextEncoder().encode(landingHtml), 'text/html'))} /> : null}
        </View>
        {busy === 'landing' ? <ActivityIndicator color={C.acc} style={{ marginTop: 10 }} /> : null}
        {!L.pricing && !L.landing ? <Text style={{ color: C.mut, fontSize: 12, marginTop: 8 }}>Mit „Preise“ erzeugt, bekommt die Seite automatisch eine Preis-Tabelle; mit „Rechtstexte“ Impressum und Datenschutz.</Text> : null}
        {L.landing && open === 'landing' ? <View style={{ marginTop: 12 }}><Frame html={landingHtml} /></View> : null}
      </Panel>

      <Panel title={'⚖️ Rechtstexte'} sub="Impressum, Datenschutzerklärung (passend zu Offline-DB, Sync und KI) und Nutzungsbedingungen. Pflicht für Play Store und App Store." right={L.legalDone ? <Text style={{ color: C.ok, fontWeight: '800' }}>{'✓'}</Text> : null} tone={L.legalDone ? undefined : 'acc'}>
        {open === 'legal' || !L.legalDone ? (
          <View>
            {LEGAL_FIELDS.map(([k, l]) => (
              <TextInput key={k} value={lg[k] || ''} onChangeText={v => setLegalDraft({ ...lg, [k]: v })} placeholder={l} placeholderTextColor={C.mut} autoCapitalize={k === 'email' ? 'none' : 'sentences'} style={{ backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 10, color: C.txt, marginBottom: 6 }} />
            ))}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <SmallBtn tone="acc" title={'✅ Rechtstexte erstellen'} onPress={() => { save({ legal: lg, legalDone: true }); setLegalDraft(null); setOpen(''); setMsg('✅ Rechtstexte erstellt (launch/website/).'); }} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <SmallBtn title={'✏️ Angaben ändern'} onPress={() => setOpen('legal')} />
            {WEB ? <SmallBtn title={'👁️ Datenschutz ansehen'} onPress={() => setOpen(open === 'legalview' ? '' : 'legalview')} /> : null}
          </View>
        )}
        {open === 'legalview' ? <View style={{ marginTop: 12 }}><Frame html={legalHTML(project, 'datenschutz', L.legal || {})} height={420} /></View> : null}
        <Text style={{ color: C.mut, fontSize: 12, marginTop: 8 }}>Vorlagen, keine Rechtsberatung. Vor der Veröffentlichung prüfen.</Text>
      </Panel>

      {card('marketing', d => <MarketingView d={d} />)}
      {card('market', d => <MarketView d={d} />)}

      <Panel title={'✅ Vor dem Veröffentlichen'}>
        <Bullets items={[
          'App testen: ▶️ Testen im Studio, alle Tabs einmal durchklicken.',
          'Packen → Android-APK/AAB und Web-Version bauen lassen.',
          'Landingpage + Rechtstexte hochladen (z. B. GitHub Pages) und die Datenschutz-URL im Store eintragen.',
          'Play Console (einmalig 25 $) bzw. Apple Developer (99 $/Jahr) anlegen, Store-Texte und PNGs aus dem Launch-Paket einfügen.',
          'Marketing-Plan ab „Tag -7“ abarbeiten.',
        ]} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <SmallBtn tone="acc" title={'▶️ App testen'} onPress={onPlay} />
          <SmallBtn title={'📦 Packen'} onPress={() => goto('pack')} />
        </View>
      </Panel>
    </View>
  );
}

function Hero() {
  return (
    <View style={{ paddingTop: 6, paddingBottom: 12 }}>
      <Text style={{ color: C.txt, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>{'🚀 Launch-Kit'}</Text>
      <Text style={{ color: C.mut, marginTop: 4, lineHeight: 19 }}>Von der fertigen App zum verkaufbaren Produkt: Store-Eintrag, Grafiken, Website, Preise, Rechtstexte und Marketing – in Minuten.</Text>
    </View>
  );
}

/* ------------------------------------------- Server-Klon: Status am Knopf */

export function CloudStatus({ ctl, onSettings }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 15000); return () => clearInterval(t); }, []);
  if (!ctl) return null;
  const { job, err, starting, label } = ctl;
  if (!job && !err && !starting) return null;
  const st = (job && job.status) || {};
  const since = job && /^c(\d+)$/.test(job.id || '') ? Date.now() - Number(job.id.slice(1)) : 0;
  const min = Math.floor(since / 60000);
  const noSignal = job && st.state === 'running' && !st.startedAt && min >= 5;
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  const actions = job && job.owner && job.repo ? `https://github.com/${job.owner}/${job.repo}/actions` : '';
  const isAuth = err && /Token|workflow|Zugriff|Recht|API-Key/i.test(err);
  return (
    <View style={{ marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: err || st.state === 'error' ? C.no : C.acc, backgroundColor: err || st.state === 'error' ? 'rgba(255,59,107,0.08)' : 'rgba(0,229,255,0.07)' }}>
      {starting ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={C.acc} />
          <Text style={{ color: C.txt, flex: 1 }}>{label || 'Starte Server …'}</Text>
        </View>
      ) : null}
      {job ? (
        <View>
          <Text style={{ color: st.state === 'error' ? C.no : C.acc, fontWeight: '800' }}>
            {st.state === 'error' ? '❌ Server-Klon fehlgeschlagen' : '☁️ Server baut die App' + (min ? ` · seit ${min} Min.` : '')}
          </Text>
          <Text style={{ color: C.txt, marginTop: 4 }}>{st.state === 'error' ? st.error || 'Unbekannter Fehler' : st.stage || 'Server startet …'}</Text>
          {st.total ? (
            <View style={{ height: 8, backgroundColor: C.card2, borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
              <View style={{ width: pct + '%', height: 8, backgroundColor: C.acc }} />
            </View>
          ) : null}
          {st.state !== 'error' ? <Text style={{ color: C.mut, fontSize: 12, marginTop: 6 }}>Dauert meist 5–15 Minuten. Du kannst die App schließen. Beim nächsten Öffnen holt sie das Ergebnis automatisch.</Text> : null}
          {noSignal ? <Text style={{ color: C.warn, fontSize: 12, marginTop: 6 }}>Noch keine Rückmeldung vom Server. Prüfe unter GitHub → Actions, ob der Lauf gestartet ist (Actions müssen im Repo erlaubt sein).</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <SmallBtn tone="acc" title="🔄 Stand holen" onPress={ctl.refresh} />
            {actions ? <SmallBtn title="GitHub-Lauf ansehen" onPress={() => Linking.openURL(actions)} /> : null}
            <SmallBtn title={st.state === 'error' ? '✖ Schließen' : '✖ Abbrechen'} onPress={ctl.dismiss} />
          </View>
        </View>
      ) : null}
      {err && !job ? (
        <View>
          <Text style={{ color: C.no, fontWeight: '800' }}>❌ Server-Klon nicht gestartet</Text>
          <Text style={{ color: C.txt, marginTop: 4 }}>{err}</Text>
          {isAuth && onSettings ? <View style={{ flexDirection: 'row', marginTop: 10 }}><SmallBtn tone="acc" title="⚙️ Einstellungen öffnen" onPress={onSettings} /></View> : null}
        </View>
      ) : err && job ? <Text style={{ color: C.warn, fontSize: 12, marginTop: 8 }}>{err}</Text> : null}
    </View>
  );
}
