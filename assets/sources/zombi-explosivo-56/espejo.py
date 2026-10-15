"""Rellena una dirección con la contraria reflejada (cuando PixelLab la giraba o no merecía gastar en ella).
El fotograma 0 se cambia por la vista quieta de verdad de esa dirección, colocada en el mismo sitio.

Uso:  py assets/sources/zombi-explosivo-56/espejo.py <animación> <origen> <destino>
      (p. ej.  walk north-east north-west)
"""
import os, sys
from PIL import Image, ImageOps

BASE = 'assets/sources/zombi-explosivo-56'
anim, src, dst = sys.argv[1:4]
n = 0
while os.path.exists(f'{BASE}/{anim}/{src}-{n}.png'):
    ImageOps.mirror(Image.open(f'{BASE}/{anim}/{src}-{n}.png').convert('RGBA')).save(f'{BASE}/{anim}/{dst}-{n}.png')
    n += 1
f0 = Image.open(f'{BASE}/{anim}/{src}-0.png').convert('RGBA')
quieto = Image.open(f'{BASE}/rotations/{src}.png').convert('RGBA')
a, b = f0.getbbox(), quieto.getbbox()
ox, oy = a[0] - b[0], a[1] - b[1]
nuevo = Image.open(f'{BASE}/rotations/{dst}.png').convert('RGBA')
c = Image.new('RGBA', f0.size, (0, 0, 0, 0))
c.paste(nuevo, (f0.width - ox - nuevo.width, oy), nuevo)
c.save(f'{BASE}/{anim}/{dst}-0.png')
print(f'{anim}: {dst} = {src} reflejado ({n} fotogramas)')
