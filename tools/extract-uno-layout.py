# Extract top-side layout data from the official Arduino UNO Rev3 EAGLE board file.
#
# Source: https://docs.arduino.cc/static/6bb7a3ca51ebee82a252f60c0b418787/A000066-cad-files.zip
#   (linked from https://docs.arduino.cc/hardware/uno-rev3/) -> A000066-cad-files/UNO-TH_Rev3e.brd
# Licence: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0), Arduino.
#   The extracted JSON is a derivative and stays CC BY-SA 4.0; the app credits it in src/legal/credits.ts.
#
# Usage: python -I tools/extract-uno-layout.py UNO-TH_Rev3e.brd src/three/boards/uno/uno-layout.json
#
import json, math, sys
import xml.etree.ElementTree as ET

src, dst = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()
board = root.find('.//board')

def rot_of(s):
    s = s or 'R0'
    mirror = 'M' in s
    ang = float(s.replace('M', '').replace('S', '').replace('R', '') or 0)
    return mirror, ang

def tf(px, py, ex, ey, mirror, ang):
    if mirror:
        px = -px
    a = math.radians(ang)
    return (ex + px * math.cos(a) - py * math.sin(a), ey + px * math.sin(a) + py * math.cos(a))

# packages by (library, package)
pkgs = {}
for lib in board.findall('./libraries/library'):
    for p in lib.findall('./packages/package'):
        pkgs[(lib.get('name'), p.get('name'))] = p

out = {'outline': [], 'holes': [], 'elements': [], 'copper': [], 'vias': [], 'smd': [], 'pads': [], 'silk': [], 'silkCircles': []}
R = lambda v: round(float(v), 3)

for w in board.findall('./plain/wire'):
    if w.get('layer') == '20':
        out['outline'].append([R(w.get('x1')), R(w.get('y1')), R(w.get('x2')), R(w.get('y2')), R(w.get('curve') or 0)])
    elif w.get('layer') == '21':
        out['silk'].append([R(w.get('x1')), R(w.get('y1')), R(w.get('x2')), R(w.get('y2')), R(w.get('width'))])
out['texts'] = []
for t in board.findall('./plain/text'):
    if t.get('layer') == '21':
        mirror, ang = rot_of(t.get('rot'))
        out['texts'].append([R(t.get('x')), R(t.get('y')), R(t.get('size')), ang, (t.text or '').strip(), t.get('align') or 'bottom-left'])
out['silkPolys'] = len(board.findall("./plain/polygon[@layer='21']"))
for h in board.findall('./plain/hole'):
    out['holes'].append([R(h.get('x')), R(h.get('y')), R(h.get('drill'))])

for e in board.findall('./elements/element'):
    mirror, ang = rot_of(e.get('rot'))
    ex, ey = float(e.get('x')), float(e.get('y'))
    out['elements'].append({'name': e.get('name'), 'pkg': e.get('package'), 'value': e.get('value'), 'x': R(ex), 'y': R(ey), 'rot': ang, 'bottom': mirror})
    if mirror:
        continue  # bottom-side part, not visible from the top
    p = pkgs.get((e.get('library'), e.get('package')))
    if p is None:
        continue
    for s in p.findall('smd'):
        if s.get('layer') != '1':
            continue
        cx, cy = tf(float(s.get('x')), float(s.get('y')), ex, ey, mirror, ang)
        _, sr = rot_of(s.get('rot'))
        out['smd'].append([R(cx), R(cy), R(s.get('dx')), R(s.get('dy')), round((sr + ang) % 360, 1), R(s.get('roundness') or 0), e.get('name')])
    for pd in p.findall('pad'):
        cx, cy = tf(float(pd.get('x')), float(pd.get('y')), ex, ey, mirror, ang)
        drill = float(pd.get('drill'))
        dia = float(pd.get('diameter') or drill * 1.6 + 0.5)
        out['pads'].append([R(cx), R(cy), R(drill), R(dia), pd.get('shape') or 'round', round(ang, 1), e.get('name')])
    for w in p.findall('wire'):
        if w.get('layer') != '21':
            continue
        x1, y1 = tf(float(w.get('x1')), float(w.get('y1')), ex, ey, mirror, ang)
        x2, y2 = tf(float(w.get('x2')), float(w.get('y2')), ex, ey, mirror, ang)
        out['silk'].append([R(x1), R(y1), R(x2), R(y2), R(w.get('width'))])
    for c in p.findall('circle'):
        if c.get('layer') != '21':
            continue
        cx, cy = tf(float(c.get('x')), float(c.get('y')), ex, ey, mirror, ang)
        out['silkCircles'].append([R(cx), R(cy), R(c.get('radius')), R(c.get('width'))])
    for h in p.findall('hole'):
        cx, cy = tf(float(h.get('x')), float(h.get('y')), ex, ey, mirror, ang)
        out['holes'].append([R(cx), R(cy), R(h.get('drill'))])

# full routes (top + bottom copper) of every signal that reaches the digital headers, keyed by pin label
HEADER_PIN = {('IOH', str(i + 1)): p for i, p in enumerate(['8', '9', '10', '11', '12', '13', 'GND', 'AREF', 'SDA', 'SCL'])}
HEADER_PIN.update({('IOL', str(i + 1)): str(i) for i in range(8)})
out['pinTraces'] = {}
for sig in board.findall('./signals/signal'):
    pins = [HEADER_PIN[(c.get('element'), c.get('pad'))] for c in sig.findall('contactref') if (c.get('element'), c.get('pad')) in HEADER_PIN]
    if not pins or 'GND' in pins:
        continue
    segs = [[R(w.get('x1')), R(w.get('y1')), R(w.get('x2')), R(w.get('y2')), R(w.get('width')), int(w.get('layer'))]
            for w in sig.findall('wire') if w.get('layer') in ('1', '16')]
    out['pinTraces'][pins[0]] = {'signal': sig.get('name'), 'segs': segs}
for sig in board.findall('./signals/signal'):
    for w in sig.findall('wire'):
        if w.get('layer') == '1':
            out['copper'].append([R(w.get('x1')), R(w.get('y1')), R(w.get('x2')), R(w.get('y2')), R(w.get('width'))])
    for v in sig.findall('via'):
        out['vias'].append([R(v.get('x')), R(v.get('y')), R(v.get('drill'))])

out['source'] = 'Arduino UNO Rev3 (UNO-TH_Rev3e) design files, Arduino, CC BY-SA 4.0'
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items() if isinstance(v, list)})
