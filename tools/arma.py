"""Monta la hoja de sprites de Johnny con un arma en la mano (un "estado" del personaje en PixelLab).

Lo saca todo de assets/sources/<sprite>/:
  rotations/<dirección>.png      las 8 posturas quietas, tal cual las da PixelLab
  walk/<dirección>-<n>.png       la animación de andar (si falta, la hoja sale sin ella)
  ataque/<dirección>-<n>.png     la animación de ataque
  arma.json                      medidas de la casilla, filas del cuello y qué fotogramas de cada animación se usan
En las dos animaciones el fotograma 0 tiene que ser el dibujo quieto (así salen de PixelLab con PixMiniMax).

Y escribe assets/sprites/<sprite>.png y .json con cuatro animaciones:
  still   las 8 posturas quietas (fila 0)
  idle    reposo hecho a mano, como el de tools/idle.py: respiración de 1 píxel y un parpadeo
  walk    andar, con los colores igualados a los del dibujo quieto
  attack  el ataque, recortado a los fotogramas elegidos en arma.json

Las casillas son más grandes que el personaje para que quepa el arco del arma. Todo se coloca respecto
al dibujo quieto, así que al pasar de una animación a otra Johnny no da saltitos.

Uso (desde la carpeta del proyecto; necesita Python con Pillow: pip install pillow):
  python tools/arma.py conserje-48-guardia                      rehace la hoja
  python tools/arma.py conserje-48-guardia --gif carpeta        además guarda GIF de comprobación en esa carpeta
  python tools/arma.py conserje-48-guardia --lienzos carpeta    solo prepara los fotogramas de partida del ataque
"""
import json, os, sys
from PIL import Image, ImageChops

SPRITE = sys.argv[1]
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
SRC = f'assets/sources/{SPRITE}'
cfg = json.load(open(f'{SRC}/arma.json', encoding='utf-8')) if os.path.exists(f'{SRC}/arma.json') else {}
# Lo que no diga arma.json sale de aquí: son las medidas de los estados de Johnny (lienzo de 64×64 en PixelLab)
CW, CH = cfg.get('celda', [96, 96])
PX, PY = cfg.get('pivote', [48, 72])             # dónde quedan los pies dentro de la casilla
FX, FY = cfg.get('pies_en_rotacion', [32, 55])   # dónde están los pies en el dibujo quieto de PixelLab
OX, OY = PX - FX, PY - FY                        # desplazamiento del dibujo quieto dentro de la casilla
IDLE_FPS, WALK_FPS = 5, 12

rot = {d: Image.open(f'{SRC}/rotations/{d}.png').convert('RGBA') for d in DIRS}

if '--lienzos' in sys.argv:
    # Fotogramas de partida para pedir el ataque a PixelLab: el dibujo quieto dentro de un lienzo mayor,
    # para que quepa el arco del arma. Se suben y se dan como fotograma de partida y de llegada.
    folder = sys.argv[sys.argv.index('--lienzos') + 1]
    w, h, x, y = cfg.get('lienzo_ataque', [96, 96, 16, 20])
    for d in DIRS:
        c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        c.paste(rot[d], (x, y), rot[d])
        c.save(f'{folder}/partida-{d}.png')
    print(f'8 lienzos de {w}×{h} guardados en {folder} (partida-<dirección>.png)')
    sys.exit()


def cell(im, x=0, y=0):
    """Una casilla vacía con `im` pegada en (x, y) respecto al sitio del dibujo quieto."""
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    c.paste(im, (OX + x, OY + y), im)  # lo que se salga de la casilla se recorta
    return c


def load(folder, d):
    """Fotogramas <dirección>-<n>.png con n seguido desde 0."""
    files = []
    while os.path.exists(f'{SRC}/{folder}/{d}-{len(files)}.png'):
        files.append(f'{SRC}/{folder}/{d}-{len(files)}.png')
    return [Image.open(f).convert('RGBA') for f in files]


still = {d: cell(rot[d]) for d in DIRS}

# ═════════════ Reposo (como tools/idle.py, pero sin confundir la mopa con la cabeza) ═════════════
NECK = cfg['reposo']['cuello']
HEAD = range(PX - 5, PX + 6)   # columnas de la cabeza: el arma queda a los lados


def rows(im):
    return [im.crop((0, y, CW, y + 1)) for y in range(CH)]


def from_rows(rs):
    out = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    for y, r in enumerate(rs[:CH]):
        out.paste(r, (0, y))
    return out


def anatomy(im, d):
    """Fila más alta del pelo, fila del cuello y fila de la cintura."""
    px = im.load()
    top = min(y for y in range(CH) for x in HEAD if px[x, y][3])
    neck = top + NECK[d]
    return top, neck, neck + 11


