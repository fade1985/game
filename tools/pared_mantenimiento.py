# Monta la pared de la sala de mantenimiento (960 unidades de ancho, la sala entera, sin repetirse) con tres
# imágenes del dueño: mantenimiento-pared-sangre-1 (NO ESCAPE a la izquierda, un salpicón grande a la derecha)
# y mantenimiento-pared-sangre-2 (salpicones sueltos, de relleno). Las tres se ajustan en alto (la línea del
# zócalo estaba a alturas distintas) y en color (por filas) antes de unirlas con bordes difuminados.
# Uso: py tools/pared_mantenimiento.py
import json
from PIL import Image

D = 'assets/sources/suelos/'
im1 = Image.open(D + 'mantenimiento-pared-sangre-1.png').convert('RGB')
im2 = Image.open(D + 'mantenimiento-pared-sangre-2.png').convert('RGB')


def alinear(seg, puntos):
    """Estira por tramos en vertical: puntos = [(y de origen, y de destino)...] de 0 a 256."""
    out = Image.new('RGB', seg.size)
    for (a0, b0), (a1, b1) in zip(puntos, puntos[1:]):
        tramo = seg.crop((0, a0, seg.size[0], a1)).resize((seg.size[0], b1 - b0), Image.LANCZOS)
        out.paste(tramo, (0, b0))
    return out


def perfil(seg):
    """Percentil 75 de cada fila por canal: el fondo es más claro que el texto y la sangre, que no lo mueven."""
    w, h = seg.size
    out = []
    for y in range(h):
        px = [seg.getpixel((x, y)) for x in range(0, w, 2)]
        out.append([sorted(p[c] for p in px)[len(px) * 3 // 4] for c in range(3)])
    return out


def igualar(seg, ref):
    """Corrige el color fila a fila para que case con el perfil de referencia."""
    p = perfil(seg)
    h = seg.size[1]
    dif = [[ref[y][c] - p[y][c] for c in range(3)] for y in range(h)]
    suave = [[sum(dif[min(h - 1, max(0, y + k))][c] for k in range(-6, 7)) / 13 for c in range(3)] for y in range(h)]
    out = seg.copy()
    for y in range(h):
        d = [max(-45, min(45, v)) for v in suave[y]]
        for x in range(seg.size[0]):
            r, g, b = seg.getpixel((x, y))
            out.putpixel((x, y), (max(0, min(255, round(r + d[0]))), max(0, min(255, round(g + d[1]))), max(0, min(255, round(b + d[2])))))
    return out


A = im1.crop((0, 0, 512, 256))                                   # NO ESCAPE
B = alinear(im1.crop((512, 0, 1024, 256)), [(0, 0), (176, 180), (256, 256)])   # salpicón grande
C = alinear(im2, [(0, 0), (160, 180), (238, 248), (256, 256)])   # relleno
# referencia de color: la pared lisa de antes (sin manchas), su mitad derecha
lisa = Image.open(D + 'mantenimiento-pared.png').convert('RGB').crop((520, 0, 1024, 256))
ref = perfil(lisa)
A, B, C = igualar(A, ref), igualar(B, ref), igualar(C, ref)

ANCHO = 2560  # 960 unidades / 0,375 unidades por píxel de la imagen original
lienzo = Image.new('RGB', (ANCHO, 256))
# relleno: la imagen de salpicones repetida, con las uniones difuminadas
x = 0
while x < ANCHO:
    pieza = C if (x // 1024) % 2 == 0 else C.transpose(Image.FLIP_LEFT_RIGHT)
    if x:
        mascara = Image.linear_gradient('L').rotate(90).resize((48, 256))  # 0 -> 255 de izquierda a derecha
        lienzo.paste(pieza.crop((0, 0, 48, 256)), (x, 0), mascara)
        lienzo.paste(pieza.crop((48, 0, 1024, 256)), (x + 48, 0))
    else:
        lienzo.paste(pieza, (0, 0))
    x += 1024 - 48


def pegar(seg, x0, borde=48):
    w = seg.size[0]
    m = Image.new('L', (w, 256), 255)
    for i in range(borde):
        v = round(255 * i / borde)
        for y in range(256):
            m.putpixel((i, y), v)
            m.putpixel((w - 1 - i, y), v)
    lienzo.paste(seg, (x0, 0), m)


pegar(A, 150)    # NO ESCAPE: de la unidad 56 a la 248, a la izquierda de la puerta (que está en el centro)
pegar(B, 1493)   # el salpicón grande, a la derecha de la puerta

ALTO = 192
pared = lienzo.resize((ANCHO * ALTO // 256, ALTO), Image.LANCZOS)
pared.save('assets/sprites/pared-mantenimiento.png')
meta = {'cell': list(pared.size), 'pivot': [0, 0], 'scale': 0.25, 'suave': True,
        'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}}}
json.dump(meta, open('assets/sprites/pared-mantenimiento.json', 'w'), indent=2)

# moldura del techo (3 franjas con los colores del zócalo), del mismo ancho
techo = Image.new('RGB', (pared.size[0], 24))
for y in range(24):
    col = (150, 146, 120) if y < 8 else (118, 115, 95) if y < 16 else (76, 68, 51)
    for x in range(pared.size[0]):
        techo.putpixel((x, y), col)
techo.save('assets/sprites/techo-mantenimiento.png')
meta['cell'] = [pared.size[0], 24]
json.dump(meta, open('assets/sprites/techo-mantenimiento.json', 'w'), indent=2)
print('pared-mantenimiento', pared.size)
