"""Fails on off-palette colors, partial alpha, or sheets that are not a whole number of cells.
Warns when a single cell uses more than 8 colors. Usage: python3 tools/check_palette.py [dir]"""
import json, re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
pal = {k: v.lstrip('#').lower() for k, v in json.load(open(ROOT / 'tools/palette.json')).items() if not k.startswith('_')}
allowed = {tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) for v in pal.values()}
atlas = json.load(open(ROOT / 'public/assets/atlas.json'))

bad = 0
for name, meta in {**atlas['sheets'], 'stencil': {'frame': [6, 8]}}.items():
    path = ROOT / 'public/assets' / f'{name}.png'
    im = Image.open(path).convert('RGBA')
    cw, ch = meta['frame']
    if im.width % cw or im.height % ch:
        print(f'FAIL {name}: size {im.size} is not a whole number of {cw}x{ch} cells'); bad += 1
    off, partial = set(), 0
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a not in (0, 255): partial += 1
            elif a == 255 and (r, g, b) not in allowed: off.add((r, g, b))
    if off or partial:
        print(f'FAIL {name}: {len(off)} off-palette colors {sorted(off)[:4]}, {partial} partial-alpha pixels'); bad += 1
    worst = 0
    for cy in range(im.height // ch):
        for cx in range(im.width // cw):
            cell = im.crop((cx * cw, cy * ch, (cx + 1) * cw, (cy + 1) * ch)).getcolors(maxcolors=4096) or []
            n = len({c[:3] for _, c in cell if c[3] == 255})
            worst = max(worst, n)
    note = '' if worst <= 8 or meta.get('relaxed') else '  (warn: >8 colors in a cell)'
    print(f'ok   {name}: max {worst} colors per cell{note}')

cfg = (ROOT / 'src/config.ts').read_text().lower()
block = re.search(r'export const palette = \{([\s\S]*?)\};', cfg)[1]
master = dict(re.findall(r'(\w+): 0x([0-9a-f]{6})', block))
missing = [k for k in set(pal) | set(master) if pal.get(k) != master.get(k)]
if missing:
    print('FAIL src/config.ts is missing palette entries:', ', '.join(missing)); bad += 1
sys.exit(1 if bad else 0)
