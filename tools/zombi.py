"""Monta la hoja de sprites de un zombi a partir de lo que da PixelLab.

Lo saca todo de assets/sources/<fuente>/:
  rotations/<dirección>.png     las 8 posturas quietas (48×48), ya con la piel corregida por tools/piel.py
  walk/<dirección>-<n>.png      andar (PixMiniMax; el lienzo cambia de tamaño según la dirección)
  ataque/, golpe/, muerte/      atacar, recibir un golpe y morir (lienzo de 96×96 con el dibujo quieto en 24, 32)
  zombi.json (opcional)         qué fotogramas se usan, cuánto dura cada animación, "cintura", "pies", "sangre", "casilla" y "origen"
En todas las animaciones el fotograma 0 es el dibujo quieto: así se sabe dónde colocar los demás.

Y escribe assets/sprites/<sprite>.png y .json con seis animaciones:
  still   las 8 posturas quietas
  idle    reposo hecho a mano: el tronco baja y sube un píxel, despacio
  walk    andar: solo el tramo que hace ciclo, con los colores igualados a los del dibujo quieto
  attack  el zarpazo ("hit" dice en qué punto llega)
  hurt    recibir un golpe
  death   morir: no se repite, se queda en el último fotograma (tendido en el suelo)

Limpieza: PixelLab mete sangre de un rojo muy vivo y algún destello aunque se le pida que no. En golpe y muerte
la sangre se oscurece (decidido por el dueño: se queda, pero en un rojo apagado que no desentone) y se quita
cualquier otro efecto de un color ajeno al zombi; en el ataque solo se quitan los destellos blancos.
Con "sangre": "quitar" o "viva" en zombi.json se cambia eso.

Uso (desde la carpeta del proyecto; necesita Python con Pillow):
  py tools/zombi.py zombi-normal-48 zombi-normal                 rehace la hoja zombi-normal
  py tools/zombi.py zombi-normal-48 zombi-normal --gif carpeta   además guarda GIF de comprobación
"""
import json, os, sys
from collections import Counter
from PIL import Image, ImageChops
from png import guardar_png  # guarda la hoja comprimida sin perder nada

SOURCE, SPRITE = sys.argv[1], sys.argv[2]
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
SRC = f'assets/sources/{SOURCE}'
cfg = json.load(open(f'{SRC}/zombi.json', encoding='utf-8')) if os.path.exists(f'{SRC}/zombi.json') else {}
# Para un zombi más grande que 48×48 (el venenoso, a 72): "casilla" y "origen" en zombi.json
CW, CH = cfg.get('casilla', [96, 96])   # casilla: cabe el zombi tendido en el suelo
OX, OY = cfg.get('origen', [24, 32])    # dónde va el dibujo quieto dentro de la casilla
PX, PY = CW // 2, cfg.get('pies', 78)   # los pies dentro de la casilla (otra altura con "pies" en zombi.json)
WAIST = cfg.get('cintura', 26)   # fila de la cintura en el dibujo quieto (para el reposo); otra con "cintura" en zombi.json

rot = {d: Image.open(f'{SRC}/rotations/{d}.png').convert('RGBA') for d in DIRS}
# Sangre: "oscura" (rojo apagado, lo normal), "quitar" (sin sangre) o "viva" (el rojo chillón de PixelLab)
SANGRE = cfg.get('sangre', 'oscura')
BLOOD = [(134, 20, 12), (104, 12, 6), (74, 8, 4)]   # de más clara a más oscura
# todos los colores del zombi, de sus 8 vistas (más los de la sangre, si se queda)
PALETTE = sorted({c[:3] for d in DIRS for _, c in rot[d].getcolors(4096) if c[3]} | set(BLOOD if SANGRE == 'oscura' else []))


def cell(im, x=0, y=0):
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    c.paste(im, (OX + x, OY + y), im)
    return c


def load(folder, d):
    fs = []
    while os.path.exists(f'{SRC}/{folder}/{d}-{len(fs)}.png'):
        fs.append(Image.open(f'{SRC}/{folder}/{d}-{len(fs)}.png').convert('RGBA'))
    assert fs, f'faltan los fotogramas de {folder} de {d}'
    return fs


def offset(fs, d, folder):
    """El fotograma 0 es el dibujo quieto: comparándolos se sabe cuánto está desplazado todo."""
    a, b = fs[0].getbbox(), rot[d].getbbox()
    ox, oy = a[0] - b[0], a[1] - b[1]
    # solo cuenta lo que se ve: bajo los píxeles transparentes PixelLab a veces deja otro color
    def seen(im):
        out = Image.new('RGBA', im.size, (0, 0, 0, 0))
        out.paste(im, (0, 0), im)
        return out.tobytes()
    same = seen(fs[0].crop((ox, oy, ox + rot[d].width, oy + rot[d].height))) == seen(rot[d])
    assert same, f'el fotograma 0 de {folder}/{d} no coincide con el dibujo quieto'
    return ox, oy


