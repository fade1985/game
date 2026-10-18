"""Colores del zombi de tentáculos. PixelLab lo sacó con la piel beige y muy colorido; el dueño lo quiere oscuro
y apagado, como el explosivo de la gabardina (18 oct). Este parte de las vistas originales y:
- pasa la piel a verde podrido (el mismo tono que la del explosivo),
- deja la camisa y el pantalón casi grises, de un azul muy apagado,
- oscurece los tentáculos y la carne a un morado/granate sucio,
- y le quita algo de color a todo lo demás.

Uso:  py assets/sources/zombi-tentaculos-56/piel.py
"""
import colorsys
import os
import shutil
from PIL import Image

BASE = 'assets/sources/zombi-tentaculos-56'
DIRS = 'south south-east east north-east north north-west west south-west'.split()

def recolor(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    g_ = h * 360
    if 28 <= g_ <= 65 and 0.08 <= s <= 0.6 and v >= 0.35:      # piel
        h, s, v = 88 / 360, min(0.4, max(s, 0.18) * 0.9), v * 0.75
    elif 190 <= g_ <= 270:                                        # camisa y pantalón azules
        s, v = s * 0.3, v * 0.8
    elif g_ >= 270 or g_ < 28:                                    # tentáculos, carne y sangre
        h = (g_ if g_ >= 270 else g_ + 360)
        h = ((h + 330) / 2 % 360) / 360                          # hacia un morado granate
        s, v = s * 0.55, v * 0.72
    else:
        s, v = s * 0.5, v * 0.85
    nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
    return round(nr * 255), round(ng * 255), round(nb * 255)

if not os.path.isdir(f'{BASE}/rotations-original'):
    shutil.copytree(f'{BASE}/rotations', f'{BASE}/rotations-original')

for d in DIRS:
    im = Image.open(f'{BASE}/rotations-original/{d}.png').convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (*recolor(r, g, b), a)
    im.save(f'{BASE}/rotations/{d}.png')
