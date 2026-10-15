"""Saca la versión "en llamas" de la hoja de un zombi (forma 2 de pintar el fuego; ver EFECTOS en zombies.js).

Uso:  py tools/quemado.py zombi-normal              (escribe assets/sprites/zombi-normal-fuego.png + .json)
      py tools/quemado.py zombi-normal --muestra    (además, assets/pruebas/fuego-<zombi>.png: original,
                                                    forma 1 y forma 2 lado a lado, para comparar)

La hoja original no se modifica. El id nuevo hay que añadirlo a assets/sprites/manifest.json.

Cómo se pinta cada píxel:
1. Se mira lo claro que es (de 0 a 1) y se busca ese punto en una escala de fuego, de la sombra a la luz:
   casi negro chamuscado → rojo oscuro → naranja → amarillo. Así el sombreado del dibujo se conserva.
2. Se mezcla con el color original (un 30 %) para que se siga reconociendo la ropa y la cara.
3. Los bordes de arriba (donde el píxel de encima está vacío) se encienden en amarillo: es la luz de las
   llamas que le suben por el cuerpo.
El contorno negro se queda tal cual.
"""
import json, os, shutil, sys
from PIL import Image

# Escala de fuego, de sombra a luz
ESCALA = ['#1a0d0a', '#4a1410', '#8c2414', '#c8401a', '#ef7a1c', '#ffb02e', '#ffe07a']
MEZCLA = 0.7          # cuánto fuego (el resto, color original)
BORDE = (255, 216, 92)  # luz de las llamas en los bordes de arriba

hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
ESC = [hexrgb(c) for c in ESCALA]


def en_escala(t):
    """Color de la escala de fuego para una claridad t (0 a 1), interpolando entre sus colores."""
    t = max(0.0, min(1.0, t)) * (len(ESC) - 1)
    i = min(int(t), len(ESC) - 2)
    k = t - i
    a, b = ESC[i], ESC[i + 1]
    return tuple(round(a[j] + (b[j] - a[j]) * k) for j in range(3))


def quemar(im):
    im = im.convert('RGBA')
    w, h = im.size
    src = im.load()
    out = im.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if a == 0 or max(r, g, b) < 12:   # vacío o contorno negro: no se toca
                continue
            lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
            # los dibujos son bastante oscuros: se estira la claridad para que llegue a los naranjas
            f = en_escala(lum * 1.25 + 0.04)
            c = tuple(round(f[j] * MEZCLA + (r, g, b)[j] * (1 - MEZCLA)) for j in range(3))
            # borde de arriba: el píxel de encima está vacío (o es contorno) → luz de las llamas
            if y > 0:
                ra, ga, ba, aa = src[x, y - 1]
                if aa == 0 or max(ra, ga, ba) < 12:
                    c = tuple(round(c[j] * 0.35 + BORDE[j] * 0.65) for j in range(3))
            dst[x, y] = (*c, a)
    return out


def forma1(im, alfa=0.6):
    """Simula la forma 1 (como hace el juego: naranja en modo "superponer", que respeta sombras y contorno)."""
    o = hexrgb('#ff9f1c')
    px = im.copy()
    d = px.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = d[x, y]
            if not a:
                continue
            ov = []
            for base, cap in zip((r, g, b), o):
                A, B = base / 255, cap / 255
                v = 2 * A * B if A < 0.5 else 1 - 2 * (1 - A) * (1 - B)
                ov.append(round(base + (v * 255 - base) * alfa))
            d[x, y] = (*ov, a)
    return px


def muestra(zombi, orig, quemada):
    meta = json.load(open(f'assets/sprites/{zombi}.json', encoding='utf-8'))
    cw, ch = meta['cell']
    d = meta['anims']['walk']['dirs']['south']
    fila = [(d.get('col', 0) + i) * cw for i in range(min(4, d['frames']))]
    trozo = lambda im, x: im.crop((x, d['row'] * ch, x + cw, d['row'] * ch + ch))
    hojas = [orig, forma1(orig), quemada]
    lienzo = Image.new('RGBA', (cw * len(fila), ch * 3), (40, 36, 44, 255))
    for j, hoja in enumerate(hojas):
        for i, x in enumerate(fila):
            lienzo.alpha_composite(trozo(hoja, x), (i * cw, j * ch))
    lienzo = lienzo.resize((lienzo.width * 3, lienzo.height * 3), Image.NEAREST)
    os.makedirs('assets/pruebas', exist_ok=True)
    ruta = f'assets/pruebas/fuego-{zombi}.png'
    lienzo.save(ruta)
    print('muestra:', ruta, '(filas: original, forma 1, forma 2)')


def main():
    zombi = sys.argv[1]
    orig = Image.open(f'assets/sprites/{zombi}.png').convert('RGBA')
    quemada = quemar(orig)
    quemada.save(f'assets/sprites/{zombi}-fuego.png', optimize=True)
    shutil.copy(f'assets/sprites/{zombi}.json', f'assets/sprites/{zombi}-fuego.json')
    print('hecho:', f'assets/sprites/{zombi}-fuego.png')
    if '--muestra' in sys.argv:
        muestra(zombi, orig, quemada)


if __name__ == '__main__':
    main()
