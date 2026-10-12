"""Cambia el color de la piel de un personaje en sus 8 vistas, sin tocar nada más.

Uso:  py tools/piel.py <sprite>            (por ejemplo: py tools/piel.py zombi-normal-48)

Lee las vistas tal como salieron de PixelLab en assets/sources/<sprite>/rotations-original/ (la primera vez
las copia ahí desde rotations/) y deja las corregidas en rotations/. Solo cambia los píxeles de tono carne
(tono entre TONO[0] y TONO[1], claros) que estén por encima de los zapatos: les pone un tono gris verdoso
y conserva lo claro u oscuro que era cada uno, así el sombreado queda igual.
"""
import colorsys, os, shutil, sys
from PIL import Image

DIRS = 'south south-east east north-east north north-west west south-west'.split()
TONO = (26, 42)      # tonos carne, en grados
CLARO = 0.55         # por debajo de esta luz es pelo o zapato, no piel
SUELO = 36           # de esta fila para abajo son los zapatos
VERDE = 88           # tono nuevo (verde amarillento)
SAT = 0.85           # cuánta saturación se conserva (menos = más gris)
LUZ = 0.93           # un poco más apagado que la piel viva

def es_piel(r, g, b, y):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return TONO[0] <= h * 360 <= TONO[1] and v >= CLARO and y <= SUELO

def verde(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return tuple(round(c * 255) for c in colorsys.hsv_to_rgb(VERDE / 360, s * SAT, v * LUZ))

def main(sprite):
    base = f'assets/sources/{sprite}'
    orig, dest = f'{base}/rotations-original', f'{base}/rotations'
    if not os.path.isdir(orig):
        shutil.copytree(dest, orig)
    total = 0
    for d in DIRS:
        im = Image.open(f'{orig}/{d}.png').convert('RGBA')
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a and es_piel(r, g, b, y):
                    px[x, y] = verde(r, g, b) + (a,)
                    total += 1
        im.save(f'{dest}/{d}.png')
    print(f'{sprite}: {total} píxeles de piel cambiados en {len(DIRS)} vistas')

if __name__ == '__main__':
    main(sys.argv[1])
