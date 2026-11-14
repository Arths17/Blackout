from pathlib import Path
from PIL import Image
import hashlib
import json
import re

root = Path(__file__).resolve().parent.parent
source = root / "sid's work/public/hero"
config = (root / 'src/config.ts').read_text()
block = re.search(r'export const PALETTE = \{([\s\S]*?)\};', config)[1]
colors = [(name, tuple(bytes.fromhex(value))) for name, value in re.findall(r'(\w+): 0x([0-9a-f]{6})', block)]
# Retain the white costume using the cold neutral ramp, without introducing new hues.
ramp = ['ink', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'bone', 'c1', 'w']
choices = [(next(i for i, (name, _) in enumerate(colors) if name == key) + 1,
            next(rgb for name, rgb in colors if name == key)) for key in ramp]
letters = '0123456789abcdefghijklmnopqrstuvwxyz'
frames = []
animations = {}
for name, fps in [(f'{action}_{direction}', 8 if action == 'walk' else 5)
                  for direction in ['down', 'up', 'left', 'right'] for action in ['idle', 'walk']] + [
                  ('interact', 6), ('hurt', 5), ('fall', 7), ('victory', 6)]:
    path = source / f'{name}.png'
    image = Image.open(path).convert('RGBA')
    assert image.height == 48 and image.width % 32 == 0, path
    count = image.width // 32
    animations[name] = {'frames': list(range(len(frames), len(frames) + count)), 'fps': fps,
                        'source': str(path.relative_to(root)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    for frame in range(count):
        cell = image.crop((frame * 32, 0, (frame + 1) * 32, 48)).resize((16, 24), Image.Resampling.NEAREST)
        rows = []
        for y in range(24):
            row = ''
            for x in range(16):
                r, g, b, a = cell.getpixel((x, y))
                index = 0 if a < 128 else min(choices, key=lambda c: sum((v - q) ** 2 for v, q in zip((r, g, b), c[1])))[0]
                row += letters[index]
            rows.append(row)
        frames.append(rows)
result = {'frame': [16, 24], 'palette': ['transparent'] + [name for name, _ in colors],
          'animations': animations, 'frames': frames}
(root / 'assets/src/hero.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
print(f'Imported {len(frames)} hero frames as 16x24 palette-indexed grids')