def poses(im, d):
    """Reposo, pecho arriba, todo arriba y pecho abajo con la cabeza aún arriba."""
    _, neck, waist = anatomy(im, d)
    r = rows(im)
    chest = from_rows(r[:neck] + r[neck + 1:waist + 1] + [r[waist]] + r[waist + 1:])
    full = from_rows(r[1:waist + 1] + [r[waist]] + r[waist + 1:])
    out = from_rows(r[1:neck + 1] + [r[neck]] + r[neck + 1:])
    return im, chest, full, out


def eyes(im, d):
    """Píxeles blancos de los ojos (solo en la cabeza: la mopa también es blanca)."""
    top = anatomy(im, d)[0]
    px = im.load()
    found = []
    for y in range(top + 4, top + 11):
        for x in range(PX - 8, PX + 9):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 190 and max(r, g, b) - min(r, g, b) < 45:
                found.append((x, y))
    return found


def blink(im, d):
    """Ojos cerrados: el blanco se tapa con el párpado y el iris se queda en una rayita oscura."""
    out = im.copy()
    src, px = im.load(), out.load()
    luma = lambda c: (c[0] * 3 + c[1] * 6 + c[2]) / 10
    for x, y in eyes(im, d):
        sy = y + 1
        while sy < CH - 1 and (src[x, sy][3] == 0 or min(src[x, sy][:3]) > 190 or luma(src[x, sy]) < 120):
            sy += 1
        r, g, b, a = src[x, sy]
        px[x, y] = (int(r * 0.84), int(g * 0.78), int(b * 0.76), 255)
        for nx in (x - 1, x + 1):
            if 30 < luma(src[nx, y]) < 120 and src[nx, y][3]:
                px[nx, y] = (int(r * 0.45), int(g * 0.36), int(b * 0.34), 255)
    return out


# 20 fotogramas a 5 por segundo: dos respiraciones y un parpadeo en la segunda
#   R reposo · C pecho arriba · F todo arriba · O soltando aire · en minúscula, con los ojos cerrados
CYCLE = 'RRRRCFFFOR' + 'RRrRCFFFOR'
idle = {}
for d in DIRS:
    R, C, F, O = poses(still[d], d)
    table = {'R': R, 'C': C, 'F': F, 'O': O, 'r': blink(R, d)}
    idle[d] = [table[c] for c in CYCLE]
    top, neck, waist = anatomy(still[d], d)
    print(f'reposo {d:11s} pelo en la fila {top}, cuello {neck}, cintura {waist}, píxeles de ojo {len(eyes(still[d], d))}')

# ═════════════ Andar ═════════════


def same_colors(im, ref):
    """Pinta el fotograma solo con los colores del dibujo quieto de esa dirección (el más parecido a cada uno).
    PixelLab redibuja al personaje y los tonos se le van un poco; así, al echar a andar no cambia de color."""
    palette = [c[:3] for _, c in ref.getcolors(4096) if c[3]]
    cache = {}
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            key = (r, g, b)
            if key not in cache:
                cache[key] = min(palette, key=lambda p: 3 * (p[0] - r) ** 2 + 6 * (p[1] - g) ** 2 + (p[2] - b) ** 2)
            px[x, y] = (*cache[key], 255)
    return out


def offset(fs, d):
    """PixelLab agranda el lienzo distinto en cada dirección. El fotograma 0 es el dibujo quieto, así que
    comparándolos sabemos cuánto se ha movido todo."""
    a, b = fs[0].getbbox(), rot[d].getbbox()
    ox, oy = a[0] - b[0], a[1] - b[1]
    same = fs[0].crop((ox, oy, ox + rot[d].width, oy + rot[d].height)).tobytes() == rot[d].tobytes()
    assert same, f'el fotograma 0 de {d} no coincide con el dibujo quieto'
    return ox, oy


def differ(a, b):
    """Cuántos píxeles cambian de un fotograma a otro."""
    d = ImageChops.difference(a, b)
    return sum(1 for p in d.get_flattened_data() if max(p) > 24)


def find_loop(fs):
    """El tramo que mejor hace ciclo: aquel en que el fotograma que viene justo después es casi igual
    al primero. Devuelve (primero, cuántos, diferencia)."""
    best = min((differ(fs[a], fs[a + n]), a, n) for a in range(1, len(fs)) for n in range(6, 11) if a + n < len(fs))
    return best[1], best[2], best[0]


def placed(f, ox, oy, d, n):
    """El fotograma en su casilla, avisando si algo se queda fuera."""
    b = f.getbbox()
    if b[0] - ox + OX < 0 or b[1] - oy + OY < 0 or b[2] - ox + OX > CW or b[3] - oy + OY > CH:
        print(f'  OJO: el fotograma {n} de {d} se sale de la casilla')
    return cell(f, -ox, -oy)


