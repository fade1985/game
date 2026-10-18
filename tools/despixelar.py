"""Despixelar: convierte "falso pixel art" (el de Gemini, donde cada píxel del dibujo es un
bloque de ~10-20 píxeles reales, a veces no todos iguales y con bordes borrosos) en pixel art de verdad.

Uso:
  py tools/despixelar.py entrada.png [--salida X.png] [--fondo auto|#ff00ff] [--colores 12]
                                     [--paso N] [--sin-contorno]

Saca dos archivos junto a la entrada (o donde diga --salida):
  <nombre>-pixel.png   el pixel art real, a su tamaño de verdad, con fondo transparente
  <nombre>-ver.png     lo mismo ampliado x10 sobre gris, para comprobarlo a ojo

Pasos: 1) detectar la rejilla (tamaño del bloque, puede no ser entero, y su desfase);
2) un color por bloque (mediana de su zona central); 3) quitar el fondo; 4) juntar colores
casi iguales y poner contorno de 1 píxel (#1d1b2c) donde falte.
"""
import argparse
import math
import os
import sys
from collections import Counter

from PIL import Image, ImageChops

CONTORNO = (0x1D, 0x1B, 0x2C)
UMBRAL_CAMBIO = 40  # suma de |diferencias| RGB para decir "aquí cambia el color"


# ---------------------------------------------------------------- rejilla

def _perfil(img, eje):
    """Para cada columna (eje=0) o fila (eje=1): fracción de píxeles donde el color cambia
    fuerte respecto a la vecina."""
    w, h = img.size
    if eje == 0:
        a, b = img.crop((0, 0, w - 1, h)), img.crop((1, 0, w, h))
    else:
        a, b = img.crop((0, 0, w, h - 1)), img.crop((0, 1, w, h))
    d = ImageChops.difference(a, b)
    r, g, bl = d.split()
    suma = ImageChops.add(ImageChops.add(r, g), bl)  # satura en 255: vale para el umbral
    fuerte = suma.point(lambda v: 255 if v > UMBRAL_CAMBIO else 0)
    if eje == 0:
        fila = fuerte.resize((w - 1, 1), Image.BOX)
    else:
        fila = fuerte.resize((1, h - 1), Image.BOX)
    return [v / 255.0 for v in fila.tobytes()]


def _bordes(perfil):
    """Posiciones de los bordes de bloque: grupos de posiciones seguidas con muchos cambios
    (un borde borroso ocupa 2-3). Devuelve [(posición, fuerza)]; la posición es la línea
    entre el píxel i y el i+1, o sea i+1."""
    if not perfil:
        return []
    positivos = sorted(v for v in perfil if v > 0.02)
    if not positivos:
        return []
    # referencia robusta (no el máximo: un marco o una raya suelta lo estropearía)
    ref = positivos[int(len(positivos) * 0.8)]
    corte = max(0.4 * ref, 0.03)
    grupos, actual = [], []
    for i, v in enumerate(perfil):
        if v >= corte:
            actual.append((i, v))
        elif actual:
            grupos.append(actual)
            actual = []
    if actual:
        grupos.append(actual)
    res = []
    for g in grupos:
        peso = sum(v for _, v in g)
        pos = sum((i + 1) * v for i, v in g) / peso
        res.append((pos, peso))
    return res


def _ajuste(bordes, paso):
    """Cuánto encajan los bordes en una rejilla de ese paso: (R, fase). R=1 es perfecto."""
    sx = sy = tot = 0.0
    for pos, peso in bordes:
        ang = 2 * math.pi * pos / paso
        sx += peso * math.cos(ang)
        sy += peso * math.sin(ang)
        tot += peso
    if tot == 0:
        return 0.0, 0.0
    r = math.hypot(sx, sy) / tot
    fase = (math.atan2(sy, sx) / (2 * math.pi)) * paso
    return r, fase


