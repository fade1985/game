"""Saca variantes de color de la hoja de un zombi (ropa y piel), sin tocar nada más.

Uso:  py tools/variantes.py zombi-normal            (rehace todas las variantes de ese zombi)
      py tools/variantes.py zombi-normal rojo       (solo una)
      py tools/variantes.py zombi-normal --mapa     (guarda en assets/pruebas/ qué ha entendido que es cada píxel)

Lee assets/sprites/<zombi>.png y escribe assets/sprites/<zombi>-<variante>.png (+ su .json, copia del original).
Los ids nuevos van en assets/sprites/manifest.json y en `variantes` de ZOMBIE_TYPES (zombies.js).
La hoja original no se modifica.

Se hace en dos pasos:

1. QUÉ ES CADA PÍXEL (camisa, pantalón, piel o "no tocar"). El tono solo no basta: los brillos del vaquero
   son del mismo azul que la camisa, y en el zombi lento la camisa, el pelo y las tripas son todos marrones.
   Así que cada píxel dudoso mira a sus vecinos y se queda con lo que más abunda alrededor. Cada zombi tiene
   su propia pareja de funciones (`clases_*` y `decide_*`) porque cada dibujo usa sus colores.

2. DE QUÉ COLOR SE PINTA. Cada prenda de cada variante es una escala de 5 colores elegidos a mano, de la
   sombra a la luz (las sombras tiran a frío y las luces a cálido, como en el resto del pixel art). Cada
   píxel se coloca en esa escala según lo claro que era en el original: el sombreado se conserva entero.
   La piel siempre se queda en tonos de muerto (verde, gris, amarillento), nunca color carne.
"""
import colorsys, json, shutil, sys
from PIL import Image

# Escalas de color: de sombra a luz. None = esa prenda se queda como en el original.
CAMISA = {
    'rojo':     ['#351220', '#571a25', '#7b252a', '#9c332f', '#b64c3f'],
    'bata':     ['#5d6675', '#838c98', '#a9b0b6', '#cdd1cf', '#ebebe2'],
    'mostaza':  ['#4d361d', '#765620', '#9f7b29', '#c09d3a', '#d8bf66'],
    'negro':    ['#121319', '#1e2029', '#2b2e38', '#3b3e49', '#4f535e'],
    'militar':  ['#222e1d', '#344527', '#4b5f35', '#647a45', '#83965d'],
    'turquesa': ['#12333b', '#1b4c52', '#28696a', '#3f8780', '#66a698'],
}
PANTALON = {
    'rojo':     ['#0b0b0f', '#1a1a20', '#2a2b32', '#3b3d45', '#4d5059'],   # gris carbón
    'bata':     ['#081918', '#102d2b', '#1a4440', '#275b55', '#36726a'],   # verde de quirófano
    'mostaza':  ['#120b07', '#27180f', '#3c2718', '#523722', '#67482d'],   # marrón
    'negro':    None,                                                      # el vaquero de siempre
    'militar':  ['#12110b', '#272516', '#3c3922', '#524d30', '#68623f'],   # caqui oscuro
    'turquesa': ['#0f0d0d', '#201c1c', '#332e2e', '#464040', '#5a5353'],   # gris pardo
}
PIEL = {
    'rojo':     None,                                                      # el verde de siempre
    'bata':     None,
    'mostaza':  ['#41532a', '#586e36', '#708845', '#8aa458', '#a5bc70'],   # verde podrido, más oscuro
    'negro':    ['#46565f', '#60747e', '#7c929a', '#9aaeb3', '#b8c9cc'],   # gris azulado
    'militar':  ['#566957', '#748873', '#94a890', '#b3c5ad', '#cfdcc8'],   # pálido (para que no sea todo verde)
    'turquesa': ['#646b36', '#828945', '#a0a758', '#bbc170', '#d4d88f'],   # amarillento
}
ESCALAS = {'camisa': CAMISA, 'pantalon': PANTALON, 'piel': PIEL}
VARIANTES = list(CAMISA)


def rgb(hexa):
    return tuple(int(hexa[i:i + 2], 16) for i in (1, 3, 5))


