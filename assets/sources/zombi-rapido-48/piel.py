"""Piel del zombi niño: PixelLab la sacó gris pálida (no beige), así que tools/piel.py no la encuentra y
teñía el pelo rubio. Este cambia los grises cálidos poco saturados (la piel) a verde, sin tocar el pelo
(amarillo saturado), la ropa roja, la gorra azul ni las zapatillas (de la fila SUELO para abajo).

Uso:  py assets/sources/zombi-rapido-48/piel.py
"""
import colorsys
from PIL import Image

BASE = 'assets/sources/zombi-rapido-48'
DIRS = 'south south-east east north-east north north-west west south-west'.split()
SUELO = 41      # de aquí para abajo, zapatillas
VERDE = 88

def es_piel(r, g, b, y):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 25 <= h * 360 <= 75 and 0.06 <= s <= 0.36 and 0.3 <= v <= 0.86 and y < SUELO

for d in DIRS:
    im = Image.open(f'{BASE}/rotations-original/{d}.png').convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and es_piel(r, g, b, y):
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                nr, ng, nb = colorsys.hsv_to_rgb(VERDE / 360, max(s, 0.18) * 1.3, v * 0.92)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    im.save(f'{BASE}/rotations/{d}.png')
