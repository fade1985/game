"""Mete en la hoja de sprites de un personaje la animación de andar que ha generado PixelLab.

Los fotogramas se guardan en assets/sources/<sprite>/walk/<dirección>-<n>.png (uno por fotograma,
tal como los da PixelLab). Este script los coloca debajo de lo que ya tenga la hoja (las rotaciones
y el reposo) y apunta la animación `walk` en el JSON.

Cada fotograma se alinea con el dibujo quieto de esa dirección: mismos pies en el suelo y mismo centro,
para que al pasar de estar parado a andar el personaje no dé un saltito.

Uso (desde la carpeta del proyecto; necesita Python con Pillow):
  python tools/walk.py conserje-48                 rehace assets/sprites/conserje-48.png y .json
  python tools/walk.py conserje-48 --gif salida    además guarda un GIF de comprobación en esa carpeta
"""
import json, os, sys
from PIL import Image

SPRITE = sys.argv[1]
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
SRC = f'assets/sources/{SPRITE}/walk'
PNG, JSON_ = f'assets/sprites/{SPRITE}.png', f'assets/sprites/{SPRITE}.json'

meta = json.load(open(JSON_, encoding='utf-8'))
CW, CH = meta['cell']
sheet = Image.open(PNG).convert('RGBA')

# filas que ya había antes de la de andar (si se vuelve a ejecutar, la de andar se rehace)
old_walk = meta['anims'].get('walk')
keep_rows = min(d['row'] for d in old_walk['dirs'].values()) if old_walk else sheet.height // CH
rot = meta['anims'].get('still') or meta['anims']['idle']


def still(d):
    r = rot['dirs'][d]
    c = r.get('col', 0)
    return sheet.crop((c * CW, r['row'] * CH, (c + 1) * CW, (r['row'] + 1) * CH))


def same_colors(im, ref):
    """Pinta el fotograma solo con los colores del dibujo quieto de esa dirección (el más parecido a cada uno).
    PixelLab redibuja al personaje y los tonos se le van un poco; así, al echar a andar no cambia de color."""
    palette = [c[:3] for _, c in ref.getcolors(4096) if c[3]]
    cache = {}
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            key = (r, g, b)
            if key not in cache:
                cache[key] = min(palette, key=lambda p: 3 * (p[0] - r) ** 2 + 6 * (p[1] - g) ** 2 + (p[2] - b) ** 2)
            px[x, y] = (*cache[key], 255)
    return out


frames = {}
for d in DIRS:
    # <dirección>-<n>.png con n seguido desde 0 (ojo: "south-*" a secas también cogería los de "south-east")
    files = []
    while os.path.exists(f'{SRC}/{d}-{len(files)}.png'):
        files.append(f'{SRC}/{d}-{len(files)}.png')
    assert files, f'faltan los fotogramas de {d} en {SRC}'
    fs = [same_colors(Image.open(f).convert('RGBA'), still(d)) for f in files]
    # pies al mismo nivel que el dibujo quieto, y centrado en horizontal según el primer fotograma
    ref = still(d).getbbox()
    feet = max(f.getbbox()[3] for f in fs)
    b0 = fs[0].getbbox()
    dx = round(((ref[0] + ref[2]) - (b0[0] + b0[2])) / 2)
    dy = ref[3] - feet
    out = []
    for f in fs:
        cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        cell.paste(f, (dx + (CW - f.width) // 2, dy + (CH - f.height) // 2), f)  # si se sale del lienzo, se recorta
        out.append(cell)
    frames[d] = out
    print(f'{d:11s} {len(fs)} fotogramas, desplazados ({dx}, {dy})')

n = max(len(fs) for fs in frames.values())
width = max(sheet.crop((0, 0, sheet.width, keep_rows * CH)).getbbox()[2], n * CW)
width = -(-width // CW) * CW  # el ancho justo para lo que hay, en casillas enteras
out = Image.new('RGBA', (width, (keep_rows + len(DIRS)) * CH), (0, 0, 0, 0))
out.alpha_composite(sheet.crop((0, 0, sheet.width, keep_rows * CH)), (0, 0))
for r, d in enumerate(DIRS):
    for i, f in enumerate(frames[d]):
        out.alpha_composite(f, (i * CW, (keep_rows + r) * CH))
out.save(PNG)

meta['anims']['walk'] = {
    'fps': 12, 'loop': True,
    'dirs': {d: {'row': keep_rows + r, 'frames': len(frames[d])} for r, d in enumerate(DIRS)},
}
json.dump(meta, open(JSON_, 'w', encoding='utf-8', newline='\n'), indent=2, ensure_ascii=False)
print('hoja:', out.size)

if '--gif' in sys.argv:
    folder = sys.argv[sys.argv.index('--gif') + 1]
    G = 5
    gif = []
    for i in range(n):
        im = Image.new('RGBA', (4 * CW * G, 2 * CH * G), (70, 74, 82, 255))
        for k, d in enumerate(DIRS):
            f = frames[d][i % len(frames[d])]
            im.alpha_composite(f.resize((CW * G, CH * G), Image.NEAREST), ((k % 4) * CW * G, (k // 4) * CH * G))
        gif.append(im.convert('RGB'))
    gif[0].save(f'{folder}/{SPRITE}-walk.gif', save_all=True, append_images=gif[1:], duration=83, loop=0)
    print('GIF guardado')
