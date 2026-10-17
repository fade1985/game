"""Mueble suelto traído por el dueño (imagen grande de Gemini/ChatGPT con fondo transparente) → sprite del juego.

  py tools/mueble_dueno.py <imagen> <tipo> [ancho]

Quita el fondo y los restos blancos de alrededor, recorta, reduce a `ancho` píxeles (36 por defecto) y le pone el
contorno oscuro de los demás muebles. Deja `assets/sprites/mueble-<tipo>.png` y su `.json` con `"scale": 0.5`:
cada píxel mide 1 unidad del juego (el doble de detalle que el pixel art de los personajes), así que el mueble
ocupa en pantalla `ancho` unidades de ancho.

Ejemplo: py tools/mueble_dueno.py assets/sources/muebles/maceta-pasillo.webp plant
"""
import json, sys
from PIL import Image

OUTLINE = (29, 27, 44, 255)


def main(src, tipo, w=36):
    im = Image.open(src).convert('RGBA')
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            # fondo transparente y el halo blanco que deja la IA alrededor de las hojas
            if a < 128 or (min(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 30): px[x, y] = (0, 0, 0, 0)
            else: px[x, y] = (r, g, b, 255)
    im = im.crop(im.getbbox())
    h = round(w * im.size[1] / im.size[0])
    # color medio de cada píxel nuevo, contando solo lo que no es fondo
    color = im.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
    lleno = im.getchannel('A').resize((w, h), Image.BOX)
    out = Image.new('RGBA', (w + 2, h + 1))  # sitio para el contorno a los lados y arriba
    for y in range(h):
        for x in range(w):
            if lleno.getpixel((x, y)) > 110:
                r, g, b, _ = color.getpixel((x, y))
                out.putpixel((x + 1, y + 1), (r, g, b, 255))
    # contorno: cada hueco vacío pegado al dibujo
    W, H = out.size
    borde = [(x, y) for y in range(H) for x in range(W) if out.getpixel((x, y))[3] == 0 and any(
        0 <= x + dx < W and 0 <= y + dy < H and out.getpixel((x + dx, y + dy))[3] == 255 and out.getpixel((x + dx, y + dy)) != OUTLINE
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for p in borde: out.putpixel(p, OUTLINE)
    out.save(f'assets/sprites/mueble-{tipo}.png')
    meta = {'cell': [W, H], 'pivot': [W // 2, H], 'scale': 0.5,
            'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}}}
    with open(f'assets/sprites/mueble-{tipo}.json', 'w', encoding='utf-8') as f: json.dump(meta, f, indent=2)
    print(f'mueble-{tipo}: {W} × {H} píxeles')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 36)
