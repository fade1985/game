"""Guarda una hoja de sprites en PNG lo más pequeña posible sin cambiar ni un píxel.

Si la imagen tiene 256 colores o menos (contando la transparencia), la guarda con paleta, que ocupa
mucho menos (la hoja del zombi venenoso pasó de 1,2 MB a 370 KB). Si tiene más, la guarda normal.

  from png import guardar_png
  guardar_png(hoja, 'assets/sprites/zombi-x.png')

También se puede usar suelto para recomprimir hojas ya hechas:
  py tools/png.py assets/sprites/zombi-venenoso.png
"""
import io
import sys

from PIL import Image


def _sin_perdida(im):
    """PNG más pequeño que se ve igual que im (RGBA). Los píxeles transparentes se igualan entre sí."""
    px = [(0, 0, 0, 0) if c[3] == 0 else c for c in im.get_flattened_data()]
    normal = io.BytesIO()
    plano = Image.new('RGBA', im.size)
    plano.putdata(px)
    plano.save(normal, 'PNG', optimize=True)
    colores = sorted(set(px))
    if len(colores) > 256:
        return normal.getvalue()
    indice = {c: i for i, c in enumerate(colores)}
    pal = Image.new('P', im.size)
    pal.putdata([indice[c] for c in px])
    pal.putpalette([v for c in colores for v in c[:3]])
    con_paleta = io.BytesIO()
    pal.save(con_paleta, 'PNG', optimize=True, transparency=bytes(c[3] for c in colores))
    return min(normal.getvalue(), con_paleta.getvalue(), key=len)


def guardar_png(im, ruta):
    datos = _sin_perdida(im.convert('RGBA'))
    with open(ruta, 'wb') as f:
        f.write(datos)


if __name__ == '__main__':
    for ruta in sys.argv[1:]:
        antes = open(ruta, 'rb').read()
        im = Image.open(io.BytesIO(antes)).convert('RGBA')
        datos = _sin_perdida(im)
        igual = all(a == b or (a[3] == 0 and b[3] == 0) for a, b in
                    zip(im.get_flattened_data(), Image.open(io.BytesIO(datos)).convert('RGBA').get_flattened_data()))
        if igual and len(datos) < len(antes):
            open(ruta, 'wb').write(datos)
            print(f'{ruta}: {len(antes) // 1024} KB -> {len(datos) // 1024} KB')
        else:
            print(f'{ruta}: se queda como está')
