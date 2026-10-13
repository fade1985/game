"""Bocetos para pedir a ChatGPT los fondos de las estancias (ver docs/FONDOS.md).

Cada boceto es una estancia con la pared del fondo arriba, el suelo debajo y **un bloque de color con su nombre
por cada mueble**, ya colocado y a su tamaño de verdad. ChatGPT pinta cada mueble dentro de su bloque: así
respeta la escala y deja libre lo demás (se probó a pedírselo de palabra, con Johnny de referencia y una zona
verde, y no lo respetó).

Las medidas van en píxeles de arte (16 = una casilla = 32 unidades del juego, unos 60 cm de verdad) y salen de
la referencia reducida a la escala realista que eligió el dueño (el váter le llega a Johnny a la cintura).
Los baños no llevan puerta en la pared del fondo. Cada distribución dice por qué lados puede tener puerta.

Uso (desde la carpeta del proyecto):  py tools/plantilla_fondo.py
  → assets/plantillas/<nombre>.png   el boceto, al tamaño de la imagen que da ChatGPT
  → assets/plantillas/<nombre>.json  dónde está cada mueble (para los choques) y por dónde puede ir la puerta
"""
import glob, json, os
from PIL import Image, ImageDraw, ImageFont

OUT = 'assets/plantillas'
C = 16
WALL = 48                   # alto de la pared del fondo
MURO, SUELO, RAYA = (196, 190, 180), (128, 132, 140), (118, 122, 130)

# Muebles contra la pared del fondo: ancho, cuánto suben por la pared y cuánto ocupan de suelo; color y nombre.
FONDO = {
    'banera':   (64, 10, 26, (90, 150, 210), 'BATHTUB'),
    'ducha':    (30, 40, 28, (80, 190, 200), 'SHOWER'),
    'lavabo':   (20, 18, 13, (220, 150, 70), 'SINK'),
    'vater':    (15, 14, 16, (225, 225, 120), 'TOILET'),
    'lavadora': (17, 16, 14, (170, 120, 200), 'WASHER'),
    'armario':  (20, 34, 10, (160, 110, 70), 'CABINET'),
    'papelera': (9, 3, 10, (110, 170, 110), 'BIN'),
}
# Cosas colgadas de la pared (no se choca con ellas): ancho, de qué altura a qué altura de la pared
PARED = {
    'espejo':   (21, 8, 24, (150, 200, 230), 'MIRROR'),
    'toallero': (16, 14, 30, (60, 90, 170), 'TOWEL'),
}
ALFOMBRA = (30, 16, (90, 170, 150), 'MAT')
BANERA_LADO = (27, 64, (90, 150, 210), 'BATHTUB')     # a lo largo del muro izquierdo

# nombre: (ancho, alto, tamaño de la imagen de ChatGPT, puertas posibles, piezas)
# piezas: ('tipo', x) contra la pared del fondo o colgado de ella; ('alfombra', x, y); ('banera-lado',)
BOCETOS = {
    'bano-pequeno-1': (144, 144, (1024, 1024), ['abajo', 'izquierda', 'derecha'], [
        ('banera', 4), ('lavabo', 78), ('espejo', 77), ('toallero', 101), ('papelera', 104), ('vater', 122),
        ('alfombra', 73, 70)]),
    'bano-pequeno-2': (144, 144, (1024, 1024), ['abajo', 'izquierda', 'derecha'], [
        ('ducha', 4), ('toallero', 38), ('lavabo', 58), ('espejo', 57), ('vater', 88), ('lavadora', 120),
        ('alfombra', 6, 82)]),
    'bano-pequeno-3': (144, 144, (1024, 1024), ['abajo', 'derecha'], [
        ('banera-lado',), ('lavabo', 46), ('espejo', 45), ('vater', 80), ('toallero', 98), ('armario', 120),
        ('alfombra', 34, 78)]),
    'bano-mediano-1': (192, 192, (1024, 1024), ['abajo', 'izquierda', 'derecha'], [
        ('banera', 6), ('lavabo', 82), ('espejo', 81), ('lavabo', 108), ('espejo', 107), ('vater', 142),
        ('papelera', 160), ('lavadora', 172), ('alfombra', 88, 74)]),
    'bano-mediano-2': (192, 192, (1024, 1024), ['abajo', 'derecha'], [
        ('banera-lado',), ('ducha', 40), ('lavabo', 84), ('espejo', 83), ('toallero', 110), ('vater', 132),
        ('armario', 164), ('alfombra', 80, 76)]),
    'bano-grande-1': (288, 192, (1536, 1024), ['abajo', 'izquierda', 'derecha'], [
        ('banera', 8), ('ducha', 84), ('toallero', 118), ('lavabo', 140), ('espejo', 139), ('lavabo', 166),
        ('espejo', 165), ('vater', 204), ('papelera', 222), ('armario', 238), ('lavadora', 264),
        ('alfombra', 24, 82), ('alfombra', 148, 74)]),
}


