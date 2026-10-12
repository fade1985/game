"""Animación de reposo de Johnny hecha a partir de su dibujo quieto (las 8 rotaciones).

Respirar, en un sprite de 48 píxeles, es mover un píxel: al coger aire sube primero el pecho
y un instante después la cabeza; al soltarlo baja primero el pecho y luego la cabeza. Como el
resto de píxeles no se tocan, la cara y la ropa no "bailan". Cada dos respiraciones parpadea.

Uso (desde la carpeta del proyecto; necesita Python con Pillow: pip install pillow):
  python tools/idle.py <carpeta de trabajo> .           solo saca la vista previa y un GIF en esa carpeta
  python tools/idle.py <carpeta de trabajo> . --build   además rehace assets/sprites/conserje-48.png y .json
La fila 0 de la hoja (las 8 rotaciones quietas) no se toca nunca: es de donde sale todo lo demás.
OJO: --build rehace la hoja solo con las rotaciones y el reposo. Después hay que volver a meter la
animación de andar con:  python tools/walk.py conserje-48
"""
import json, sys
from PIL import Image

WORK, ROOT = sys.argv[1], sys.argv[2]
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CELL = 48
FPS = 5

sheet = Image.open(f'{ROOT}/assets/sprites/conserje-48.png').convert('RGBA')
still = {d: sheet.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i, d in enumerate(DIRS)}


def rows(im):
    """Lista de filas (cada una, una tira de 1 píxel de alto)."""
    return [im.crop((0, y, CELL, y + 1)) for y in range(CELL)]


def from_rows(rs):
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    for y, r in enumerate(rs[:CELL]):
        out.paste(r, (0, y))
    return out


def width(im, y):
    px = im.load()
    xs = [x for x in range(CELL) if px[x, y][3] > 0]
    return (xs[-1] - xs[0] + 1) if xs else 0


# Fila del cuello contando desde lo más alto del pelo. De frente la barbilla tapa el cuello, así que la
# fila que se encoge y se estira es la del cuello de la camisa: nunca una de la cara.
NECK = {'south': 13, 'south-east': 13, 'south-west': 13, 'east': 14, 'west': 14, 'north': 12, 'north-east': 12, 'north-west': 12}


def anatomy(im, d):
    """Fila más alta del pelo, fila del cuello y fila de la cintura."""
    top = im.getbbox()[1]
    neck = top + NECK[d]
    return top, neck, neck + 11


def poses(im, d):
    """Las cuatro posturas: reposo, pecho arriba, todo arriba y pecho abajo con la cabeza aún arriba."""
    _, neck, waist = anatomy(im, d)
    r = rows(im)
    rest = im
    # pecho arriba: desaparece la fila del cuello (se encoge) y se repite la de la cintura (se estira)
    chest = from_rows(r[:neck] + r[neck + 1:waist + 1] + [r[waist]] + r[waist + 1:])
    # todo arriba: cabeza y pecho suben un píxel; se repite la fila de la cintura
    full = from_rows(r[1:waist + 1] + [r[waist]] + r[waist + 1:])
    # soltando aire: el pecho ya ha bajado y la cabeza sigue arriba (el cuello se estira una fila)
    out = from_rows(r[1:neck + 1] + [r[neck]] + r[neck + 1:])
    return rest, chest, full, out


def eyes(im):
    """Píxeles blancos de los ojos (solo los hay en las vistas de frente y de perfil)."""
    top = im.getbbox()[1]
    px = im.load()
    found = []
    for y in range(top + 4, top + 11):
        for x in range(CELL):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 190 and max(r, g, b) - min(r, g, b) < 45:
                found.append((x, y))
    return found


