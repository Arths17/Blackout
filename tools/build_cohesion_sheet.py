"""One contact sheet of every sheet at 3x, to check they look like one game. Usage: python3 tools/build_cohesion_sheet.py"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sheets = [Image.open(p).convert('RGBA') for p in sorted((ROOT / 'public/assets').glob('*.png'))]
k, pad = 3, 8
w = max(s.width for s in sheets) * k + pad * 2
h = sum(s.height * k + pad for s in sheets) + pad
out = Image.new('RGBA', (w, h), (30, 34, 42, 255))
y = pad
for s in sheets:
    out.alpha_composite(s.resize((s.width * k, s.height * k), Image.NEAREST), (pad, y))
    y += s.height * k + pad
out.save('/tmp/art_preview/cohesion.png')
print('wrote /tmp/art_preview/cohesion.png')
