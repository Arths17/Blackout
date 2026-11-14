"""Writes 4x and 6x nearest-neighbor previews of every sheet to /tmp/art_preview. Usage: python3 tools/preview_scale.py"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
out = Path('/tmp/art_preview'); out.mkdir(exist_ok=True)
for p in sorted((ROOT / 'public/assets').glob('*.png')):
    im = Image.open(p).convert('RGBA')
    for k in (4, 6):
        bg = Image.new('RGBA', (im.width * k, im.height * k), (42, 47, 56, 255))
        bg.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST))
        bg.save(out / f'{p.stem}_{k}x.png')
print('wrote', out)
