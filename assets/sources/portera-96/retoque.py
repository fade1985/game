"""Retoques gratis de la portera sobre las 8 vistas que sacó PixelLab (lo pidió el dueño el 15 de octubre de 2026).

Uso:  py assets/sources/portera-96/retoque.py

Lee rotations-original/ (la primera vez copia ahí rotations/) y deja el resultado en rotations/:
  · piel gris de muerta (PixelLab la saca color carne);
  · delantal crema en vez de tostado;
  · crocs beige manchadas de sangre (ha pisado cadáveres);
  · sangre en las manos y en la boca;
  · la cabeza de la fregona más clara y con sangre en los pelos.
Cada parte se reconoce por su color y, donde se confunden (la fregona y los zapatos son del mismo marrón que la
piel), por su sitio: la caja de la fregona de cada vista está en FREGONA.
"""
import colorsys, os, random, shutil
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
DIRS = 'south south-east east north-east north north-west west south-west'.split()
# Caja de la cabeza de la fregona en cada vista (x0, y0, x1, y1), por debajo de la abrazadera de metal
FREGONA = {
    'south': (0, 93, 32, 124), 'south-east': (30, 97, 63, 127), 'east': (74, 96, 101, 127),
    'north-east': (94, 89, 127, 123), 'north': (96, 89, 127, 123), 'north-west': (84, 78, 105, 117),
    'west': (19, 78, 47, 112), 'south-west': (0, 84, 31, 121),
}
# Caja de los lazos del delantal en las vistas de espaldas (son pocos píxeles y no se reconocen solos)
LAZOS = {'north': (44, 50, 76, 68), 'north-east': (38, 50, 58, 68), 'north-west': (58, 50, 82, 68)}
# Cajas de las dos manos en cada vista (x0, y0, x1, y1)
MANOS = {
    'south': [(22, 58, 36, 75), (84, 62, 100, 80)], 'south-east': [(38, 64, 52, 80), (81, 56, 95, 76)],
    'east': [(56, 60, 72, 80)], 'north-east': [(26, 56, 37, 72), (82, 62, 97, 78)],
    'north': [(22, 60, 37, 80), (88, 56, 103, 74)], 'north-west': [(28, 60, 43, 80), (82, 50, 93, 66)],
    'west': [(47, 64, 63, 85)], 'south-west': [(26, 58, 41, 72), (70, 58, 87, 80)],
}
# Caja de la cara en las vistas en las que se le ve la boca
CARA = {'south': (52, 16, 74, 40), 'south-east': (58, 18, 75, 42), 'east': (72, 18, 81, 38),
        'west': (43, 18, 53, 38), 'south-west': (46, 18, 61, 42)}
SANGRE = [(85, 20, 20), (113, 17, 20), (133, 20, 23), (158, 40, 36)]  # de oscura a viva

def hsv(c):
    h, s, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
    return h * 360, s, v

def rgb(h, s, v):
    return tuple(round(x * 255) for x in colorsys.hsv_to_rgb(h / 360, max(0, min(1, s)), max(0, min(1, v))))

def sangre(c):
    v = hsv(c)[2]
    return SANGRE[0] if v < 0.35 else SANGRE[1] if v < 0.55 else SANGRE[2] if v < 0.75 else SANGRE[3]

def es_rojo(c):
    h, s, v = hsv(c)
    return s > 0.6 and (h > 340 or h < 10)

def es_vaquero(c):
    h, s, v = hsv(c)
    return 195 < h < 235 and s > 0.15

def es_marron(c):   # piel, delantal, zapatos y fregona: todos tiran a marrón
    h, s, v = hsv(c)
    return 5 <= h <= 40 and 0.25 <= s <= 0.62 and v >= 0.28