def blink(im):
    """Ojos cerrados: el blanco del ojo se tapa con el párpado (piel algo más oscura) y el iris de al lado
    se queda en una rayita oscura, como las pestañas."""
    out = im.copy()
    src = im.load()
    px = out.load()
    luma = lambda c: (c[0] * 3 + c[1] * 6 + c[2]) / 10
    for x, y in eyes(im):
        # piel más cercana por debajo del ojo
        sy = y + 1
        while sy < CELL - 1 and (src[x, sy][3] == 0 or min(src[x, sy][:3]) > 190 or luma(src[x, sy]) < 120):
            sy += 1
        r, g, b, a = src[x, sy]
        px[x, y] = (int(r * 0.84), int(g * 0.78), int(b * 0.76), 255)
        for nx in (x - 1, x + 1):
            if 30 < luma(src[nx, y]) < 120 and src[nx, y][3]:
                px[nx, y] = (int(r * 0.45), int(g * 0.36), int(b * 0.34), 255)
    return out


# Ciclo de 20 fotogramas a 5 por segundo = 4 segundos: dos respiraciones y un parpadeo en la segunda.
#   R reposo · C pecho arriba · F todo arriba · O soltando aire · en minúscula, con los ojos cerrados
CYCLE = 'RRRRCFFFOR' + 'RRrRCFFFOR'
N = len(CYCLE)

frames = {}
for d in DIRS:
    R, C, F, O = poses(still[d], d)
    table = {'R': R, 'C': C, 'F': F, 'O': O}
    table['r'] = blink(R)
    frames[d] = [table[c] for c in CYCLE]
    top, neck, waist = anatomy(still[d], d)
    print(f'{d:11s} cabeza desde {top}, cuello {neck}, cintura {waist}, píxeles de ojo: {len(eyes(still[d]))}')

# ── vista previa: las posturas distintas de cada dirección, ampliadas ──
S = 6
keys = ['R', 'C', 'F', 'O', 'r']
prev = Image.new('RGBA', (len(keys) * CELL * S, len(DIRS) * CELL * S), (70, 74, 82, 255))
for row, d in enumerate(DIRS):
    for col, k in enumerate(keys):
        f = frames[d][CYCLE.index(k)]
        prev.alpha_composite(f.resize((CELL * S, CELL * S), Image.NEAREST), (col * CELL * S, row * CELL * S))
prev.save(f'{WORK}/preview-breathe.png')

# ── GIF con las 8 direcciones ──
G = 5
gif = []
for i in range(N):
    im = Image.new('RGBA', (4 * CELL * G, 2 * CELL * G), (70, 74, 82, 255))
    for k, d in enumerate(DIRS):
        im.alpha_composite(frames[d][i].resize((CELL * G, CELL * G), Image.NEAREST), ((k % 4) * CELL * G, (k // 4) * CELL * G))
    gif.append(im.convert('RGB'))
gif[0].save(f'{WORK}/johnny-idle.gif', save_all=True, append_images=gif[1:], duration=int(1000 / FPS), loop=0)
print('GIF:', N, 'fotogramas,', N / FPS, 's')

if '--build' in sys.argv:
    # fila 0: las 8 rotaciones quietas (como estaba); filas 1 a 8: la animación de cada dirección
    out = Image.new('RGBA', (N * CELL, (1 + len(DIRS)) * CELL), (0, 0, 0, 0))
    out.alpha_composite(sheet.crop((0, 0, 8 * CELL, CELL)), (0, 0))
    for row, d in enumerate(DIRS):
        for i, f in enumerate(frames[d]):
            out.alpha_composite(f, (i * CELL, (row + 1) * CELL))
    out.save(f'{ROOT}/assets/sprites/conserje-48.png')
    path = f'{ROOT}/assets/sprites/conserje-48.json'
    meta = json.load(open(path, encoding='utf-8'))
    rot = meta['anims'].get('still') or meta['anims']['idle']
    meta['anims'] = {
        'idle': {'fps': FPS, 'loop': True, 'dirs': {d: {'row': r + 1, 'frames': N} for r, d in enumerate(DIRS)}},
        'still': rot,
    }
    meta['source']['character']['id'] = '4e6c78c6-d6c6-46d3-99c1-40a2d86f0e6c'
    meta['source']['idle'] = 'Hecha con tools/idle.py a partir de las rotaciones: respiración (1 píxel) y parpadeo'
    json.dump(meta, open(path, 'w', encoding='utf-8', newline='\n'), indent=2, ensure_ascii=False)
    print('hoja del juego:', out.size)