def detectar_rejilla(perfil, tam, paso_fijo=None):
    """Devuelve (paso, inicio) de una dimensión. Elige el paso MÁS GRANDE que encaje bien
    con los bordes (un paso la mitad de grande también encajaría, pero sería falso)."""
    bordes = _bordes(perfil)
    if len(bordes) < 3:
        raise SystemExit("No encuentro una rejilla clara (casi no hay cambios de color). "
                         "Prueba con --paso N si sabes el tamaño del bloque.")
    if paso_fijo:
        mejor = (paso_fijo, _ajuste(bordes, paso_fijo)[1])
    else:
        mejor = None
        minimo = max(4.0, tam / 400.0)
        paso = min(120.0, tam / 6.0)
        candidatos = []
        while paso >= minimo:
            r, fase = _ajuste(bordes, paso)
            candidatos.append((paso, r, fase))
            paso -= 0.02
        # el mayor paso con encaje casi tan bueno como el mejor
        rmax = max(c[1] for c in candidatos)
        for paso, r, fase in candidatos:
            if r >= max(0.85, rmax - 0.06):
                mejor = (paso, fase)
                break
        if mejor is None:
            mejor = (candidatos[0][0], candidatos[0][2])
    paso, fase = mejor
    # refinar con una recta: posición = inicio + k*paso (ajuste por mínimos cuadrados)
    for _ in range(3):
        ks, ps = [], []
        for pos, peso in bordes:
            k = round((pos - fase) / paso)
            if abs(pos - (fase + k * paso)) <= max(1.5, 0.15 * paso):
                ks.append(k)
                ps.append(pos)
        if len(ks) < 3 or paso_fijo:
            break
        n = len(ks)
        mk, mp = sum(ks) / n, sum(ps) / n
        var = sum((k - mk) ** 2 for k in ks)
        if var == 0:
            break
        paso = sum((k - mk) * (p - mp) for k, p in zip(ks, ps)) / var
        fase = mp - paso * mk
    return paso, fase % paso


# ---------------------------------------------------------------- celdas