# De cada dirección se usa solo el tramo que hace ciclo: el que diga arma.json ([primero, cuántos]) o,
# si no dice nada, el que encuentre el script
LOOP = cfg.get('andar', {}).get('ciclo', {})
walk = {}
for d in DIRS:
    fs = load('walk', d)
    if not fs:
        continue
    ox, oy = offset(fs, d)
    if d in LOOP:
        (a, n), how = LOOP[d], 'de arma.json'
    else:
        a, n, dif = find_loop(fs)
        how = f'elegidos solos; al cerrar el ciclo cambian {dif} píxeles' + (' ← OJO, es mucho: mirar el GIF' if dif > 150 else '')
    walk[d] = [placed(same_colors(fs[i], rot[d]), ox, oy, d, i) for i in range(a, a + n)]
    print(f'andar  {d:11s} lienzo {fs[0].size}, desplazado ({ox}, {oy}), fotogramas {a} a {a + n - 1} ({how})')
if len(walk) < len(DIRS):
    print('andar: faltan direcciones en', f'{SRC}/walk', '→ la hoja sale sin la animación de andar')
    walk = {}

# ═════════════ Ataque ═════════════
# arma.json dice qué fotogramas se usan en cada dirección, cuánto dura y en cuál llega el golpe (ahí hace
# el daño el juego). Si aún no dice nada, van todos menos el quieto: sirve para una primera vista.
ATK = cfg.get('ataque', {})
PICK = ATK.get('fotogramas', {})
attack = {}
for d in DIRS:
    fs = load('ataque', d)
    assert fs, f'faltan los fotogramas de ataque de {d}'
    ox, oy = offset(fs, d)
    pick = PICK.get(d, list(range(1, len(fs))))
    attack[d] = [placed(fs[n], ox, oy, d, n) for n in pick]
    print(f'ataque {d:11s} lienzo {fs[0].size}, desplazado ({ox}, {oy}), fotogramas {pick}')
NA = len(attack['south'])
assert all(len(v) == NA for v in attack.values()), 'todas las direcciones del ataque deben tener los mismos fotogramas'
ATK_DUR, ATK_HIT = ATK.get('duracion', 0.5), ATK.get('impacto', 3)

# ═════════════ Hoja y JSON ═════════════
blocks = [('idle', idle)] + ([('walk', walk)] if walk else []) + [('attack', attack)]
cols = max(len(DIRS), *(len(fs) for _, b in blocks for fs in b.values()))
sheet = Image.new('RGBA', (cols * CW, (1 + len(blocks) * len(DIRS)) * CH), (0, 0, 0, 0))
for i, d in enumerate(DIRS):
    sheet.alpha_composite(still[d], (i * CW, 0))
anims = {'still': {'fps': 1, 'loop': True, 'dirs': {d: {'row': 0, 'col': i, 'frames': 1} for i, d in enumerate(DIRS)}}}
row = 1
for name, block in blocks:
    for r, d in enumerate(DIRS):
        for i, f in enumerate(block[d]):
            sheet.alpha_composite(f, (i * CW, (row + r) * CH))
    fps = {'idle': IDLE_FPS, 'walk': WALK_FPS, 'attack': round(NA / ATK_DUR)}[name]
    anims[name] = {'fps': fps, 'loop': name != 'attack',
                   'dirs': {d: {'row': row + r, 'frames': len(block[d])} for r, d in enumerate(DIRS)}}
    row += len(DIRS)
# en qué punto de la animación (de 0 a 1) llega el golpe: el juego hace el daño ahí
anims['attack']['hit'] = round(ATK_HIT / NA, 3)
sheet.save(f'assets/sprites/{SPRITE}.png', optimize=True)
meta = {'cell': [CW, CH], 'pivot': [PX, PY], 'anims': anims,
        'source': f'Hecha con tools/arma.py a partir de {SRC}/'}
json.dump(meta, open(f'assets/sprites/{SPRITE}.json', 'w', encoding='utf-8', newline='\n'), indent=2, ensure_ascii=False)
print('hoja:', sheet.size)

if '--gif' in sys.argv:
    folder = sys.argv[sys.argv.index('--gif') + 1]
    G = 4
    for name, block in blocks:
        n = max(len(fs) for fs in block.values())
        gif = []
        for i in range(n):
            im = Image.new('RGBA', (4 * CW * G, 2 * CH * G), (70, 74, 82, 255))
            for k, d in enumerate(DIRS):
                f = block[d][i % len(block[d])]
                im.alpha_composite(f.resize((CW * G, CH * G), Image.NEAREST), ((k % 4) * CW * G, (k // 4) * CH * G))
            gif.append(im.convert('RGB'))
        gif[0].save(f'{folder}/{SPRITE}-{name}.gif', save_all=True, append_images=gif[1:],
                    duration=int(1000 / anims[name]['fps']), loop=0)
    print('GIF guardados en', folder)
