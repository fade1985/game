"""Muebles en "tres cuartos" (se les ve el frente y tienen altura): montaje de los sprites.

El juego dibuja cada mueble apoyado en su pared: de frente en la pared de arriba y, los que tienen dibujo
`<tipo>-lado`, de lado en las laterales (hecho para la izquierda; en la derecha se pone en espejo).

Los dibujos, tal cual los da PixelLab, están en assets/sources/muebles3c/<tipo>.png y <tipo>-lado.png
(los textos y los ids, en assets/pixellab.json → "muebles-3c"). Se piden con create_image_pixflux, 1 generación:
  - sin guía y sin fondo, con un lienzo de (largo) × (fondo + alto): es como mejor salen;
  - si sale girado en diagonal (nevera, váter, lavabo), con la guía de `py tools/muebles3c.py guias` como
    imagen de partida (fuerza 50–60) y con fondo: un bloque del tamaño del mueble sobre azul.

  py tools/muebles3c.py monta [ids]   quita el fondo, recorta y deja los sprites en assets/sprites/
  py tools/muebles3c.py guias         pinta las guías en assets/sources/muebles3c/guias/

`monta` dice el ancho de cada dibujo: el largo de cada mueble en PIECES (src/furniture.js) es ese ancho × 2,
para que se choque justo con lo que se ve.
"""
import json, os, sys
from PIL import Image, ImageDraw

SRC = 'assets/sources/muebles3c'
OUT = 'assets/sprites'
FONDO = (96, 112, 150)
TOL = 46
M = 3  # margen de fondo alrededor de la guía

# tipo: largo, fondo, alto, color, frente (texto), lado (texto; None = no va en paredes laterales; '=' = el mismo dibujo)
T = {
 'sofa':      (76, 32, 14, (200, 60, 60),   'red three-seat fabric sofa, front view, backrest at the back, three seat cushions, two armrests',
                                           'red three-seat fabric sofa seen from above standing vertically along the left wall, backrest on the left side, seat cushions facing right, armrests at the top and bottom ends'),
 'tv':        (60, 20, 26, (120, 80, 55),   'flat screen television standing on a low wooden TV cabinet, front view, screen facing the viewer',
                                           'flat screen television on a low wooden TV cabinet seen from its side, thin screen profile, screen facing right'),
 'armchair':  (32, 30, 14, (60, 90, 190),   'cozy blue fabric armchair, front view, backrest at the back, two armrests',
                                           'cozy blue fabric armchair seen from the side, backrest on the left, seat facing right'),
 'bookshelf': (60, 17, 40, (150, 95, 60),   'tall wooden bookshelf full of colorful books, front view, straight on',
                                           'tall wooden bookshelf seen from its narrow side, plain wooden side panel, books barely visible on the right edge'),
 'lamp':      (20, 19, 26, None,            'tall floor lamp with a warm yellow lampshade, thin metal pole and round base', '='),
 'counter':   (80, 25, 18, (225, 225, 230), 'white kitchen counter with cabinet doors on the front, steel sink with faucet and a wooden cutting board on the worktop, front view, straight on',
                                           'white kitchen counter standing vertically along the left wall, seen from above and from its right side, steel sink and cutting board on the worktop, cabinet doors facing right'),
 'fridge':    (31, 29, 36, (235, 238, 242), 'tall white refrigerator with freezer door on top, front view, straight on, handles on the right',
                                           'tall white refrigerator seen from its plain side panel, doors facing right'),
 'stove':     (35, 26, 18, (70, 70, 80),    'kitchen stove with oven door on the front, black cooktop with four burners on top, front view, straight on',
                                           'kitchen stove seen from above and from its right side, black cooktop with four burners on top, oven door facing right'),
 'bed':       (50, 70, 10, (120, 160, 230), 'single bed, wooden headboard at the top, white pillow, blue quilt, foot of the bed towards the viewer',
                                           'single bed lying horizontally, wooden headboard on the left end, white pillow on the left, blue quilt, seen from above and from the front side'),
 'wardrobe':  (65, 22, 44, (125, 80, 50),   'tall wooden wardrobe with two doors and brass knobs, front view, straight on',
                                           'tall wooden wardrobe seen from its narrow side, plain wooden side panel, doors facing right'),
 'nightstand':(21, 20, 24, (125, 80, 50),   'small wooden nightstand with one drawer and a small bedside lamp with yellow shade on top, front view, straight on', '='),
 'desk':      (55, 25, 14, (190, 135, 85),  'wooden office desk with drawers on the front, open laptop and a coffee mug on top, front view, straight on',
                                           'wooden office desk standing vertically along the left wall, seen from above and from its right side, open laptop and a coffee mug on top'),
 'shoerack':  (50, 17, 12, (165, 115, 75),  'low wooden shoe rack with pairs of colorful shoes on its shelves, front view, straight on',
                                           'low wooden shoe rack standing vertically along the left wall, seen from above and from its right side, colorful shoes on top'),
 'coatstand': (20, 19, 28, None,            'wooden coat stand with a red coat, a blue jacket and a yellow hat hanging on it', '='),
 'console':   (55, 17, 16, (190, 135, 85),  'narrow wooden hallway console table with a light blue vase with flowers and a bowl with keys on top, front view, straight on',
                                           'narrow wooden hallway console table standing vertically along the left wall, seen from above and from its right side, a vase and a bowl on top'),
 'bathtub':   (75, 36, 8,  (240, 242, 245), 'white porcelain bathtub lying horizontally, full of light blue water with foam, chrome tap on the left end, a yellow rubber duck',
                                           'white porcelain bathtub placed vertically lengthwise, full of light blue water with foam, chrome tap at the top end, a yellow rubber duck'),
 'toilet':    (23, 29, 14, (240, 242, 245), 'white porcelain toilet, front view, straight on, water tank at the back, bowl and seat towards the viewer',
                                           'white porcelain toilet seen from the side, water tank on the left, bowl facing right'),
 'sink':      (35, 23, 24, (225, 225, 230), 'bathroom vanity cabinet with a white washbasin and chrome tap, a small mirror on the wall above it, front view, straight on',
                                           'bathroom vanity cabinet with a white washbasin seen from above and from its right side, cabinet doors facing right'),
 'washer':    (30, 29, 18, (235, 238, 242), 'white front-loading washing machine with a round glass door, front view, straight on',
                                           'white washing machine seen from its plain side panel, round door facing right'),
 'plant':     (22, 22, 24, None,            'potted house plant with big green leaves in a terracotta pot', '='),
}
COLA = ', 3/4 top-down RPG perspective like a classic 16-bit JRPG, pixel art game furniture sprite, plain blue background'


