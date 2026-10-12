"""Hoja de revisión: todos los fotogramas de una carpeta de PixelLab (<dirección>-<n>.png), ampliados,
una fila por dirección y con el número de cada fotograma. Para mirar una animación antes de montarla.

Uso:  py tools/hoja.py <carpeta de fotogramas> <salida.png> [dirección ...]
"""
import os, sys
from PIL import Image, ImageDraw

folder, out = sys.argv[1], sys.argv[2]
DIRS = sys.argv[3:] or ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
rows = {}
for d in DIRS:
    fs = []
    while os.path.exists(f'{folder}/{d}-{len(fs)}.png'):
        fs.append(Image.open(f'{folder}/{d}-{len(fs)}.png').convert('RGBA'))
    if fs:
        rows[d] = fs
W = max(f.width for fs in rows.values() for f in fs)
H = max(f.height for fs in rows.values() for f in fs)
N = max(len(fs) for fs in rows.values())
Z = 2
sheet = Image.new('RGBA', (N * W * Z, len(rows) * H * Z), (60, 60, 70, 255))
draw = ImageDraw.Draw(sheet)
for r, (d, fs) in enumerate(rows.items()):
    for i, f in enumerate(fs):
        big = f.resize((f.width * Z, f.height * Z), Image.NEAREST)
        sheet.alpha_composite(big, (i * W * Z + (W - f.width) * Z // 2, r * H * Z + (H - f.height) * Z // 2))
        draw.text((i * W * Z + 3, r * H * Z + 2), f'{d} {i}', fill=(255, 255, 255, 255))
sheet.save(out)
print(out, sheet.size)
