# Convierte la pared del fondo de una imagen (de frente, sin muebles) en el sprite de pared de una estancia.
# Se recorta de junta a junta para que la tira se repita a lo ancho sin costura, y se reduce entera.
#
# Uso: py tools/textura_pared.py <imagen> <estancia> <x0> <x1> <y0> <y1>
#   x0, x1: dos juntas verticales (la tira va de x0 a x1, sin incluir x1)
#   y0, y1: arriba de la pared y abajo del rodapié
#   ej.: py tools/textura_pared.py assets/sources/suelos/bano-vacio.webp bano 184 925 75 385
#
# Sale con ALTO píxeles de alto y el juego la dibuja a media escala ("scale": 0.5), con el doble de detalle que los
# personajes: 96 píxeles = 96 unidades = 3 casillas, lo que mide la cara de los muros (FACE_H en config.js).
import json, sys
from PIL import Image

ALTO = 96
src, estancia = sys.argv[1], sys.argv[2]
x0, x1, y0, y1 = map(int, sys.argv[3:7])
ancho = round((x1 - x0) * ALTO / (y1 - y0) / 2) * 2  # par, para que encaje en la cuadrícula de píxeles
img = Image.open(src).convert('RGB').crop((x0, y0, x1, y1)).resize((ancho, ALTO), Image.LANCZOS)
img.save(f'assets/sprites/pared-{estancia}.png')
meta = {
    'cell': [ancho, ALTO], 'pivot': [0, 0], 'scale': 0.5,
    'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}},
}
with open(f'assets/sprites/pared-{estancia}.json', 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2)
print(f'pared-{estancia}: {ancho}x{ALTO}')
