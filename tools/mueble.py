"""Monta los sprites de los muebles a partir de los dibujos de PixelLab.

Cada mueble sale de assets/sources/muebles/<tipo>.png, tal cual lo dio PixelLab, y acaba en
assets/sprites/mueble-<tipo>.png + .json, apuntado en assets/sprites/manifest.json.

- El dibujo está hecho "de espaldas a la pared de arriba", visto desde arriba, para que el juego lo pueda
  girar a cualquier pared. Mide lo mismo que la guía con la que se pidió (assets/sources/muebles/guias/),
  que es el dibujo a mano de siempre a mitad de tamaño: así el sprite ocupa justo lo que ocupa el mueble.
- Los que se pidieron con fondo (PixelLab, al quitar el fondo, se comía los tableros lisos) se recortan aquí:
  se borra todo lo que se parezca al color de las esquinas y esté unido al borde.

Uso (desde la carpeta del proyecto):
  py tools/mueble.py              todos
  py tools/mueble.py desk tv      solo esos
"""
import json, os, sys
from PIL import Image

SRC = 'assets/sources/muebles'
OUT = 'assets/sprites'
TOL = 46  # cuánto puede alejarse un píxel del color del fondo para contar como fondo


def recorta(im):
    """Quita el fondo liso de una imagen sin transparencia, entrando desde los bordes."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    cerca = lambda a, b: sum(abs(a[i] - b[i]) for i in range(3)) <= TOL
    fondo = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    es_fondo = lambda c: any(cerca(c, f) for f in fondo)
    cola = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    visto = set()
    while cola:
        x, y = cola.pop()
        if (x, y) in visto or not (0 <= x < w and 0 <= y < h):
            continue
        visto.add((x, y))
        if not es_fondo(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        cola += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im


def monta(tipo):
    im = Image.open(f'{SRC}/{tipo}.png')
    opaca = im.mode != 'RGBA' or im.convert('RGBA').getextrema()[3][0] == 255
    im = recorta(im) if opaca else im.convert('RGBA')
    w, h = im.size
    im.save(f'{OUT}/mueble-{tipo}.png')
    hoja = {'cell': [w, h], 'pivot': [w // 2, h // 2],
            'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}}}
    with open(f'{OUT}/mueble-{tipo}.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(hoja, f, indent=2)
        f.write('\n')
    return f'mueble-{tipo}'


tipos = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png'))
hechos = [monta(t) for t in tipos]
ruta = f'{OUT}/manifest.json'
lista = sorted(set(json.load(open(ruta, encoding='utf-8'))) | set(hechos))
with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(lista, f, indent=2)
    f.write('\n')
print(len(hechos), 'muebles montados:', ' '.join(tipos))