def piezas():
    """(id, tipo, vista, ancho, fondo en pantalla, alto, texto)"""
    for k, (largo, fondo, alto, color, frente, lado) in T.items():
        yield (k, k, 'frente', largo, fondo, alto, frente)
        if lado and lado != '=':
            yield (f'{k}-lado', k, 'lado', fondo, largo, alto, lado)


def sombra(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def guias():
    os.makedirs(f'{SRC}/guias', exist_ok=True)
    pedidos = []
    for pid, k, vista, w, d, alto, texto in piezas():
        color = T[k][3]
        W, H = w + 2 * M, d + alto + 2 * M
        while W * H < 1024: W += 2; H += 2
        W += W % 2; H += H % 2
        im = Image.new('RGB', (W, H), FONDO)
        if color:
            dr = ImageDraw.Draw(im)
            x0, y1 = (W - w) // 2, H - M          # el bloque va centrado y apoyado abajo
            y0 = y1 - d - alto
            dr.rectangle((x0, y0, x0 + w - 1, y0 + d - 1), fill=sombra(color, 1.08), outline=(30, 26, 44))   # tapa
            dr.rectangle((x0, y0 + d - 1, x0 + w - 1, y1 - 1), fill=sombra(color, 0.72), outline=(30, 26, 44))  # frente
            # el respaldo: una franja más oscura por el lado de la pared
            if vista == 'frente': dr.rectangle((x0 + 1, y0 + 1, x0 + w - 2, y0 + max(2, d // 5)), fill=sombra(color, 0.88))
            else: dr.rectangle((x0 + 1, y0 + 1, x0 + max(2, w // 5), y0 + d - 2), fill=sombra(color, 0.88))
        im.save(f'{SRC}/guias/{pid}.png')
        pedidos.append({'id': pid, 'width': W, 'height': H, 'guia': bool(color), 'description': texto + COLA})
    with open(f'{SRC}/pedidos.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(pedidos, f, indent=2); f.write('\n')
    print(len(pedidos), 'guías y pedidos')


def recorta(im):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    cerca = lambda a, b: sum(abs(a[i] - b[i]) for i in range(3)) <= TOL
    fondo = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1], FONDO]
    cola = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    visto = set()
    while cola:
        x, y = cola.pop()
        if (x, y) in visto or not (0 <= x < w and 0 <= y < h): continue
        visto.add((x, y))
        if px[x, y][3] and not any(cerca(px[x, y], f) for f in fondo): continue
        px[x, y] = (0, 0, 0, 0)
        cola += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im


def monta(solo):
    hechos = []
    for pid, k, vista, w, d, alto, texto in piezas():
        if solo and pid not in solo: continue
        ruta = f'{SRC}/{pid}.png'
        if not os.path.exists(ruta): print('  falta', pid); continue
        im = recorta(Image.open(ruta))
        # fuera las motas sueltas de fondo: solo cuentan las columnas y filas con algo de dibujo
        a = im.getchannel('A').point(lambda v: 255 if v else 0)
        cols = [x for x in range(im.width) if a.crop((x, 0, x + 1, im.height)).histogram()[255] >= 4]
        rows = [y for y in range(im.height) if a.crop((0, y, im.width, y + 1)).histogram()[255] >= 4]
        if not cols or not rows: print('  vacío', pid); continue
        im = im.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1))
        aviso = '' if abs(im.width - w) <= 6 else f'   ← ancho {im.width}, debería rondar {w}'
        im.save(f'{OUT}/mueble-{pid}.png')
        hoja = {'cell': [im.width, im.height], 'pivot': [im.width // 2, im.height],
                'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}}}
        with open(f'{OUT}/mueble-{pid}.json', 'w', encoding='utf-8', newline='\n') as f:
            json.dump(hoja, f, indent=2); f.write('\n')
        hechos.append(f'mueble-{pid}')
        print(f'  {pid}: {im.width}×{im.height}{aviso}')
    ruta = f'{OUT}/manifest.json'
    lista = sorted(set(json.load(open(ruta, encoding='utf-8'))) | set(hechos))
    with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lista, f, indent=2); f.write('\n')
    print(len(hechos), 'sprites montados')


if sys.argv[1:2] == ['guias']: guias()
elif sys.argv[1:2] == ['monta']: monta(sys.argv[2:])
else: print(__doc__)
