# Convierte la pared del fondo de una imagen (de frente, sin muebles) en el sprite de pared de una estancia,
# y la moldura del techo que hay encima en su sprite de techo.
# Se recorta de junta a junta para que la tira se repita a lo ancho sin costura, y se reduce entera.
#
# Uso: py tools/textura_pared.py <imagen> <estancia> <x0> <x1> <y0> <y1> [<t0> <t1>]
#   x0, x1: dos juntas verticales (la tira va de x0 a x1, sin incluir x1)
#   y0, y1: arriba de la pared y abajo del rodapié
#   t0, t1: arriba y abajo de la moldura del techo (opcional)
#   ej.: py tools/textura_pared.py assets/sources/suelos/bano-vacio.webp bano 184 925 76 385 43 76
#
# La pared sale con ALTO píxeles de alto: 48 píxeles = 96 unidades = 3 casillas, lo que mide la cara de los muros
# (FACE_H en config.js), con la misma densidad que los personajes ("scale": 1; antes iba al cuádruple de detalle y
# suavizada, se cambió el 19 oct para que todo el juego vaya a una sola densidad).
# El techo sale de ALTO_TECHO píxeles (12 unidades: la tapa del muro, ver CAP en render.js).
import json, sys
from PIL import Image

ALTO, ALTO_TECHO = 48, 6
src, estancia = sys.argv[1], sys.argv[2]
x0, x1, y0, y1 = map(int, sys.argv[3:7])
img = Image.open(src).convert('RGB')
ancho = round((x1 - x0) * ALTO / (y1 - y0))


def guardar(nombre, im):
    im.save(f'assets/sprites/{nombre}.png')
    meta = {
        'cell': list(im.size), 'pivot': [0, 0], 'scale': 1,
        'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}},
    }
    with open(f'assets/sprites/{nombre}.json', 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    print(f'{nombre}: {im.size[0]}x{im.size[1]}')


guardar(f'pared-{estancia}', img.crop((x0, y0, x1, y1)).resize((ancho, ALTO), Image.BOX))
if len(sys.argv) > 8:
    t0, t1 = int(sys.argv[7]), int(sys.argv[8])
    guardar(f'techo-{estancia}', img.crop((x0, t0, x1, t1)).resize((ancho, ALTO_TECHO), Image.BOX))