def luz(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def tono(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return h * 360, s, v


# ── Zombi normal: camisa azul grisácea, vaquero azul marino, piel verde ──────────────────────────────
# Clases por color: C = azul de camisa, P = azul de pantalón, D = azul dudoso, G = piel, '' = no tocar
def clases_normal(r, g, b):
    h, s, v = tono(r, g, b)
    if v < 0.10 or s < 0.1:
        return ''
    if 60 <= h <= 130:
        return 'G'
    if 185 <= h <= 206:
        return 'C'
    if 206 < h < 211:
        return 'D'
    if 211 <= h <= 250:
        return 'P'
    return ''


def decide_normal(c, n, cerca, cabeza):
    if c == 'G':
        return 'piel'
    # el propio píxel vota por cuatro: solo cambia de bando si está rodeado (brillos del vaquero)
    camisa = n.get('C', 0) + (4 if c == 'C' else 0)
    pantalon = n.get('P', 0) + (4 if c == 'P' else 0)
    return 'camisa' if camisa >= pantalon else 'pantalon'


# ── Zombi lento: camisa marrón, sin pantalón, piel verde, tripas rojas ───────────────────────────────
# C = marrón de camisa, B = marrón oscuro (sombra de camisa, pelo o tripas), O = oliva, G = piel, R = sangre
def clases_lento(r, g, b):
    h, s, v = tono(r, g, b)
    if v < 0.10:
        return ''
    if 60 <= h <= 130:
        return 'G'
    if (h <= 12 or h >= 345) and s >= 0.72:
        return 'R'
    if 22 <= h <= 32:
        return 'C'
    if 32 < h < 60:
        return 'O'
    return 'B'


def decide_lento(c, n, cerca, cabeza):
    piel, camisa, sangre, oscuro = n.get('G', 0) + n.get('O', 0), n.get('C', 0), n.get('R', 0), n.get('B', 0)
    if c in ('G', 'O'):
        return 'piel'
    if cabeza:
        return None                                          # marrón en la cabeza: pelo o suciedad de la cara
    junto = sum(cerca.values())                              # píxeles con color a 2 casillas (él incluido)
    if junto <= 9:
        return None                                          # trozo muy fino: un dedo
    if cerca.get('G', 0) + cerca.get('O', 0) >= 0.25 * junto:
        return None                                          # pegado a la piel: sombra de la mano o de un desgarrón
    if c == 'C':
        return 'camisa' if camisa >= piel else None          # marrón suelto entre piel: suciedad, se deja
    if c == 'B':
        # sombra de la camisa solo si alrededor hay bastante camisa; si no, es pelo o tripas
        total = piel + camisa + sangre + oscuro
        return 'camisa' if camisa >= 0.3 * total and camisa > sangre and camisa > piel else None
    return None


# Dónde está la cara del zombi lento en el fotograma quieto de cada dirección (píxeles dentro de su casilla) y
# hacia dónde cae el pelo desde ahí. De espaldas (y en diagonal de espaldas) no hace falta: el pelo se distingue solo.
CABEZA_LENTO = {
    'radio': 8,
    'south': (40, 58, 0, -3), 'south-east': (57, 57, -1, -3), 'south-west': (35, 56, 1, -3),
    'east': (63, 53, -3, -3), 'west': (33, 50, 3, -3),
}

ZOMBIS = {
    # el 3: cada píxel mira 3 casillas a cada lado. El último número: los trozos de camisa sueltos con menos
    # píxeles que eso no se pintan (en el lento son puntas de dedos y motas entre las tripas)
    'zombi-normal': (clases_normal, decide_normal, 3, None, 0),
    'zombi-lento':  (clases_lento, decide_lento, 3, CABEZA_LENTO, 20),
}


def cabezas(cls, meta, cfg):
    """Píxeles que son cabeza. En cada fila de la hoja se sigue la cara de fotograma en fotograma: se parte de
    donde está en el dibujo quieto y se va al centro de la piel que haya cerca (la cara es la mancha de piel
    más grande). La cabeza es un círculo alrededor, corrido hacia el pelo."""
    cw, ch = meta['cell']
    radio = cfg['radio']
    zona = set()
    for anim in meta['anims'].values():
        for d, fila in anim['dirs'].items():
            if d not in cfg:
                continue
            fx, fy, ox, oy = cfg[d]
            for f in range(fila['frames']):
                x0, y0 = (fila.get('col', 0) + f) * cw, fila['row'] * ch
                for _ in range(3):
                    sx = sy = n = 0
                    for y in range(max(0, round(fy) - 7), min(ch, round(fy) + 8)):
                        for x in range(max(0, round(fx) - 7), min(cw, round(fx) + 8)):
                            if cls[y0 + y][x0 + x] in ('G', 'O') and (x - fx) ** 2 + (y - fy) ** 2 <= 49:
                                sx += x; sy += y; n += 1
                    if n < 6:
                        break
                    fx, fy = sx / n, sy / n
                cx, cy = fx + ox, fy + oy
                for y in range(max(0, int(cy) - radio), min(ch, int(cy) + radio + 2)):
                    for x in range(max(0, int(cx) - radio), min(cw, int(cx) + radio + 2)):
                        if (x - cx) ** 2 + (y - cy) ** 2 <= radio * radio:
                            zona.add((x0 + x, y0 + y))
    return zona


def mascara(im, zombi):
    """Para cada píxel, qué prenda es ('camisa', 'pantalon', 'piel'); los que no se tocan no salen."""
    clases, decide, radio, cabeza, suelto = ZOMBIS[zombi]
    w, h = im.size
    px = im.load()
    cls = [[''] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a:
                cls[y][x] = clases(r, g, b)
    with open(f'assets/sprites/{zombi}.json', encoding='utf-8') as f:
        zona = cabezas(cls, json.load(f), cabeza) if cabeza else set()
    out = {}
    for y in range(h):
        fila = cls[y]
        for x in range(w):
            c = fila[x]
            if not c:
                continue
            n, cerca = {}, {}       # vecinos por clase: a `radio` casillas y a 2 casillas
            for yy in range(max(0, y - radio), min(h, y + radio + 1)):
                f = cls[yy]
                for xx in range(max(0, x - radio), min(w, x + radio + 1)):
                    k = f[xx]
                    if k:
                        n[k] = n.get(k, 0) + 1
                        if abs(yy - y) <= 2 and abs(xx - x) <= 2:
                            cerca[k] = cerca.get(k, 0) + 1
            prenda = decide(c, n, cerca, (x, y) in zona)
            if prenda:
                out[(x, y)] = prenda
    # fuera los trozos de camisa pequeños y aislados
    vistos = set()
    for p0 in [p for p, v in out.items() if v == 'camisa']:
        if p0 in vistos or not suelto:
            continue
        trozo, cola = [p0], [p0]
        vistos.add(p0)
        while cola:
            x, y = cola.pop()
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q not in vistos and out.get(q) == 'camisa':
                    vistos.add(q); trozo.append(q); cola.append(q)
        if len(trozo) < suelto:
            for q in trozo:
                del out[q]
    return out


def rangos(im, mask):
    """Lo oscuro y lo claro de cada prenda en el original (sin contar el 2 % de cada extremo)."""
    px = im.load()
    por = {}
    for (x, y), prenda in mask.items():
        por.setdefault(prenda, []).append(luz(*px[x, y][:3]))
    r = {}
    for prenda, ls in por.items():
        ls.sort()
        r[prenda] = (ls[len(ls) * 2 // 100], ls[len(ls) * 98 // 100])
    return r


def en_escala(escala, t):
    """Color de la escala en el punto t (0 = sombra, 1 = luz), mezclando los dos más cercanos."""
    t = max(0.0, min(1.0, t)) * (len(escala) - 1)
    i = min(int(t), len(escala) - 2)
    f = t - i
    return tuple(round(escala[i][k] + (escala[i + 1][k] - escala[i][k]) * f) for k in range(3))


def variante(zombi, nombre, im, mask, rng):
    out = im.copy()
    px = out.load()
    escalas = {p: [rgb(c) for c in ESCALAS[p][nombre]] for p in ESCALAS if ESCALAS[p][nombre]}
    for (x, y), prenda in mask.items():
        if prenda in escalas:
            r, g, b, a = px[x, y]
            lo, hi = rng[prenda]
            px[x, y] = (*en_escala(escalas[prenda], (luz(r, g, b) - lo) / (hi - lo)), a)
    out.save(f'assets/sprites/{zombi}-{nombre}.png')
    shutil.copyfile(f'assets/sprites/{zombi}.json', f'assets/sprites/{zombi}-{nombre}.json')
    print(f'{zombi}-{nombre}')


def mapa(zombi, im, mask):
    """Hoja de comprobación: camisa en azul, pantalón en naranja, piel en verde, lo demás en gris."""
    color = {'camisa': (40, 140, 255), 'pantalon': (255, 150, 0), 'piel': (0, 210, 0)}
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                v = round(luz(r, g, b))
                px[x, y] = (*color.get(mask.get((x, y)), (v, v, v)), a)
    out.save(f'assets/pruebas/{zombi}-mapa-variantes.png')
    print(f'assets/pruebas/{zombi}-mapa-variantes.png')


if __name__ == '__main__':
    zombi = sys.argv[1]
    que = sys.argv[2] if len(sys.argv) > 2 else None
    im = Image.open(f'assets/sprites/{zombi}.png').convert('RGBA')
    mask = mascara(im, zombi)
    if que == '--mapa':
        mapa(zombi, im, mask)
    else:
        rng = rangos(im, mask)
        for nombre in VARIANTES:
            if que in (None, nombre):
                variante(zombi, nombre, im, mask, rng)