def placed(f, ox, oy, d, n, folder):
    b = f.getbbox()
    if b and (b[0] - ox + OX < 0 or b[1] - oy + OY < 0 or b[2] - ox + OX > CW or b[3] - oy + OY > CH):
        print(f'  OJO: el fotograma {n} de {folder}/{d} se sale de la casilla')
    return cell(f, -ox, -oy)


_near = {}


def nearest(c):
    """El color del zombi más parecido a `c` y lo lejos que queda."""
    if c not in _near:
        _near[c] = min(((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2, p) for p in PALETTE)
    return _near[c]


def clean(f, is_fx):
    """Quita los píxeles de efecto (los que cumplen `is_fx`): los sueltos se borran y los que quedan dentro
    del cuerpo se rellenan con el color de sus vecinos."""
    out = f.copy()
    px = out.load()
    w, h = out.size
    fx = {(x, y) for y in range(h) for x in range(w) if px[x, y][3] and is_fx(px[x, y][:3])}
    for (x, y) in list(fx):
        if px[x, y][3] < 128:
            px[x, y] = (0, 0, 0, 0)
    for _ in range(6):   # de fuera hacia dentro
        done = {}
        for (x, y) in fx:
            around = [px[x + i, y + j] for i in (-1, 0, 1) for j in (-1, 0, 1)
                      if (i or j) and 0 <= x + i < w and 0 <= y + j < h and (x + i, y + j) not in fx]
            solid = [c for c in around if c[3]]
            if len(around) >= 3:
                # rodeado de cuerpo: se rellena; asomando al aire: se borra
                done[(x, y)] = Counter(solid).most_common(1)[0][0] if len(solid) >= 5 else (0, 0, 0, 0)
        for q, c in done.items():
            px[q] = c
        fx -= set(done)
        if not fx:
            break
    for q in fx:
        px[q] = (0, 0, 0, 0)
    return out


alien = lambda c: nearest(c)[0] > 60 ** 2                      # nada que ver con los colores del zombi
red = lambda c: c[0] > 150 and c[1] < 90 and c[2] < 90         # el rojo vivo de la sangre de PixelLab


def gore(f):
    """Golpe y muerte: deja la sangre como diga SANGRE, quita los demás efectos e iguala los colores."""
    if SANGRE == 'viva':
        return clean(f, lambda c: alien(c) and not red(c))
    if SANGRE == 'oscura':
        f = f.copy()
        px = f.load()
        for y in range(f.height):
            for x in range(f.width):
                r, g, b, a = px[x, y]
                if a >= 128 and red((r, g, b)):
                    # el borde de cada mancha, un tono más oscuro que el centro
                    edge = any(not (0 <= x + i < f.width and 0 <= y + j < f.height) or px[x + i, y + j][3] < 128
                               for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    px[x, y] = (*BLOOD[2 if edge else 1 if r < 235 else 0], 255)
        return same_colors(clean(f, alien))
    return specks(same_colors(clean(f, alien)))
spark = lambda c: min(c) > 215 and nearest(c)[0] > 40 ** 2     # destello blanco


def same_colors(im):
    """Pinta el fotograma solo con los colores del zombi (el más parecido a cada uno)."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            px[x, y] = (*nearest((r, g, b))[1], 255) if a >= 128 else (0, 0, 0, 0)
    return out


def specks(im):
    """Quita las motas sueltas (grupos de menos de 4 píxeles separados del resto)."""
    px = im.load()
    left = {(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3]}
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
    return im


still = {d: cell(rot[d]) for d in DIRS}

# ═════════════ Reposo: el tronco baja un píxel y vuelve ═════════════
idle = {}
for d in DIRS:
    r = rot[d]
    low = Image.new('RGBA', r.size, (0, 0, 0, 0))
    low.paste(r.crop((0, 0, r.width, WAIST)), (0, 1))            # de la cintura para arriba, un píxel más abajo
    low.paste(r.crop((0, WAIST + 1, r.width, r.height)), (0, WAIST + 1))
    idle[d] = [still[d], cell(low)]

# ═════════════ Andar ═════════════
def differ(a, b):
    return sum(1 for p in ImageChops.difference(a, b).get_flattened_data() if max(p) > 24)


def find_loop(fs):
    """El tramo que mejor hace ciclo: el fotograma que viene justo después es casi igual al primero."""
    best = min((differ(fs[a], fs[a + n]), a, n) for a in range(2, len(fs)) for n in range(6, 11) if a + n < len(fs))
    return best[1], best[2], best[0]


LOOP = cfg.get('andar', {})
walk = {}
for d in DIRS:
    fs = load('walk', d)
    ox, oy = offset(fs, d, 'walk')
    if d in LOOP:
        (a, n), how = LOOP[d], 'de zombi.json'
    else:
        a, n, dif = find_loop(fs)
        how = f'elegidos solos; al cerrar el ciclo cambian {dif} píxeles' + (' ← OJO, es mucho' if dif > 150 else '')
    walk[d] = [placed(specks(same_colors(fs[i])), ox, oy, d, i, 'walk') for i in range(a, a + n)]
    print(f'andar  {d:11s} lienzo {fs[0].size}, fotogramas {a} a {a + n - 1} ({how})')

# ═════════════ Atacar, recibir golpe y morir ═════════════
def block(folder, key, default, fix):
    pick = cfg.get(key, {}).get('fotogramas')
    out = {}
    for d in DIRS:
        fs = load(folder, d)
        ox, oy = offset(fs, d, folder)
        ns = pick or list(range(default[0], min(default[1], len(fs) - 1) + 1))
        out[d] = [placed(fix(fs[n]), ox, oy, d, n, folder) for n in ns]
    n = len(out['south'])
    assert all(len(v) == n for v in out.values()), f'{folder}: todas las direcciones deben tener los mismos fotogramas'
    print(f'{folder:7s} {n} fotogramas por dirección')
    return out


SLIME = [(143, 209, 63), (110, 170, 45), (79, 119, 45)]   # el verde del moco del juego, de claro a oscuro


def slime(f):
    """El venenoso: PixelLab pinta lo que escupe de un rojo puro. Se pasa al verde del moco del juego."""
    f = f.copy()
    px = f.load()
    for y in range(f.height):
        for x in range(f.width):
            r, g, b, a = px[x, y]
            if a >= 128 and r >= 120 and g <= 70 and b <= 70 and r - g >= 110 and nearest((r, g, b))[0] > 35 ** 2:
                px[x, y] = (*SLIME[0 if r >= 235 else 1 if r >= 200 else 2], 255)
    return specks(clean(f, spark))


# en "ataque" de zombi.json: "sangre": true trata la sangre como en golpe y muerte; "moco": true tiñe de verde
# el chorro rojo que PixelLab le pinta al venenoso al escupir
ATK = cfg.get('ataque', {})
attack = block('ataque', 'ataque', (1, 7),
               gore if ATK.get('sangre') else slime if ATK.get('moco') else lambda f: specks(clean(f, spark)))
hurt = block('golpe', 'golpe', (1, 6), gore)
death = block('muerte', 'muerte', (1, 12), gore)
DUR = {'attack': cfg.get('ataque', {}).get('duracion', 0.55), 'hurt': cfg.get('golpe', {}).get('duracion', 0.35),
       'death': cfg.get('muerte', {}).get('duracion', 0.9)}
HIT = cfg.get('ataque', {}).get('impacto', 3)   # en qué fotograma (de los elegidos) llega el zarpazo

# ═════════════ Hoja y JSON ═════════════
blocks = [('idle', idle), ('walk', walk), ('attack', attack), ('hurt', hurt), ('death', death)]
cols = max(len(DIRS), *(len(fs) for _, b in blocks for fs in b.values()))
sheet = Image.new('RGBA', (cols * CW, (1 + len(blocks) * len(DIRS)) * CH), (0, 0, 0, 0))
for i, d in enumerate(DIRS):
    sheet.alpha_composite(still[d], (i * CW, 0))
anims = {'still': {'fps': 1, 'loop': True, 'dirs': {d: {'row': 0, 'col': i, 'frames': 1} for i, d in enumerate(DIRS)}}}
row = 1
for name, b in blocks:
    for r, d in enumerate(DIRS):
        for i, f in enumerate(b[d]):
            sheet.alpha_composite(f, (i * CW, (row + r) * CH))
    fps = {'idle': 1.5, 'walk': 10}.get(name) or round(len(b['south']) / DUR[name], 1)
    anims[name] = {'fps': fps, 'loop': name in ('idle', 'walk'),
                   'dirs': {d: {'row': row + r, 'frames': len(b[d])} for r, d in enumerate(DIRS)}}
    row += len(DIRS)
anims['attack']['hit'] = round(HIT / len(attack['south']), 3)
guardar_png(sheet, f'assets/sprites/{SPRITE}.png')
json.dump({'cell': [CW, CH], 'pivot': [PX, PY], 'anims': anims,
           'source': f'Hecha con tools/zombi.py a partir de {SRC}/'},
          open(f'assets/sprites/{SPRITE}.json', 'w', encoding='utf-8', newline='\n'), indent=2, ensure_ascii=False)
print('hoja:', sheet.size)

if '--gif' in sys.argv:
    folder = sys.argv[sys.argv.index('--gif') + 1]
    G = 3
    for name, b in blocks:
        n = max(len(fs) for fs in b.values())
        gif = []
        for i in range(n):
            im = Image.new('RGBA', (4 * CW * G, 2 * CH * G), (70, 74, 82, 255))
            for k, d in enumerate(DIRS):
                f = b[d][i % len(b[d])]
                im.alpha_composite(f.resize((CW * G, CH * G), Image.NEAREST), ((k % 4) * CW * G, (k // 4) * CH * G))
            gif.append(im.convert('RGB'))
        gif[0].save(f'{folder}/{SPRITE}-{name}.gif', save_all=True, append_images=gif[1:],
                    duration=int(1000 / anims[name]['fps']), loop=0)
    print('GIF guardados en', folder)
