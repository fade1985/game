"""Maqueta del baño con el tono nuevo (oscuro, sucio, con sangre), para enseñársela al dueño sin tocar el juego.

Compone a mano una sala con las piezas de assets/sources/escenario-bano/ (pedidas a PixelLab con
create_image_pixflux, 1 generación cada una; textos e ids en assets/pixellab.json → "escenario-bano") y, al
lado, la misma sala con lo que hay ahora en el juego. Deja la imagen en assets/pruebas/bano-maqueta.png.

Uso (desde la carpeta del proyecto):  py tools/maqueta_bano.py
"""
import math
from PIL import Image, ImageDraw, ImageChops

SRC = 'assets/sources/escenario-bano'
SPR = 'assets/sprites'
S = 5                       # ampliación de la imagen final
RW, FH = 176, 124           # ancho de la sala y alto del suelo, en píxeles de arte
B = 12                      # grosor del muro de alrededor
OUT_COL = (58, 40, 32)      # muro visto desde arriba
LINE = (24, 18, 22)


def pieza(nombre, carpeta=SRC):
    im = Image.open(f'{carpeta}/{nombre}.png').convert('RGBA')
    return im.crop(im.getbbox())


def mosaico(tile, w, h):
    out = Image.new('RGBA', (w, h))
    for y in range(0, h, tile.height):
        for x in range(0, w, tile.width):
            out.paste(tile, (x, y))
    return out


def tinte(im, k):
    """Multiplica el color (k es un número o un trío) sin tocar la transparencia."""
    k = (k, k, k) if isinstance(k, (int, float)) else k
    r, g, b, a = im.split()
    r, g, b = (c.point(lambda v, f=f: min(255, int(v * f))) for c, f in zip((r, g, b), k))
    return Image.merge('RGBA', (r, g, b, a))


def sala(wall_h, suelo, pared, cosas, luz=None, oscuro=None):
    """cosas: lista de (imagen, x, y_de_abajo) ya en el orden de dibujo; x e y relativas a la esquina del suelo."""
    W, H = RW + 2 * B, B + wall_h + FH + B
    im = Image.new('RGBA', (W, H), OUT_COL + (255,))
    fx, fy = B, B + wall_h
    im.paste(mosaico(suelo, RW, FH), (fx, fy))
    im.paste(pared.crop((0, 0, RW, wall_h)) if pared.width >= RW else mosaico(pared, RW, wall_h), (fx, B))
    d = ImageDraw.Draw(im)
    d.rectangle([fx, fy - 4, fx + RW - 1, fy - 1], fill=(70, 62, 60))       # rodapié
    d.rectangle([fx, fy - 1, fx + RW - 1, fy - 1], fill=LINE)
    d.rectangle([fx, B, fx + RW - 1, B], fill=LINE)
    # sombra de la pared sobre el suelo
    sombra = Image.new('RGBA', (RW, 6), (0, 0, 0, 70))
    im.alpha_composite(sombra, (fx, fy))
    d.rectangle([fx - 1, B, fx - 1, fy + FH], fill=LINE)
    d.rectangle([fx + RW, B, fx + RW, fy + FH], fill=LINE)
    d.rectangle([fx - 1, fy + FH, fx + RW, fy + FH], fill=LINE)
    d.rectangle([fx + 72, fy + FH, fx + 104, H - 1], fill=(120, 84, 52))    # puerta, abajo
    for c, x, y in cosas:
        im.alpha_composite(c, (fx + x, fy + y - c.height))
    if oscuro:
        osc = tinte(im, oscuro)
        if luz:
            # máscara de luz: un círculo suave alrededor de cada lámpara
            m = Image.new('L', (W, H), 0)
            px = m.load()
            for yy in range(H):
                for xx in range(W):
                    v = 0
                    for lx, ly, r in luz:
                        dist = math.hypot(xx - fx - lx, (yy - fy - ly) * 1.25)
                        v = max(v, 1 - dist / r)
                    px[xx, yy] = int(255 * max(0, v) ** 1.4)
            calido = tinte(im, (1.08, 1.0, 0.82))
            osc = Image.composite(calido, osc, m)
        im = osc
    return im


# ───────────── Ahora: lo que hay en el juego ─────────────
pared_ahora = Image.new('RGBA', (28, 32), (176, 214, 230, 255))
ImageDraw.Draw(pared_ahora).rectangle([0, 0, 11, 31], fill=(160, 204, 222))
m = lambda n: pieza(n, SPR)
johnny = pieza('rotations/south', 'assets/sources/conserje-48-guardia')
zombi = pieza('rotations/west', 'assets/sources/zombi-normal-48')
ahora = sala(32, Image.open(f'{SPR}/suelo-bano.png').convert('RGBA'), pared_ahora, [
    (m('mueble-bathtub'), 6, 20), (m('mueble-sink'), 76, 14), (m('mueble-toilet'), 118, 22),
    (m('mueble-washer'), 148, 20), (johnny, 60, 96), (zombi, 118, 84),
])

# ───────────── Propuesta ─────────────
WH = 52
lav = Image.open(f'{SRC}/lavabo.png').convert('RGBA')
espejo, mueble = lav.crop((0, 0, 40, 26)), lav.crop((0, 26, 40, 80))
espejo, mueble = espejo.crop(espejo.getbbox()), mueble.crop(mueble.getbbox())
flip = lambda i: i.transpose(Image.FLIP_LEFT_RIGHT)
mugre, sangre = pieza('mugre'), pieza('sangre')
cosas = [
    # suelo: lo plano primero
    (tinte(mugre, 0.9), 96, 70), (flip(mugre), 8, 112), (tinte(mugre, 0.8), 120, 118),
    (pieza('alfombra'), 66, 62), (sangre, 44, 58), (tinte(sangre.resize((16, 16), Image.NEAREST), 0.8), 100, 104),
    (pieza('cascotes2'), 134, 104), (flip(pieza('cascotes2')), 142, 82),
    # pared
    (pieza('huellas'), 46, -14), (tinte(pieza('huellas'), 0.85), 150, -22),
    (pieza('aplique2'), 104, -22), (espejo, 74, -14), (pieza('toallero'), 112, -6 + 8),
    (pieza('papel'), 150, -2 + 6),
    # muebles apoyados en la pared, de izquierda a derecha
    (pieza('banera3'), 4, 22), (pieza('cortina'), 44, 20),
    (pieza('papelera'), 54, 20), (mueble, 72, 26), (pieza('vater'), 122, 30), (pieza('escobilla'), 150, 26),
    (johnny, 60, 100), (zombi, 118, 88),
]
suelo = tinte(Image.open(f'{SRC}/suelo2.png').convert('RGBA'), (0.92, 0.95, 1.05))
pared = tinte(Image.open(f'{SRC}/pared.png').convert('RGBA'), 0.86)
nueva = sala(WH, suelo, pared, cosas, luz=[(112, -30, 105)], oscuro=(0.58, 0.60, 0.72))

# ───────────── Las dos, lado a lado ─────────────
H = max(ahora.height, nueva.height)
hoja = Image.new('RGBA', (ahora.width + nueva.width + 12, H), (18, 16, 22, 255))
hoja.paste(ahora, (0, H - ahora.height))
hoja.paste(nueva, (ahora.width + 12, 0))
hoja = hoja.resize((hoja.width * S, hoja.height * S), Image.NEAREST)
hoja.convert('RGB').save('assets/pruebas/bano-maqueta.png')
print('assets/pruebas/bano-maqueta.png', hoja.size)
