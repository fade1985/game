"""Hace un GIF ampliado de una animación bajada de PixelLab, sobre fondo gris claro.
Uso: py gif.py <carpeta> <dirección> <salida.gif> [ms por fotograma]"""
import glob, sys
from PIL import Image
carpeta, d, salida = sys.argv[1:4]
ms = int(sys.argv[4]) if len(sys.argv) > 4 else 110
fs = sorted(glob.glob(f'{carpeta}/{d}-*.png'), key=lambda f: int(f.split('-')[-1][:-4]))
C = 160
frames = []
for f in fs:
    im = Image.open(f).convert('RGBA')
    bg = Image.new('RGBA', (C, C), (200, 200, 196, 255))
    bg.alpha_composite(im, ((C - im.width) // 2, C - im.height))
    frames.append(bg.convert('RGB').resize((C * 2, C * 2), Image.NEAREST))
frames[0].save(salida, save_all=True, append_images=frames[1:], duration=ms, loop=0)