def cajas(piezas):
    """Cada pieza como {tipo, nombre, x, y, w, h, solido} en píxeles de arte."""
    out = []
    for p in piezas:
        t = p[0]
        if t in FONDO:
            w, sube, baja, col, nom = FONDO[t]
            out.append(dict(tipo=t, nombre=nom, x=p[1], y=WALL - sube, w=w, h=sube + baja, color=col,
                            solido=[p[1], WALL, w, baja]))
        elif t in PARED:
            w, y0, y1, col, nom = PARED[t]
            out.append(dict(tipo=t, nombre=nom, x=p[1], y=y0, w=w, h=y1 - y0, color=col, solido=None))
        elif t == 'alfombra':
            w, h, col, nom = ALFOMBRA
            out.append(dict(tipo=t, nombre=nom, x=p[1], y=p[2], w=w, h=h, color=col, solido=None))
        elif t == 'banera-lado':
            w, h, col, nom = BANERA_LADO
            out.append(dict(tipo=t, nombre=nom, x=0, y=WALL - 6, w=w, h=h + 6, color=col, solido=[0, WALL, w, h]))
    return out


def fuente(px):
    for f in ('arialbd.ttf', 'arial.ttf', 'DejaVuSans-Bold.ttf'):
        try:
            return ImageFont.truetype(f, px)
        except OSError:
            pass
    return ImageFont.load_default()


def boceto(w, h, size, piezas):
    k = size[0] / w
    im = Image.new('RGB', size, SUELO)
    d = ImageDraw.Draw(im)
    R = lambda x, y, ww, hh: [round(x * k), round(y * k), round((x + ww) * k) - 1, round((y + hh) * k) - 1]
    d.rectangle(R(0, 0, w, WALL), fill=MURO)
    for x in range(0, w, C):
        d.line([round(x * k), round(WALL * k), round(x * k), size[1]], fill=RAYA, width=2)
    for y in range(WALL, h, C):
        d.line([0, round(y * k), size[0], round(y * k)], fill=RAYA, width=2)
    d.line([0, round(WALL * k), size[0], round(WALL * k)], fill=(60, 56, 54), width=4)
    # primero lo plano y lo colgado, luego los muebles
    for c in sorted(cajas(piezas), key=lambda c: c['solido'] is not None):
        r = R(c['x'], c['y'], c['w'], c['h'])
        d.rectangle(r, fill=c['color'], outline=(30, 30, 36), width=3)
        # el nombre, lo más grande que quepa (girado si el bloque es alto y estrecho)
        bw, bh = r[2] - r[0], r[3] - r[1]
        alto = bh > bw * 1.3
        largo, corto = (bh, bw) if alto else (bw, bh)
        px = 40
        while px > 9:
            f = fuente(px)
            tw, th = d.textbbox((0, 0), c['nombre'], font=f)[2:]
            if tw <= largo - 8 and th <= corto - 4:
                break
            px -= 2
        t = Image.new('RGBA', (tw + 4, th + 8), (0, 0, 0, 0))
        ImageDraw.Draw(t).text((2, 0), c['nombre'], font=f, fill=(20, 20, 26))
        if alto:
            t = t.rotate(90, expand=True)
        im.paste(t, (r[0] + (bw - t.width) // 2, r[1] + (bh - t.height) // 2), t)
    return im


os.makedirs(OUT, exist_ok=True)
for viejo in glob.glob(f'{OUT}/*-puerta-*.png'):     # las plantillas de la primera prueba (zona verde y Johnny)
    os.remove(viejo)
for nombre, (w, h, size, puertas, piezas) in BOCETOS.items():
    boceto(w, h, size, piezas).save(f'{OUT}/{nombre}.png')
    ficha = dict(arte=[w, h], pared=WALL, puertas=puertas,
                 piezas=[{k: v for k, v in c.items() if k not in ('color',)} for c in cajas(piezas)])
    json.dump(ficha, open(f'{OUT}/{nombre}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{OUT}/{nombre}.png', f'{w}×{h} de arte → {size[0]}×{size[1]}', 'puertas:', ', '.join(puertas))
