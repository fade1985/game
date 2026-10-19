"""Pasa sprites con más detalle que los personajes ("scale" 0,5 o 0,25 en su .json) a la densidad de Johnny.

  py tools/densidad.py                  todos los que tengan "scale" menor que 1 (menos los de NO_TOCAR)
  py tools/densidad.py suelo-bano-a     solo esos

Cada bloque de 2×2 (o 4×4) píxeles pasa a ser uno, con el color medio (contando la transparencia: lo recortado,
como las armas del suelo, o se ve entero o no se ve). El .json queda con "scale": 1 y sin "suave". Es lo mismo
que hacía la prueba de la tecla O (19 oct), con visto bueno del dueño: todo el juego a una sola densidad.
"""
import glob, json, os, sys
from PIL import Image

OUT = 'assets/sprites'
NO_TOCAR = {'zombi-tentaculos-gpt'}  # dibujo provisional, no se usa en el juego


def reduce(im, f):
    """f×f píxeles → 1, con el color medio de lo que no es transparente"""
    im = im.convert('RGBA')
    w, h = -(-im.width // f), -(-im.height // f)
    if im.width % f or im.height % f:  # que el borde no quede a medias
        lienzo = Image.new('RGBA', (w * f, h * f))
        lienzo.paste(im, (0, 0))
        im = lienzo
    color = im.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
    lleno = im.getchannel('A').resize((w, h), Image.BOX).point(lambda a: 255 if a >= 128 else 0)
    color.putalpha(lleno)
    return color


def convierte(sid):
    ruta = f'{OUT}/{sid}.json'
    meta = json.load(open(ruta, encoding='utf-8'))
    scale = meta.get('scale', 1)
    if scale >= 1:
        return False
    f = round(1 / scale)
    im = Image.open(f'{OUT}/{sid}.png')
    una = list(im.size) == meta['cell']  # hoja de un solo dibujo: la celda es la imagen entera
    im = reduce(im, f)
    im.save(f'{OUT}/{sid}.png')
    meta['cell'] = list(im.size) if una else [meta['cell'][0] // f, meta['cell'][1] // f]
    if 'pivot' in meta:
        meta['pivot'] = [-(-meta['pivot'][0] // f), -(-meta['pivot'][1] // f)]  # hacia arriba: los pies siguen en el borde de abajo
    meta['scale'] = 1
    meta.pop('suave', None)
    with open(ruta, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(meta, fh, indent=2); fh.write('\n')
    print(f'  {sid}: /{f} -> {im.width}x{im.height}')
    return True


if __name__ == '__main__':
    ids = sys.argv[1:] or sorted(os.path.basename(p)[:-5] for p in glob.glob(f'{OUT}/*.json')
                                 if os.path.basename(p) != 'manifest.json' and os.path.basename(p)[:-5] not in NO_TOCAR)
    hechos = sum(convierte(s) for s in ids)
    print(f'{hechos} convertidos')
