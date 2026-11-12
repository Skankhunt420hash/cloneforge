#!/usr/bin/env python3
"""Baut die UI-Erweiterung (tools/app-src/cfx.build.js) in index.html ein.

Reihenfolge: zuerst tools/patch_fullstack.py, dann dieses Skript.
cfx.build.js neu bauen (nach Aenderungen an cfx.jsx):

  npx esbuild@0.24.2 tools/app-src/cfx.jsx --bundle --format=cjs --jsx=automatic \
    --external:react --external:react/jsx-runtime --external:react-native --external:'cf/*' \
    --target=es2020 --minify --outfile=tools/app-src/cfx.build.js
"""
import json, os, re, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'index.html')
BUILD = os.path.join(ROOT, 'tools', 'app-src', 'cfx.build.js')
MOD_ID = 9001
DEPS = {'react': 38, 'react/jsx-runtime': 279, 'react-native': 291, 'cf/ui': 340, 'cf/ai': 413, 'cf/save': 407}

s = open(HTML, encoding='utf-8').read()
if 'CFX=_r(' in s:
    sys.exit('index.html ist schon gepatcht (CFX gefunden).')


def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f'Anker nicht eindeutig ({n}x statt {count}x): {old[:90]!r}')
    s = s.replace(old, new)


# ---- 1. Viewport: Tab-Leiste darf nicht unter der Browser-Leiste verschwinden
rep('overflow:hidden;-webkit-text-size-adjust:100%;overscroll-behavior:none}body{min-height:100dvh}',
    'overflow:hidden;-webkit-text-size-adjust:100%;overscroll-behavior:none}body{height:100dvh}')
rep('html,body{background:#05060d;margin:0;width:100%;height:100%;min-height:100vh;',
    'html,body{background:#05060d;margin:0;width:100%;height:100%;')
rep('#root{display:flex;width:100%;height:100%;min-height:100dvh;',
    '#root{display:flex;width:100%;height:100%;height:100dvh;min-height:0;')

# ---- 2. Syntaxpruefung im Browser: sucrase.js bei Bedarf nachladen
loader = ("<script>window.__cfLoadSucrase=function(){if(window.CFSucrase)return Promise.resolve(window.CFSucrase);"
          "return window.__cfSuc||(window.__cfSuc=new Promise(function(res,rej){var s=document.createElement('script');"
          "s.src='sucrase.js';s.onload=function(){window.CFSucrase?res(window.CFSucrase):rej(new Error('sucrase'))};"
          "s.onerror=function(){window.__cfSuc=null;rej(new Error('sucrase.js nicht ladbar'))};document.head.appendChild(s)}))};</script>")
rep('<link rel="manifest" href="manifest.webmanifest"/>', loader + '<link rel="manifest" href="manifest.webmanifest"/>')
rep('async function o(){return s}',
    'let __sx=s;async function o(){if(!__sx&&globalThis.__cfLoadSucrase)try{__sx=await globalThis.__cfLoadSucrase()}catch(e){}return __sx}')

# ---- 3. Neue Build-Nummer, damit offene Apps das Update melden
build = time.strftime('%Y%m%d%H%M%S', time.gmtime())
s, n = re.subn(r'window\.CF_BUILD="\d+"', f'window.CF_BUILD="{build}"', s)
assert n == 1, 'CF_BUILD nicht gefunden'
open(os.path.join(ROOT, 'version.json'), 'w').write(json.dumps({'build': build}, separators=(',', ':')))

# ---- 4. Haupt-App (Modul 144) mit CFX verdrahten
deps144 = re.search(r'\},144,\[([0-9,]+)\]\);', s)
assert deps144, 'Modul 144 nicht gefunden'
lst = deps144.group(1).split(',')
assert len(lst) == 36, f'Modul 144 hat {len(lst)} Abhaengigkeiten, erwartet 36'
s = s.replace(deps144.group(0), '},144,[' + deps144.group(1) + f',{MOD_ID}]);')
rep('W=_r(d[35]);function N(){', 'W=_r(d[35]),CFX=_r(d[36]);function N(){')
rep('function $(){const e=(0,c.useSafeAreaInsets)(),', 'function $(){const e=(0,c.useSafeAreaInsets)(),__cfWide=(0,CFX.useWide)(),')
rep('style:[R.s.root,{paddingTop:0}]', 'style:[R.s.root,{paddingTop:0},__cfWide&&{paddingLeft:CFX.SIDEBAR}]')
rep("style:R.s.wrap,children:[(0,W.jsxs)(n.default,{style:{flexDirection:'row',alignItems:'center',gap:12,paddingTop:12,paddingBottom:6}",
    "style:[R.s.wrap,__cfWide&&{maxWidth:820}],children:[__cfWide?null:(0,W.jsxs)(n.default,{style:{flexDirection:'row',alignItems:'center',gap:12,paddingTop:10,paddingBottom:4}")