def retoca(d, im):
    px = im.load()
    W, H = im.size
    rnd = random.Random(d)
    op = lambda x, y: px[x, y][3] > 0
    fx0, fy0, fx1, fy1 = FREGONA[d]
    en_fregona = lambda x, y: fx0 <= x <= fx1 and fy0 <= y <= fy1
    nuevo = {}

    # Zapatos: lo que hay debajo del vaquero en cada columna
    zapato = set()
    for x in range(W):
        azul = [y for y in range(H) if op(x, y) and es_vaquero(px[x, y])]
        if not azul:
            continue
        for y in range(max(azul) + 1, H):
            if op(x, y) and y > 90 and not en_fregona(x, y) and hsv(px[x, y])[2] > 0.22:
                zapato.add((x, y))

    # Delantal: en cada fila, de punta a punta de los píxeles tostados claros (por delante y los lazos de atrás)
    delantal = set()
    for y in range(40, 105):
        tostado = [x for x in range(W) if op(x, y) and (x, y) not in zapato and not en_fregona(x, y)
                   and 27 < hsv(px[x, y])[0] <= 36 and hsv(px[x, y])[1] >= 0.3 and hsv(px[x, y])[2] >= 0.55]
        # se agrupan los que van seguidos (huecos de hasta 3) y se descartan los grupos sueltos: son brillos del brazo
        grupos = []
        for x in tostado:
            if grupos and x - grupos[-1][-1] <= 4:
                grupos[-1].append(x)
            else:
                grupos.append([x])
        for g in grupos:
            if len(g) < 4:
                continue
            for x in range(g[0], g[-1] + 1):
                if op(x, y) and es_marron(px[x, y]) and hsv(px[x, y])[2] >= 0.4:
                    delantal.add((x, y))

    if d in LAZOS:
        x0, y0, x1, y1 = LAZOS[d]
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if op(x, y) and es_marron(px[x, y]) and hsv(px[x, y])[2] >= 0.4:
                    delantal.add((x, y))

    # Piel: el resto de marrones, salvo el palo de la fregona (más saturado)
    piel = set()
    for y in range(H):
        for x in range(W):
            if op(x, y) and (x, y) not in zapato and (x, y) not in delantal and not en_fregona(x, y):
                h, s, v = hsv(px[x, y])
                # (las sombras de la piel son más rojizas y saturadas que el palo de la fregona)
                if (8 <= h <= 30 and 0.25 <= s <= 0.6 and v >= 0.3) or (4 <= h <= 16 and s <= 0.75 and v >= 0.25):
                    piel.add((x, y))

    for (x, y) in piel:          # gris de muerta, con el mismo sombreado
        h, s, v = hsv(px[x, y])
        nuevo[x, y] = rgb(70, s * 0.2, v * 0.8)
    for (x, y) in delantal:      # crema
        h, s, v = hsv(px[x, y])
        nuevo[x, y] = rgb(40, s * 0.45, v * 1.08 + 0.04)
    for (x, y) in zapato:        # crocs beige, con sangre sobre todo abajo
        h, s, v = hsv(px[x, y])
        c = rgb(36, 0.2, v * 1.12 + 0.05)
        abajo = sum(1 for k in range(1, 4) if op(x, y + k))   # cuanto más cerca de la suela, más sangre
        nuevo[x, y] = sangre(c) if rnd.random() < 0.45 + 0.15 * (3 - abajo) else c

    # Manos: la piel de dentro de su caja (por el color no se separan del palo de la fregona, que es igual)
    for x0, y0, x1, y1 in MANOS[d]:
        for (x, y) in piel:
            if x0 <= x <= x1 and y0 <= y <= y1 and rnd.random() < 0.55 + 0.35 * (y - y0) / (y1 - y0):
                nuevo[x, y] = sangre(nuevo[x, y])

    # Boca: lo oscuro de la mitad baja de la cara, y unos chorretones por la barbilla
    if d in CARA:
        x0, y0, x1, y1 = CARA[d]
        cara = [q for q in piel if x0 <= q[0] <= x1 and y0 <= q[1] <= y1]
        if cara:
            xs = [q[0] for q in cara]; ys = [q[1] for q in cara]
            cx0, cx1, cy0, cy1 = min(xs), max(xs), min(ys), max(ys)
            mid = (cy0 + cy1) / 2
            boca = [(x, y) for x in range(cx0, cx1 + 1) for y in range(int(mid), cy1 + 1)
                    if op(x, y) and hsv(px[x, y])[2] < 0.3 and ((x - 1, y) in piel or (x + 1, y) in piel)]
            for (x, y) in boca:
                if rnd.random() < 0.5:
                    nuevo[x, y] = SANGRE[1]
                if (x, y + 1) not in boca:
                    for k in range(1, 1 + rnd.choice((1, 2, 2, 3, 4))):   # chorretón hacia la barbilla
                        if (x, y + k) in piel:
                            nuevo[x, y + k] = sangre(nuevo[x, y + k])

    # Fregona: pelos más claros (algodón sucio) y con sangre, más cuanto más cerca de las puntas
    tiras = {x: rnd.random() < 0.6 for x in range(fx0, fx1 + 1)}
    for y in range(fy0, fy1 + 1):
        for x in range(fx0, fx1 + 1):
            if not op(x, y):
                continue
            c = px[x, y]
            h, s, v = hsv(c)
            if es_vaquero(c) or es_rojo(c) or v < 0.12 or (s < 0.15 and v > 0.5):
                continue                       # vaquero, contorno, sangre que ya había o el metal
            if (x, y) in zapato:
                continue
            claro = rgb(38, 0.14, 0.42 + v * 0.75)
            punta = (y - fy0) / max(1, fy1 - fy0)
            if tiras[x] and rnd.random() < 0.35 + 0.65 * punta:
                claro = sangre(claro)
            elif rnd.random() < 0.15 + 0.3 * punta:
                claro = sangre(claro)
            nuevo[x, y] = claro

    for (x, y), c in nuevo.items():
        px[x, y] = c + (px[x, y][3],)
    return im

def main():
    orig, dest = f'{BASE}/rotations-original', f'{BASE}/rotations'
    if not os.path.isdir(orig):
        shutil.copytree(dest, orig)
    for d in DIRS:
        im = retoca(d, Image.open(f'{orig}/{d}.png').convert('RGBA'))
        im.save(f'{dest}/{d}.png')
    print('Retocadas las 8 vistas de la portera')

if __name__ == '__main__':
    main()
