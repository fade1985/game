"""Plantillas para pedir a ChatGPT los fondos de las estancias (ver docs/FONDOS.md).

Cada plantilla es la estancia vacía, al tamaño de la imagen que da ChatGPT, con:
  - la franja de la pared del fondo arriba (gris claro) y el suelo debajo (gris, con la cuadrícula de casillas);
  - Johnny de pie, para que ChatGPT sepa de qué tamaño tiene que dibujar los muebles;
  - en verde, el suelo que tiene que quedar libre: delante de la puerta y un paso hasta el centro
    (con la puerta arriba, también el tramo de pared donde irá la puerta).
Las medidas van en casillas de 16 píxeles de arte (32 unidades del juego, unos 60 cm de verdad).

Uso (desde la carpeta del proyecto):  py tools/plantilla_fondo.py      → assets/plantillas/*.png
"""
import os
from PIL import Image, ImageDraw

OUT = 'assets/plantillas'
C = 16                      # una casilla, en píxeles de arte
PARED = 3                   # alto de la pared del fondo, en casillas
# nombre: (casillas de ancho, casillas de alto contando la pared, tamaño de la imagen de ChatGPT)
TAM = {
    'pequeno': (9, 9, (1024, 1024)),
    'mediano': (12, 12, (1024, 1024)),
    'grande':  (18, 12, (1536, 1024)),
}
PUERTAS = ('abajo', 'izquierda', 'derecha', 'arriba')
MURO, SUELO, RAYA, LIBRE = (196, 190, 180), (128, 132, 140), (112, 116, 124), (120, 190, 120)


def johnny():
    im = Image.open('assets/sources/conserje-48-guardia/rotations/south.png').convert('RGBA')
    # sin la fregona no hay dibujo quieto de 48: vale este, que mide lo mismo (46 píxeles de alto)
    return im.crop(im.getbbox())


def plantilla(cols, rows, size, puerta):
    w, h = cols * C, rows * C
    im = Image.new('RGBA', (w, h), SUELO + (255,))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w - 1, PARED * C - 1], fill=MURO)
    # suelo libre: tres casillas delante de la puerta y un paso de tres casillas hasta el centro
    fy = PARED * C
    cx, cy = w // 2, fy + (h - fy) // 2
    if puerta == 'abajo':
        d.rectangle([cx - 24, cy - 8, cx + 23, h - 1], fill=LIBRE)
    elif puerta == 'izquierda':
        d.rectangle([0, cy - 24, cx + 8, cy + 23], fill=LIBRE)
    elif puerta == 'derecha':
        d.rectangle([cx - 8, cy - 24, w - 1, cy + 23], fill=LIBRE)
    else:
        # puerta en la pared del fondo: también queda libre ese tramo de pared (sin muebles ni adornos)
        d.rectangle([cx - 24, 0, cx + 23, cy + 8], fill=LIBRE)
    for x in range(0, w, C):
        d.line([x, fy, x, h - 1], fill=RAYA)
    for y in range(fy, h, C):
        d.line([0, y, w - 1, y], fill=RAYA)
    d.line([0, fy, w - 1, fy], fill=(60, 56, 54))
    j = johnny()
    im.alpha_composite(j, (cx - j.width // 2 + {'abajo': 0, 'izquierda': 40, 'derecha': -40, 'arriba': 44}[puerta], cy + 20 - j.height))
    return im.resize(size, Image.NEAREST).convert('RGB')


os.makedirs(OUT, exist_ok=True)
for nombre, (cols, rows, size) in TAM.items():
    for p in PUERTAS:
        f = f'{OUT}/{nombre}-puerta-{p}.png'
        plantilla(cols, rows, size, p).save(f)
        print(f, f'{cols * C}×{rows * C} de arte → {size[0]}×{size[1]}')