# Hilfsfunktionen: Projekt setzen + aktuelles Projekt in der Vorschau starten
rep('__cfHK=(globalThis.__CF_HOST_KEYS__=ee.keys||{}),',
    "__cfHK=(globalThis.__CF_HOST_KEYS__=ee.keys||{}),"
    "__cfSetP=e=>{ae(e),h.default.setItem('cf_last_project',JSON.stringify(e)).catch(()=>{})},"
    "__cfPlay=()=>{re&&Be({entry:{id:Ie.current||'current',name:re.name},project:re})},")

# Navigation: Mehr-Blatt + Tab-Leiste ersetzen
start = s.find("o?(0,W.jsx)(r.default,{onPress:()=>$(!1),style:{position:'absolute'")
end_anchor = 'e.key)})})})]})}function F(){'
end = s.find(end_anchor)
assert start > 0 and end > start and s.count(end_anchor) == 1 and end - start < 6000, 'Navigation nicht gefunden'
s = (s[:start]
     + '(0,W.jsx)(CFX.Nav,{tab:K,setTab:J,more:o,setMore:$,inset:e.bottom,doctor:oe,missionRunning:ht,wide:__cfWide,project:re})]})}function F(){'
     + s[end + len(end_anchor):])

# Launch-Tab
rep("children:['lib'===K?(0,W.jsx)(m.default,{",
    "children:['launch'===K?(0,W.jsx)(CFX.LaunchScreen,{project:re,rotator:le,setProject:__cfSetP,onPlay:__cfPlay,goto:J}):'lib'===K?(0,W.jsx)(m.default,{")
# Studio = Projektleiste + Bearbeiten-Chat
rep("'chat'===K?(0,W.jsx)(w.default,{project:re,",
    "'chat'===K?(0,W.jsxs)(n.default,{children:[(0,W.jsx)(CFX.ProjectBar,{project:re,onPlay:__cfPlay,onPack:()=>J('pack'),onLaunch:()=>J('launch'),onApps:()=>J('lib')}),(0,W.jsx)(w.default,{project:re,")
rep("onMission:(e,t)=>{at.start(e,t),J('mission')}}):'mission'===K?",
    "onMission:(e,t)=>{at.start(e,t),J('mission')}})]}):'mission'===K?")
# App-Mixer mit (+)
rep("||it.starting||!!it.job})]}),(0,W.jsx)(r.default,{onPress:()=>Re(!De),",
    "||it.starting||!!it.job})]}),(0,W.jsx)(CFX.MixBar,{value:be,setValue:xe,max:b.MIX_MAX}),(0,W.jsx)(r.default,{onPress:()=>Re(!De),")
rep('(0,W.jsxs)(s.default,{style:R.s.hintTight,children:["\\ud83e\\uddec App-Mixer: mehrere Apps mit + eingeben (bis zu ",b.MIX_MAX,"), z. B. \\u201eNotion + Duolingo + Spotify\\". CloneForge macht daraus eine ganz neue App."]}),', '')
rep('placeholder:"App-Name, z.B. Duolingo \\u2026 oder !model gpt55"', 'placeholder:"App-Name, z. B. Duolingo"')
# Ergebnis: Fertig-Karte oben, Pruefberichte eingeklappt
rep('re?(0,W.jsxs)(n.default,{children:[(0,W.jsxs)(R.Card,{title:"Compliance-Check"',
    "re?(0,W.jsxs)(n.default,{children:[(0,W.jsx)(CFX.ReadyCard,{project:re,onPlay:__cfPlay,onStudio:()=>J('chat'),onLaunch:()=>J('launch'),onPack:()=>J('pack')}),"
    '(0,W.jsxs)(CFX.Collapse,{title:"\\ud83d\\udd0e Pr\\xfcfberichte, Dateien & Befehle",children:[(0,W.jsxs)(R.Card,{title:"Compliance-Check"')
rep('(siehe README im ZIP)."})]})]}):null]})', '(siehe README im ZIP)."})]})]})]}):null]})')

# ---- 5. CFX-Modul einsetzen
code = open(BUILD, encoding='utf-8').read()
if '</script' in code.lower():
    sys.exit('cfx.build.js enthaelt </script')
if any(ord(ch) > 127 for ch in code):
    sys.exit('cfx.build.js muss ASCII sein (ohne --charset=utf8 bauen)')
mod = ('__d(function(g,_r,_i,_a,module,exports,_d){var __M=' + json.dumps(DEPS, separators=(',', ':'))
       + ';var require=function(n){if(!(n in __M))throw new Error("cfx: "+n);return _r(__M[n])};'
       + code + '},' + str(MOD_ID) + ',' + json.dumps(sorted(set(DEPS.values()))).replace(' ', '') + ');\n')
rep('\n__r(3);', '\n' + mod + '__r(3);')

open(HTML, 'w', encoding='utf-8').write(s)
print('index.html gepatcht, Build', build)
