# Writes the 64 px game copy of the team's tree monster sheet (256 px frames in assets/src/).
# The game always drew it at a quarter size with nearest sampling, which reads the pixel at
# (4i + 2, 4j + 2) of each block. Taking exactly those pixels gives the same picture from a
# file sixteen times smaller. Run: python3 tools/shrink_monster.py
from PIL import Image

src = Image.open('assets/src/tree-root-monster.png').convert('RGBA')
w, h = src.size
out = Image.new('RGBA', (w // 4, h // 4))
out.putdata([src.getpixel((x * 4 + 2, y * 4 + 2)) for y in range(h // 4) for x in range(w // 4)])
out.save('public/tree-root-monster.png', optimize=True)
print(out.size)
