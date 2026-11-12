#!/usr/bin/env python3
"""Baut die Fullstack-/KI-Erweiterung in die gebauten Bundles ein (runner.mjs + index.html).

Aufruf:  python3 tools/patch_fullstack.py            (aus dem Repo-Hauptordner)
Die Vorlagen liegen in tools/clone-templates/. Das Skript ist idempotent: bereits gepatchte Bundles
werden am Marker erkannt, dann bricht es ab (vorher: git checkout runner.mjs index.html).
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, 'tools', 'clone-templates')
MARK = 'src/agenttools.js'

ADD = ['src/server.js', 'src/ai.js', 'src/sync.js', 'src/agenttools.js', 'src/screens/AssistantScreen.js',
       'server/index.mjs', 'server/README.md', 'Dockerfile', '.dockerignore']
REPLACE = ['src/settings.js', 'src/screens/SettingsScreen.js']


def tpl(p):
    with open(os.path.join(TPL, p), encoding='utf-8') as f:
        return f.read()


def lit(s):
    return json.dumps(s, ensure_ascii=True).replace('</', '<\\/')


def sub(src, old, new, count=1, name=''):
    n = src.count(old)
    if n != count:
        sys.exit(f'Anker nicht eindeutig ({n}x statt {count}x): {name or old[:80]!r}')
    return src.replace(old, new)


def literal_end(src, i):
    q = src[i]
    assert q in '"\'`', src[i:i + 40]
    j = i + 1
    while True:
        c = src[j]
        if c == '\\':
            j += 2
            continue
        if c == q:
            return j + 1
        j += 1


def replace_embedded(src, key, content):
    for pat in (f'"{key}": ', f'"{key}":'):
        if src.count(pat) == 1:
            i = src.index(pat) + len(pat)
            j = literal_end(src, i)
            return src[:i] + lit(content) + src[j:]
    sys.exit('Embedded-Eintrag nicht gefunden: ' + key)


def add_embedded(src, before, after):
    entries = ''.join(f'{lit(p)}:{lit(tpl(p))},' for p in ADD)
    return sub(src, before + after, before + entries + after, name='EMBEDDED-Anker')


# ---------- gemeinsamer Code (gleich in beiden Bundles) ----------
AITOOLS = ("{path:'src/aitools.js',content:'// Verbindet KI-Agent und Server mit der Backend-Logik (automatisch erzeugt)\\n'"
           "+BP.entities.map(e=>`import * as ${e.service} from './services/${e.service}.js';`).join('\\n')"
           "+'\\n\\nexport const SERVICES = {\\n'+BP.entities.map(e=>`  ${e.name}: ${e.service},`).join('\\n')+'\\n};\\n'}")

AIFEAT = ("(Array.isArray(RAW.ki_funktionen)?RAW.ki_funktionen:[]).filter(f=>f&&'object'==typeof f)"
          ".map(f=>({title:TXT(f.titel||f.title,40),emoji:TXT(f.emoji,4)||'\\u2728',entity:CAMEL(f.entity||f.entitaet,''),"
          "output:/eintr|entr/i.test(String(f.ausgabe||f.output||''))?'entries':'text',task:TXT(f.aufgabe||f.task,400)}))"
          ".filter(f=>f.title&&f.task&&ENTS.some(e=>e.name===f.entity)).slice(0,6)")

TO_RAW_KI = ("ki_funktionen:(BP.aiFeatures||[]).map(f=>({titel:f.title,emoji:f.emoji,entity:f.entity,"
             "ausgabe:'entries'===f.output?'eintraege':'text',aufgabe:f.task}))")

KI_FORMAT = (',\\n "ki_funktionen": [\\n   {"titel":"Wochen-Coach","emoji":"\\ud83e\\udde0","entity":"habits","ausgabe":"text",'
             '"aufgabe":"Analysiere die Gewohnheiten und gib 3 konkrete Tipps fuer die naechste Woche"},\\n'
             '   {"titel":"Neue Gewohnheiten","emoji":"\\u2728","entity":"habits","ausgabe":"eintraege",'
             '"aufgabe":"Schlage 3 passende neue Gewohnheiten vor"}\\n ]')
KI_RULE = ('Regeln fuer ki_funktionen: 2 bis 6 KI-Funktionen, die diese App mit einem Sprachmodell wirklich nuetzlicher machen '
           '(auswerten, zusammenfassen, planen, vorschlagen, erzeugen). entity = Name einer Entitaet; ausgabe "text" (Antwort/Analyse) '
           'oder "eintraege" (KI erzeugt neue Datensaetze dieser Entitaet); aufgabe = klare Anweisung an die KI. '
           'Die App hat zusaetzlich immer einen KI-Assistenten (Chat), der alle Daten lesen und aendern kann.\\n')
API_KI = ('\\nKI  import { ask, askJSON, chat, aiReady } from \'../ai.js\'   (NUR in Screens, nicht in Services)\\n'
          '  const text = await ask(\'Frage oder Auftrag\', { maxTokens })   \\u00b7 const obj = await askJSON(\'... gib {\\"x\\":...} zurueck\')\\n'
          '  await aiReady() \\u2192 false, wenn noch kein KI-Zugang eingerichtet ist (dann Hinweis: Einstellungen \\u2192 KI). Immer in try/catch, Ladezustand zeigen.')
README_ADD = [
    '## KI-Assistent',
    'Tab **KI**: ein Chat, der die App wirklich bedient (suchen, anlegen, aendern, auswerten), plus Schnellaktionen fuer diese App. '
    'Einrichten unter *Einstellungen → KI* (kostenloser Key von OpenRouter, Google AI Studio oder Groq) oder ueber den eigenen Server.',
    '',
    '## Backend-Server',
    '`npm run server` startet das Backend (Ordner `server/`, Node 18+, ohne Zusatzpakete): REST-API fuer alle Tabellen, '
    'Fachfunktionen aus `src/services`, Sync zwischen Geraeten und Personen, KI-Proxy und Auslieferung der Web-App. '
    'Docker: `docker build -t app .`. Details: `server/README.md`.',
    '',
]
WELCOME_OLD = 'Alles laeuft lokal auf deinem Geraet. Keine Anmeldung, kein Server, deine Daten gehoeren dir.'
WELCOME_NEW = 'Deine Daten liegen auf deinem Geraet. Optional: KI-Assistent und eigener Server fuer mehrere Geraete.'
SKIP_FILES = ['src/ai.js', 'src/sync.js', 'src/server.js']
WIRING_ADD = ['src/ai.js', 'src/sync.js', 'src/server.js', 'src/agenttools.js', 'src/aitools.js', 'src/screens/AssistantScreen.js']
IMPORTS_APP = "import AssistantScreen from './src/screens/AssistantScreen.js';\\nimport { startSync } from './src/sync.js';\\n"
TAB_KI = "  { key: 'AssistantScreen', title: 'KI', emoji: '\\ud83e\\udd16', Component: AssistantScreen },"
FULL_OLD = 'kein fetch/WebSocket. Alles laeuft lokal auf dem Geraet.'
FULL_NEW = "kein eigenes fetch/WebSocket. Alles laeuft lokal auf dem Geraet. Ausnahme KI: Screens duerfen ask/askJSON aus '../ai.js' nutzen (siehe KI)."
GITIGNORE_ADD = "'server/data/','server/.runtime/','server/.env',"


def common(src, q):
    """Patches, deren Anker in beiden Bundles identisch sind (q = Anfuehrungszeichen-Stil)."""
    src = sub(src, WELCOME_OLD, WELCOME_NEW, name='welcome')
    src = sub(src, FULL_OLD, FULL_NEW, name='fullstack-rules')
    src = sub(src, 'theme.bg, card, text, muted, border, primary, accent, danger', 'theme.bg, card, text, muted, border, primary, accent, danger' + API_KI, name='api-doc')
    src = sub(src, 'useEffect(() => { initSettings(); startActivity(); }, []);', 'useEffect(() => { initSettings(); startActivity(); startSync(); }, []);', name='app-sync')
    src = sub(src, q + 'Hinweise zum Nachbau und Copyright', ''.join(lit(x) + ',' for x in README_ADD) + q + 'Hinweise zum Nachbau und Copyright', name='readme')
    src = sub(src, q + 'desktop/node_modules/' + q + ',', q + 'desktop/node_modules/' + q + ',' + GITIGNORE_ADD.replace("'", q), name='gitignore')
    return src


def patch_runner(src):
    src = add_embedded(src, '    EMBEDDED = {\n', '      "src/db/engine.js":')
    for p in REPLACE:
        src = replace_embedded(src, p, tpl(p))
    src = common(src, '"')
    src = sub(src, '"zweck":"Was der Screen kann (Liste, Anlegen, Filter, Statistik ...)"}\n ]\n}\n',
              '"zweck":"Was der Screen kann (Liste, Anlegen, Filter, Statistik ...)"}\n ]' + KI_FORMAT + '\n}\n', name='ki-format')
    src = sub(src, 'Regeln fuer screens: ein Screen je Haupt-Entitaet', KI_RULE + 'Regeln fuer screens: ein Screen je Haupt-Entitaet', name='ki-rule')
    src = sub(src, '    screens: Array.isArray(a.screens) ? a.screens : []\n  };',
              '    screens: Array.isArray(a.screens) ? a.screens : [],\n    ki_funktionen: Array.isArray(a.ki_funktionen) ? a.ki_funktionen : []\n  };', name='parseAnalysis')
    src = sub(src, '    schema: schemaFromEntities(entities)\n  };\n}',
              '    schema: schemaFromEntities(entities),\n    aiFeatures: ' + AIFEAT.replace('RAW', 'r').replace('TXT', 'text').replace('CAMEL', 'camel').replace('ENTS', 'entities') + '\n  };\n}', name='normalizeBlueprint')
    src = sub(src, "pack: \"node scripts/pack.mjs all\"", "pack: \"node scripts/pack.mjs all\",\n      server: \"node server/index.mjs\"", name='scripts')
    src = sub(src, "export const APP = ${J2(app)};\n`;", "export const APP = ${J2(app)};\nexport const AI_FEATURES = ${J2(bp.aiFeatures || [])};\n`;", name='meta')
    src = sub(src, "import { SafeBoundary, startup } from './src/selfdoctor.js';\n${imports}", "import { SafeBoundary, startup } from './src/selfdoctor.js';\n" + IMPORTS_APP + "${imports}", name='app-imports')
    src = sub(src, "Component: DashboardScreen },`, ...bp.screens", "Component: DashboardScreen },`, \"" + TAB_KI + "\", ...bp.screens", name='app-tab')
    src = sub(src, "  for (const e of bp.entities) files.push({ path: `src/services/${e.service}.js`, content: genServiceBase(e) });\n",
              "  for (const e of bp.entities) files.push({ path: `src/services/${e.service}.js`, content: genServiceBase(e) });\n  files.push(" + AITOOLS.replace('BP', 'bp') + ");\n", name='aitools')
    src = sub(src, 'if (f.path === "src/db/engine.js" || f.path === "src/hooks.js" || f.path === "src/ui/kit.js" || f.path === "src/ui/viz.js") continue;',
              'if (f.path === "src/db/engine.js" || f.path === "src/hooks.js" || f.path === "src/ui/kit.js" || f.path === "src/ui/viz.js" || ' + ' || '.join(f'f.path === "{x}"' for x in SKIP_FILES) + ') continue;', name='verify-skip')
    src = sub(src, '"src/welcome.js", "src/screens/SettingsScreen.js"]', '"src/welcome.js", "src/screens/SettingsScreen.js", ' + ', '.join(f'"{x}"' for x in WIRING_ADD) + ']', name='verify-wiring')
    src = sub(src, 'src\\/services\\/[A-Za-z0-9_]+Service\\.js)$/;\nfunction blueprintToRaw', 'src\\/services\\/[A-Za-z0-9_]+Service\\.js|src\\/aitools\\.js)$/;\nfunction blueprintToRaw', name='generated')
    src = sub(src, "    screens: bp.screens.map((s) => ({ name: s.name.replace(/Screen$/, \"\"), title: s.title, emoji: s.emoji, entity: s.entity, zweck: s.purpose }))\n  };",
              "    screens: bp.screens.map((s) => ({ name: s.name.replace(/Screen$/, \"\"), title: s.title, emoji: s.emoji, entity: s.entity, zweck: s.purpose })),\n    " + TO_RAW_KI.replace('BP', 'bp') + "\n  };", name='toRaw')
    src = sub(src, "entitaeten: resp.blueprint.entitaeten, screens: resp.blueprint.screens || [] };",
              "entitaeten: resp.blueprint.entitaeten, screens: resp.blueprint.screens || [], ki_funktionen: resp.blueprint.ki_funktionen || blueprintToRaw(bp).ki_funktionen };", name='agent-raw')
    src = sub(src, "for (const f of genConfigFiles(nb)) if (GENERATED.test(f.path)) set(f.path, f.content);",
              "for (const f of genConfigFiles(nb)) if (GENERATED.test(f.path) || (EMBEDDED[f.path] && !map.has(f.path))) set(f.path, f.content);", name='agent-upgrade')
    return src


def patch_index(src):
    src = add_embedded(src, 'const n={', '"src/db/engine.js":')
    for p in REPLACE:
        src = replace_embedded(src, p, tpl(p))
    src = common(src, "'")
    src = sub(src, '"zweck":"Was der Screen kann (Liste, Anlegen, Filter, Statistik ...)"}\\n ]\\n}\\n',
              '"zweck":"Was der Screen kann (Liste, Anlegen, Filter, Statistik ...)"}\\n ]' + KI_FORMAT + '\\n}\\n', name='ki-format')
    src = sub(src, 'Regeln fuer screens: ein Screen je Haupt-Entitaet', KI_RULE + 'Regeln fuer screens: ein Screen je Haupt-Entitaet', name='ki-rule')
    src = sub(src, "screens:Array.isArray(n.screens)?n.screens:[]};return a.blueprint=",
              "screens:Array.isArray(n.screens)?n.screens:[],ki_funktionen:Array.isArray(n.ki_funktionen)?n.ki_funktionen:[]};return a.blueprint=", name='parseAnalysis')
    src = sub(src, "notes:i,schema:b(c)}}",
              "notes:i,schema:b(c),aiFeatures:" + AIFEAT.replace('RAW', 's').replace('TXT', 'd').replace('CAMEL', 'u').replace('ENTS', 'c') + "}}", name='normalizeBlueprint')
    src = sub(src, "pack:'node scripts/pack.mjs all'}", "pack:'node scripts/pack.mjs all',server:'node server/index.mjs'}", name='scripts')
    src = sub(src, "export const APP = ${o(n)};\\n`}", "export const APP = ${o(n)};\\nexport const AI_FEATURES = ${o(e.aiFeatures||[])};\\n`}", name='meta')
    src = sub(src, "import { SafeBoundary, startup } from './src/selfdoctor.js';\\n${[", "import { SafeBoundary, startup } from './src/selfdoctor.js';\\n" + IMPORTS_APP + "${[", name='app-imports')
    src = sub(src, "Component: DashboardScreen },\",...e.screens", "Component: DashboardScreen },\",\"" + TAB_KI + "\",...e.screens", name='app-tab')
    src = sub(src, "for(const e of t.entities)n.push({path:`src/services/${e.service}.js`,content:f(e)});",
              "for(const e of t.entities)n.push({path:`src/services/${e.service}.js`,content:f(e)});n.push(" + AITOOLS.replace('BP', 't') + ");", name='aitools')
    src = sub(src, "'src/db/engine.js'!==t.path&&'src/hooks.js'!==t.path&&'src/ui/kit.js'!==t.path&&'src/ui/viz.js'!==t.path",
              "'src/db/engine.js'!==t.path&&'src/hooks.js'!==t.path&&'src/ui/kit.js'!==t.path&&'src/ui/viz.js'!==t.path&&" + '&&'.join(f"'{x}'!==t.path" for x in SKIP_FILES), name='verify-skip')
    src = sub(src, "'src/welcome.js','src/screens/SettingsScreen.js']", "'src/welcome.js','src/screens/SettingsScreen.js'," + ','.join(f"'{x}'" for x in WIRING_ADD) + ']', name='verify-wiring')
    src = sub(src, "src\\/services\\/[A-Za-z0-9_]+Service\\.js)$/;function d(e)", "src\\/services\\/[A-Za-z0-9_]+Service\\.js|src\\/aitools\\.js)$/;function d(e)", name='generated')
    src = sub(src, "entity:e.entity,zweck:e.purpose}))}}const p=()=>", "entity:e.entity,zweck:e.purpose})),"
              + TO_RAW_KI.replace('BP', 'e') + "}}const p=()=>", name='toRaw')
    src = sub(src, "entitaeten:i.blueprint.entitaeten,screens:i.blueprint.screens||[]}",
              "entitaeten:i.blueprint.entitaeten,screens:i.blueprint.screens||[],ki_funktionen:i.blueprint.ki_funktionen||d(f).ki_funktionen}", name='agent-raw')
    src = sub(src, "for(const e of(0,t.genConfigFiles)(l))u.test(e.path)&&m(e.path,e.content);",
              "for(const e of(0,t.genConfigFiles)(l))(u.test(e.path)||c.EMBEDDED[e.path]&&!p.has(e.path))&&m(e.path,e.content);", name='agent-upgrade')
    # CloneForge-Oberflaeche: Versprechen auf der Startseite
    src = sub(src, 'Datenbank, Backend, Screens, Pr\\xfcfung \\u2013 alles automatisch', 'Datenbank, Backend-Server, KI-Assistent, Screens, Pr\\xfcfung \\u2013 alles automatisch', name='ui-claim')
    # Vorschau: Klone duerfen den KI-Key von CloneForge mitbenutzen (KI sofort testbar)
    src = sub(src, "ct=!(!ee.github||!ee.github.token)&&Object.values(ee.keys).some(Boolean),",
              "ct=!(!ee.github||!ee.github.token)&&Object.values(ee.keys).some(Boolean),__cfHK=(globalThis.__CF_HOST_KEYS__=ee.keys||{}),", name='host-keys')
    # Willkommenskarte nur auf dem Tab "Klonen"
    src = sub(src, "G?(0,W.jsx)(M.default,{settings:ee,update:et,rotator:le,onDone:Y,", "G&&'clone'===K?(0,W.jsx)(M.default,{settings:ee,update:et,rotator:le,onDone:Y,", name='welcome-tab')
    return src


def main():
    for name, fn in (('runner.mjs', patch_runner), ('index.html', patch_index)):
        p = os.path.join(ROOT, name)
        with open(p, encoding='utf-8') as f:
            src = f.read()
        if MARK in src:
            sys.exit(f'{name} ist schon gepatcht (Marker {MARK} gefunden). Erst Original wiederherstellen: git checkout {name}')
        out = fn(src)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(out)
        print(f'{name}: ok ({len(src)} → {len(out)} Bytes)')


if __name__ == '__main__':
    main()
