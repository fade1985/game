"""Monta salas vacías (solo pared del fondo y suelo, sin muebles) para pasárselas a Gemini como plantilla.

El suelo sale de un trozo limpio de la referencia (assets/sources/fondos/referencia-encuadre.png) y los colores
de la pared también; el resto (rejilla de azulejos, zócalo, manchas) se dibuja aquí. Salidas en assets/plantillas/.

Uso (desde la carpeta del proyecto):  py tools/sala_vacia.py
"""
import random
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

REF = 'assets/sources/fondos/referencia-encuadre.png'
OUT = 'assets/plantillas'

# tamaño de imagen y casillas (ancho, alto) como en docs/FONDOS.md; la pared mide 3 casillas de alto
TAMANOS = {
    'pequeno': ((1024, 1024), (9, 9)),
    'mediano': ((1024, 1024), (12, 12)),
    'grande': ((1536, 1024), (18, 12)),
}
# variantes de color: (tono del suelo, tono de la pared); ver tinte()
VARIANTES = {
    'a-azul': ((0.85, 1.0, 1.35), (1.0, 1.0, 1.0)),
    'b-verde': ((0.85, 1.05, 0.9), (0.9, 1.0, 0.92)),
    'c-marron': ((1.15, 0.95, 0.8), (1.05, 0.95, 0.85)),
}


def tinte(im, rgb):
    r, g, b = im.split()
    return Image.merge('RGB', (r.point(lambda v: min(255, int(v * rgb[0]))),
                               g.point(lambda v: min(255, int(v * rgb[1]))),
                               b.point(lambda v: min(255, int(v * rgb[2])))))


def mediana(ref, caja):
    zona = sorted(ref.crop(caja).get_flattened_data() if hasattr(ref, 'get_flattened_data') else ref.crop(caja).getdata(),
                  key=lambda p: sum(p))
    return zona[len(zona) // 2]


def mult(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def manchas(img, rnd, color, n, rmin, rmax, alfa):
    w, h = img.size
    for _ in range(n):
        x, y, r = rnd.randrange(w), rnd.randrange(h), rnd.randrange(rmin, rmax)
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).ellipse((x - r, y - r, x + r, y + r), fill=rnd.randrange(*alfa))
        img.paste(Image.new('RGB', (w, h), color), (0, 0), m.filter(ImageFilter.GaussianBlur(r / 2)))


def grietas(d, rnd, w, h, color, n):
    for _ in range(n):
        x, y = rnd.randrange(w), rnd.randrange(h)
        pts = [(x, y)]
        for _ in range(rnd.randrange(3, 8)):
            x += rnd.randrange(-35, 36); y += rnd.randrange(-35, 36)
            pts.append((x, y))
        d.line(pts, fill=color, width=2)


def rejilla(img, rnd, paso, color, jitter):
    # azulejos con un tono ligeramente distinto cada uno y juntas oscuras
    w, h = img.size
    d = ImageDraw.Draw(img)
    for x in range(0, w, paso):
        for y in range(0, h, paso):
            k = 1 + rnd.uniform(-jitter, jitter)
            tile = img.crop((x, y, x + paso, y + paso))
            img.paste(ImageEnhance.Brightness(tile).enhance(k), (x, y))
    for x in range(0, w, paso):
        d.line([(x, 0), (x, h)], fill=color, width=2)
    for y in range(0, h, paso):
        d.line([(0, y), (w, y)], fill=color, width=2)


def suelo(ref, w, h, casilla, rnd):
    base = mediana(ref, (200, 560, 330, 640))  # baldosa azul limpia de la referencia
    img = Image.new('RGB', (w, h), base)
    manchas(img, rnd, mult(base, 0.55), 25, 20, 70, (20, 50))
    rejilla(img, rnd, casilla // 2, mult(base, 0.55), 0.06)
    grietas(ImageDraw.Draw(img), rnd, w, h, mult(base, 0.4), 10)
    return img


def pared(ref, w, h, casilla, rnd):
    base = mediana(ref, (380, 195, 420, 290))  # azulejo beis limpio de la referencia
    img = Image.new('RGB', (w, h), base)
    manchas(img, rnd, mult(base, 0.6), 30, 10, 50, (15, 45))
    rejilla(img, rnd, casilla // 2, mult(base, 0.7), 0.05)
    grietas(ImageDraw.Draw(img), rnd, w, h, mult(base, 0.45), 4)
    d = ImageDraw.Draw(img)
    d.rectangle((0, h - 22, w, h), fill=mult(base, 0.45))  # zócalo
    d.line([(0, h - 23), (w, h - 23)], fill=mult(base, 0.6), width=3)
    return img


def montar(nombre, variante):
    (w, h), (cx, cy) = TAMANOS[nombre]
    casilla = w // cx
    rnd = random.Random(f'{nombre}-{variante}')
    ref = Image.open(REF).convert('RGB')
    tono_suelo, tono_pared = VARIANTES[variante]
    alto_pared = casilla * 3
    sala = suelo(ref, w, h, casilla, rnd)
    sala.paste(pared(ref, w, alto_pared, casilla, rnd), (0, 0))
    # tinte por zonas
    pared_t = tinte(sala.crop((0, 0, w, alto_pared)), tono_pared)
    suelo_t = tinte(sala.crop((0, alto_pared, w, h)), tono_suelo)
    sala.paste(pared_t, (0, 0)); sala.paste(suelo_t, (0, alto_pared))
    # sombra suave de la pared sobre el suelo
    sombra = Image.new('L', (w, 40))
    for y in range(40):
        ImageDraw.Draw(sombra).line([(0, y), (w, y)], fill=int(90 * (1 - y / 40)))
    sala.paste(Image.new('RGB', (w, 40), (10, 10, 20)), (0, alto_pared), sombra)
    ruta = f'{OUT}/sala-vacia-{nombre}-{variante}.png'
    sala.save(ruta)
    print(ruta, sala.size)


if __name__ == '__main__':
    for nombre in TAMANOS:
        for variante in VARIANTES:
            montar(nombre, variante)
