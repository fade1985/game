"""Añade tildes, ñ, ü, ¿ y ¡ a la fuente pixel generada por PixelLab (no las trae).
Uso: py tools/fuente-tildes.py   -> escribe assets/fuentes/zombie-scape-ui.ttf (sobre sí misma)"""
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

RUTA = 'assets/fuentes/zombie-scape-ui.ttf'
P = 64  # unidades por píxel de la fuente (1024 / 16)
f = TTFont(RUTA)
gs = f.getGlyphSet()
cmap = f.getBestCmap()
orden = list(f.getGlyphOrder())

def rect(pen, x, y, w=1, h=1):
    x0, y0, x1, y1 = x * P, y * P, (x + w) * P, (y + h) * P
    pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()

def marcas(tipo, ancho_px, base_y):
    c = ancho_px // 2 - 1  # columna central aproximada
    if tipo == 'agudo':   return [(c + 1, base_y), (c, base_y + 1)]
    if tipo == 'tilde':   return [(c - 1, base_y), (c, base_y + 1), (c + 1, base_y), (c + 2, base_y + 1)]
    if tipo == 'dieresis': return [(c - 1, base_y, 1, 2), (c + 2, base_y, 1, 2)]

nuevos = {}
def acentuada(car, base, tipo):
    n = cmap[ord(base)]
    ancho = f['hmtx'][n][0]
    mayus = base.isupper() or base == 'l'
    y = 11 if (mayus or base == 'i') else 9
    pen = TTGlyphPen(gs)
    gs[n].draw(pen)
    for m in marcas(tipo, ancho // P, y):
        rect(pen, *m) if len(m) == 4 else rect(pen, m[0], m[1])
    nuevos[car] = (pen.glyph(), ancho)

for car, base, tipo in [('á','a','agudo'),('é','e','agudo'),('í','i','agudo'),('ó','o','agudo'),('ú','u','agudo'),
                        ('Á','A','agudo'),('É','E','agudo'),('Í','I','agudo'),('Ó','O','agudo'),('Ú','U','agudo'),
                        ('ñ','n','tilde'),('Ñ','N','tilde'),('ü','u','dieresis'),('Ü','U','dieresis')]:
    acentuada(car, base, tipo)

# ¿ y ¡ : el ? y el ! dados la vuelta (el alto de mayúscula es 10 píxeles)
for car, base in [('¿','?'),('¡','!')]:
    n = cmap[ord(base)]
    pen = TTGlyphPen(gs)
    gs[n].draw(TransformPen(pen, (1, 0, 0, -1, 0, 10 * P)))
    nuevos[car] = (pen.glyph(), f['hmtx'][n][0])

glyf, hmtx = f['glyf'], f['hmtx']
for car, (g, adv) in nuevos.items():
    nombre = 'uni%04X' % ord(car)
    glyf[nombre] = g
    orden.append(nombre)
    hmtx[nombre] = (adv, 0)
    for t in f['cmap'].tables:
        if t.isUnicode(): t.cmap[ord(car)] = nombre
f.setGlyphOrder(orden)
f['maxp'].numGlyphs = len(orden)
f.save(RUTA)
print('añadidas:', ''.join(nuevos))
