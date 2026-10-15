"""Monta la hoja de sprites de un jefe a partir de lo que da PixelLab (como tools/zombi.py, pero con las
animaciones que diga su jefe.json, no las fijas de los zombis).

Lo saca todo de assets/sources/<fuente>/:
  rotations/<dirección>.png        las 8 posturas quietas
  <carpeta>/<dirección>-<n>.png    cada animación (el fotograma 0 es el dibujo quieto: así se sabe dónde va)
  jefe.json                        casilla, origen, pies, cintura y la lista de animaciones:
      "animaciones": { "<nombre en la hoja>": { "carpeta": "...", "fotogramas": [desde, hasta],
                                                "duracion": s, "repite": bool, "solo": "south", "impacto": n } }
      ("solo": la animación solo existe en esa dirección; "impacto": en qué fotograma de los elegidos llega el golpe)

Y escribe assets/sprites/<sprite>.png y .json con "still", "idle" (hecho a mano: el tronco baja un píxel) y las de
jefe.json. Todos los fotogramas se pintan solo con los colores de las 8 posturas quietas (la sangre que PixelLab
pinta de un rojo chillón pasa al rojo de la jefa) y se quitan las motas sueltas.

Uso (desde la carpeta del proyecto):  py tools/jefe.py portera-96 jefe-portera
"""
import json, sys
from PIL import Image, ImageChops
from png import guardar_png

SOURCE, SPRITE = sys.argv[1], sys.argv[2]
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
SRC = f'assets/sources/{SOURCE}'
cfg = json.load(open(f'{SRC}/jefe.json', encoding='utf-8'))
CW, CH = cfg['casilla']
OX, OY = cfg['origen']
PY = cfg['pies']
WAIST = cfg['cintura']

rot = {d: Image.open(f'{SRC}/rotations/{d}.png').convert('RGBA') for d in DIRS}
PALETTE = sorted({c[:3] for d in DIRS for _, c in rot[d].getcolors(65536) if c[3]})
_near = {}


def nearest(c):
    if c not in _near:
        _near[c] = min(((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2, p) for p in PALETTE)[1]
    return _near[c]


def tidy(im):
    """Solo colores de la jefa y sin motas sueltas (grupos de menos de 4 píxeles)."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            px[x, y] = (*nearest((r, g, b)), 255) if a >= 128 else (0, 0, 0, 0)
    left = {(x, y) for y in range(out.height) for x in range(out.width) if px[x, y][3]}
    while left:
        group, todo = set(), [left.pop()]
        while todo:
            q = todo.pop()
            group.add(q)
            for n in ((q[0] + a, q[1] + b) for a in (-1, 0, 1) for b in (-1, 0, 1)):
                if n in left:
                    left.discard(n)
                    todo.append(n)
        if len(group) < 4:
            for q in group:
                px[q] = (0, 0, 0, 0)
    return out


def cell(im, x=0, y=0):
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    c.paste(im, (OX + x, OY + y), im)
    return c


def frames(folder, d):
    fs, n = [], 0
    while True:
        try:
            fs.append(Image.open(f'{SRC}/{folder}/{d}-{n}.png').convert('RGBA'))
        except FileNotFoundError:
            break
        n += 1
    assert fs, f'faltan los fotogramas de {folder}/{d}'
    # el fotograma 0 es el dibujo quieto (casi: PixelLab lo retoca un poco): se busca dónde encaja mejor su silueta
    # para saber cuánto está desplazado todo
    r = rot[d]
    W, H = fs[0].width - r.width, fs[0].height - r.height
    target = r.getchannel('A').point(lambda a: 255 if a else 0)
    alpha = fs[0].getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    best = None
    for oy in range(H + 1):
        for ox in range(W + 1):
            diff = ImageChops.difference(alpha.crop((ox, oy, ox + r.width, oy + r.height)), target)
            n = sum(diff.histogram()[1:])
            if best is None or n < best[0]:
                best = (n, ox, oy)
    if best[0] > 300:
        print(f'  OJO: el fotograma 0 de {folder}/{d} se parece poco al dibujo quieto ({best[0]} píxeles distintos)')
    return fs, best[1], best[2]


still = {d: cell(rot[d]) for d in DIRS}
blocks = []
idle = {}
for d in DIRS:
    r = rot[d]
    low = Image.new('RGBA', r.size, (0, 0, 0, 0))
    low.paste(r.crop((0, 0, r.width, WAIST)), (0, 1))
    low.paste(r.crop((0, WAIST + 1, r.width, r.height)), (0, WAIST + 1))
    idle[d] = [still[d], cell(low)]
blocks.append(('idle', idle, {'fps': 1.5, 'loop': True}))

for name, a in cfg['animaciones'].items():
    dirs = [a['solo']] if a.get('solo') else DIRS
    b = {}
    for d in dirs:
        fs, ox, oy = frames(a['carpeta'], d)
        lo, hi = a['fotogramas']
        b[d] = []
        for n in range(lo, min(hi, len(fs) - 1) + 1):
            f = tidy(fs[n])
            bb = f.getbbox()
            if bb and (bb[0] - ox + OX < 0 or bb[1] - oy + OY < 0 or bb[2] - ox + OX > CW or bb[3] - oy + OY > CH):
                print(f'  OJO: el fotograma {n} de {a["carpeta"]}/{d} se sale de la casilla')
            b[d].append(cell(f, -ox, -oy))
    n = len(b[dirs[0]])
    meta = {'fps': round(n / a['duracion'], 2), 'loop': a.get('repite', False)}
    if 'impacto' in a:
        meta['hit'] = round(a['impacto'] / n, 3)
    blocks.append((name, b, meta))
    print(f'{name:7s} {a["carpeta"]}: {n} fotogramas en {len(dirs)} direcciones')

cols = max(len(DIRS), *(len(fs) for _, b, _ in blocks for fs in b.values()))
rows = 1 + sum(len(b) for _, b, _ in blocks)
sheet = Image.new('RGBA', (cols * CW, rows * CH), (0, 0, 0, 0))
for i, d in enumerate(DIRS):
    sheet.alpha_composite(still[d], (i * CW, 0))
anims = {'still': {'fps': 1, 'loop': True, 'dirs': {d: {'row': 0, 'col': i, 'frames': 1} for i, d in enumerate(DIRS)}}}
row = 1
for name, b, meta in blocks:
    dirs = {}
    for d, fs in b.items():
        for i, f in enumerate(fs):
            sheet.alpha_composite(f, (i * CW, row * CH))
        dirs[d] = {'row': row, 'frames': len(fs)}
        row += 1
    anims[name] = {**meta, 'dirs': dirs}
guardar_png(sheet, f'assets/sprites/{SPRITE}.png')
json.dump({'cell': [CW, CH], 'pivot': [CW // 2, PY], 'anims': anims, 'source': f'Hecha con tools/jefe.py a partir de {SRC}/'},
          open(f'assets/sprites/{SPRITE}.json', 'w', encoding='utf-8', newline='\n'), indent=2, ensure_ascii=False)
print('hoja:', sheet.size)
