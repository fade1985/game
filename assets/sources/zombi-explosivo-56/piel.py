"""Piel del zombi explosivo: PixelLab la sacó gris pálida (no beige), y la gabardina es también gris cálido,
así que tools/piel.py no sirve. Este cambia a verde solo los grises cálidos CLAROS (la cara y las manos);
la gabardina, más oscura, se queda como está. Los zapatos (de la fila SUELO para abajo) no se tocan.

De espaldas no se toca el bajo de la gabardina (es gris claro como la piel).

Uso:  py assets/sources/zombi-explosivo-56/piel.py
"""
import colorsys
from PIL import Image

BASE = 'assets/sources/zombi-explosivo-56'
DIRS = 'south south-east east north-east north north-west west south-west'.split()
SUELO = 47      # de aquí para abajo, zapatos
VERDE = 88
CLARO = 0.52    # por debajo de esta luz es gabardina, no piel

def es_piel(r, g, b, y, x=0, d=''):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    # de espaldas el bajo de la gabardina es gris claro: ahí solo cuentan las manos, a los lados
    if d == 'north' and y >= 24 and 16 <= x <= 39:
        return False
    return 25 <= h * 360 <= 75 and 0.04 <= s <= 0.4 and v >= CLARO and y < SUELO

for d in DIRS:
    im = Image.open(f'{BASE}/rotations-original/{d}.png').convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and es_piel(r, g, b, y, x, d):
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                nr, ng, nb = colorsys.hsv_to_rgb(VERDE / 360, max(s, 0.18) * 1.3, v * 0.88)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    im.save(f'{BASE}/rotations/{d}.png')