def _mediana(valores):
    valores = sorted(valores)
    return valores[len(valores) // 2]


def muestrear(img, sx, ox, sy, oy):
    """Un color por bloque: mediana de su zona central (sin los bordes, que son borrosos)."""
    w, h = img.size
    # columnas/filas de bloques que cubren al menos la mitad dentro de la imagen
    kx0 = math.floor((0 - ox) / sx)
    kx1 = math.ceil((w - ox) / sx)
    ky0 = math.floor((0 - oy) / sy)
    ky1 = math.ceil((h - oy) / sy)
    xs = [k for k in range(kx0, kx1) if min(w, ox + (k + 1) * sx) - max(0, ox + k * sx) >= 0.5 * sx]
    ys = [k for k in range(ky0, ky1) if min(h, oy + (k + 1) * sy) - max(0, oy + k * sy) >= 0.5 * sy]
    px = img.load()
    celdas = []
    for ky in ys:
        fila = []
        y0, y1 = max(0, oy + ky * sy), min(h, oy + (ky + 1) * sy)
        my = (y1 - y0) * 0.25
        ya, yb = int(round(y0 + my)), int(round(y1 - my))
        yb = max(yb, ya + 1)
        for kx in xs:
            x0, x1 = max(0, ox + kx * sx), min(w, ox + (kx + 1) * sx)
            mx = (x1 - x0) * 0.25
            xa, xb = int(round(x0 + mx)), int(round(x1 - mx))
            xb = max(xb, xa + 1)
            rs, gs, bs = [], [], []
            for y in range(ya, min(yb, h)):
                for x in range(xa, min(xb, w)):
                    r, g, b = px[x, y][:3]
                    rs.append(r)
                    gs.append(g)
                    bs.append(b)
            fila.append((_mediana(rs), _mediana(gs), _mediana(bs)))
        celdas.append(fila)
    return celdas


# ---------------------------------------------------------------- colores y fondo

def dist(a, b):
    return math.sqrt(sum((p - q) ** 2 for p, q in zip(a, b)))


def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def _hex(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def _caja(mat):
    ys = [y for y, f in enumerate(mat) if any(c is not None for c in f)]
    xs = [x for x in range(len(mat[0])) if any(f[x] is not None for f in mat)]
    return (xs[0], ys[0], xs[-1], ys[-1]) if ys else None


def _clave(c):
    return tuple(v // 24 * 24 for v in c)


def _inundar(mat, caja, refs):
    """Quita (pone None) el fondo conectado con el borde de `caja`. Devuelve cuántas casillas quitó."""
    x0, y0, x1, y1 = caja
    oscuro = all(luma(r) < 70 for r in refs)
    if oscuro:
        es_fondo = lambda c: c is not None and luma(c) < 55 and min(dist(c, r) for r in refs) < 50  # fondo oscuro: se come también el contorno (luego se repone)
    else:
        es_fondo = lambda c: c is not None and min(dist(c, r) for r in refs) < 60
    borde = [(x, y) for x in range(x0, x1 + 1) for y in (y0, y1)] + [(x, y) for y in range(y0, y1 + 1) for x in (x0, x1)]
    pila = [(x, y) for x, y in borde if es_fondo(mat[y][x])]
    quitadas = set(pila)
    while pila:
        x, y = pila.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if x0 <= nx <= x1 and y0 <= ny <= y1 and (nx, ny) not in quitadas and es_fondo(mat[ny][nx]):
                quitadas.add((nx, ny))
                pila.append((nx, ny))
    for x, y in quitadas:
        mat[y][x] = None
    return len(quitadas)


def _refs_borde(mat, caja, minimo):
    """Colores que ocupan al menos `minimo` (fracción) del borde de la caja."""
    x0, y0, x1, y1 = caja
    borde = [(x, y) for x in range(x0, x1 + 1) for y in (y0, y1)] + [(x, y) for y in range(y0, y1 + 1) for x in (x0, x1)]
    borde = [mat[y][x] for x, y in borde if mat[y][x] is not None]
    cuenta = Counter(_clave(c) for c in borde)
    comunes = [k for k, n in cuenta.most_common(3) if n >= minimo * len(borde)]
    refs = []
    for k in comunes:
        m = [c for c in borde if _clave(c) == k]
        refs.append(tuple(_mediana([q[i] for q in m]) for i in range(3)))
    return refs, (sum(n for k, n in cuenta.items() if k in comunes) / len(borde) if borde else 0)


def quitar_fondo(celdas, fondo):
    """Devuelve una matriz con None donde hay fondo. Rellena desde los bordes; si el fondo
    es un marco dentro de otro (p. ej. margen blanco + cuadros oscuros), repite."""
    mat = [list(f) for f in celdas]
    caja = _caja(mat)
    if fondo != "auto":
        _inundar(mat, caja, [_hex(fondo)])
        return mat
    refs, _ = _refs_borde(mat, caja, 0.15)
    if not refs:
        return mat
    _inundar(mat, caja, refs)
    for _ in range(2):
        caja = _caja(mat)
        if not caja:
            break
        refs, cubierto = _refs_borde(mat, caja, 0.15)
        x0, y0, x1, y1 = caja
        area = (x1 - x0 + 1) * (y1 - y0 + 1)
        usadas = sum(1 for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)
                     if mat[y][x] is not None and any(dist(mat[y][x], r) < 60 for r in refs))
        # solo si es un marco de verdad: casi todo el borde y mucha superficie
        if refs and cubierto >= 0.85 and usadas >= 0.35 * area:
            _inundar(mat, caja, refs)
        else:
            break
    return mat


def juntar_colores(mat, maximo):
    """Junta colores casi iguales; si quedan más de `maximo`, sube la tolerancia."""
    cuenta = Counter(c for fila in mat for c in fila if c is not None)
    if not cuenta:
        return mat
    for umbral in range(14, 200, 4):
        paleta = []  # [color, peso]
        for c, n in cuenta.most_common():
            if luma(c) < 70 and dist(c, CONTORNO) < umbral + 20:
                c = CONTORNO  # lo oscuro se convierte en el contorno de siempre
            for p in paleta:
                if dist(c, p[0]) <= umbral:
                    p[1] += n
                    break
            else:
                paleta.append([c, n])
        if len(paleta) <= maximo:
            break
    refs = [p[0] for p in paleta]

    def cercano(c):
        if luma(c) < 70 and dist(c, CONTORNO) < umbral + 20:
            return CONTORNO
        return min(refs, key=lambda r: dist(c, r))

    cache = {}
    return [[None if c is None else cache.setdefault(c, cercano(c)) for c in fila] for fila in mat]


def contorno(mat, forzar=False):
    """Añade 1 píxel de contorno alrededor si el dibujo no lo trae ya. Deja margen de 1 casilla."""
    h, w = len(mat), len(mat[0])
    g = [[None] * (w + 2) for _ in range(h + 2)]
    for y in range(h):
        for x in range(w):
            g[y + 1][x + 1] = mat[y][x]
    H, W = h + 2, w + 2
    borde = []
    for y in range(H):
        for x in range(W):
            if g[y][x] is None:
                continue
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if not (0 <= nx < W and 0 <= ny < H) or g[ny][nx] is None:
                    borde.append((x, y))
                    break
    oscuros = sum(1 for x, y in borde if luma(g[y][x]) < 70)
    if borde and oscuros >= 0.7 * len(borde) and not forzar:
        return g  # ya tiene contorno
    nuevo = [fila[:] for fila in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] is None and any(
                0 <= nx < W and 0 <= ny < H and g[ny][nx] is not None
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            ):
                nuevo[y][x] = CONTORNO
    return nuevo


def recortar(mat, margen=1):
    ys = [y for y, f in enumerate(mat) if any(c is not None for c in f)]
    xs = [x for x in range(len(mat[0])) if any(f[x] is not None for f in mat)]
    if not ys:
        raise SystemExit("Al quitar el fondo no queda nada. Prueba --fondo con el color exacto del fondo.")
    y0, y1, x0, x1 = ys[0], ys[-1], xs[0], xs[-1]
    out = []
    for y in range(y0 - margen, y1 + margen + 1):
        fila = []
        for x in range(x0 - margen, x1 + margen + 1):
            ok = 0 <= y < len(mat) and 0 <= x < len(mat[0])
            fila.append(mat[y][x] if ok else None)
        out.append(fila)
    return out


def a_imagen(mat):
    h, w = len(mat), len(mat[0])
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        for x in range(w):
            if mat[y][x] is not None:
                px[x, y] = mat[y][x] + (255,)
    return im


# ---------------------------------------------------------------- principal

def despixelar(ruta, fondo="auto", colores=12, paso=None, con_contorno=True):
    img = Image.open(ruta)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        base = Image.new("RGBA", img.size, (255, 0, 255, 255)) if fondo == "auto" else Image.new(
            "RGBA", img.size, _hex(fondo) + (255,))
        base.alpha_composite(img)
        img = base
    img = img.convert("RGB")
    w, h = img.size
    sx, ox = detectar_rejilla(_perfil(img, 0), w, paso)
    sy, oy = detectar_rejilla(_perfil(img, 1), h, paso)
    celdas = muestrear(img, sx, ox, sy, oy)
    mat = quitar_fondo(celdas, fondo)
    mat = juntar_colores(mat, colores)
    mat = recortar(mat, 0)
    if con_contorno:
        mat = contorno(mat)
    mat = recortar(mat, 0)
    return a_imagen(mat), (sx, sy)


def main():
    ap = argparse.ArgumentParser(description="Convierte falso pixel art de Gemini en pixel art real.")
    ap.add_argument("entrada")
    ap.add_argument("--salida", help="PNG de salida (por defecto <entrada>-pixel.png)")
    ap.add_argument("--fondo", default="auto", help="auto, o un color como #ff00ff")
    ap.add_argument("--colores", type=int, default=12, help="máximo de colores (12)")
    ap.add_argument("--paso", type=float, help="tamaño del bloque, si la detección falla")
    ap.add_argument("--sin-contorno", action="store_true", help="no añadir contorno")
    a = ap.parse_args()
    base = os.path.splitext(a.entrada)[0]
    salida = a.salida or base + "-pixel.png"
    im, (sx, sy) = despixelar(a.entrada, a.fondo, a.colores, a.paso, not a.sin_contorno)
    im.save(salida)
    ver = os.path.splitext(salida)[0].removesuffix("-pixel") + "-ver.png"
    fondo = Image.new("RGBA", (im.width * 10, im.height * 10), (128, 128, 128, 255))
    fondo.alpha_composite(im.resize((im.width * 10, im.height * 10), Image.NEAREST))
    fondo.convert("RGB").save(ver)
    datos = im.tobytes()
    n = len({datos[i:i + 3] for i in range(0, len(datos), 4) if datos[i + 3]})
    print(f"{im.width}x{im.height} px, {n} colores (bloque {sx:.2f}x{sy:.2f}) -> {salida}")


if __name__ == "__main__":
    sys.exit(main())
