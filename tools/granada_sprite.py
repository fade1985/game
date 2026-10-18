"""Granada en pixel art, 15x20 (18 oct 2026). Es la granada pixelada del dueño (19x27, en
assets/sources/efectos/granada.png) redibujada un poco más pequeña, con sus mismos colores: gajos, espoleta,
anilla, palanca y pintura saltada. Escribe:
  assets/sprites/objeto-granada.png   (objeto del suelo y del vuelo; el .json lleva cell 15x20)
  assets/ui/iconos/granada.png        (icono del HUD, la misma granada centrada en 32x32)
  py tools/granada_sprite.py
"""
from PIL import Image
C = {'K': (29, 27, 44), 'i': (62, 67, 36), 'h': (86, 93, 49), 'f': (115, 122, 68), 'k': (134, 140, 76),
     'l': (190, 201, 126), 'c': (93, 96, 88), 'd': (66, 67, 62), 'j': (140, 142, 130), 'e': (112, 102, 88), 'r': (160, 162, 148)}
G = [
    "...ccccccce..",
    "...jccd.r..e.",
    "...jccdr.r.e.",
    "...jccd.r..e.",
    "...kffffh..e.",
    ".kkkfffhhh.e.",
    "kkkkfffjhhhe.",
    "iiiiiiiiiii.e",
    "kllikffihhh.e",
    "kkkikffihhh.e",
    "kkkikffihhh.e",
    "iiiiiiiiiii.e",
    "kkkikffihhh.e",
    "kkkikffihjh.e",
    "kkkikffihhh..",
    "iiiiiiiiiii..",
    ".kkikffihh...",
    "..hhhhhhh....",
]
W, H = len(G[0]), len(G)
o = Image.new('RGBA', (W + 2, H + 2), (0, 0, 0, 0)); q = o.load()
for y, row in enumerate(G):
    assert len(row) == W, (y, len(row))
    for x, ch in enumerate(row):
        if ch != '.': q[x + 1, y + 1] = C[ch] + (255,)
K = C['K'] + (255,); add = []
for y in range(o.height):
    for x in range(o.width):
        if q[x, y][3] == 0 and any(0 <= x + dx < o.width and 0 <= y + dy < o.height and q[x + dx, y + dy][3] and q[x + dx, y + dy] != K
                                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            add.append((x, y))
for a in add: q[a] = K
o.save('assets/sprites/objeto-granada.png')
lienzo = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
lienzo.paste(o, ((32 - o.width) // 2, (32 - o.height) // 2))
lienzo.save('assets/ui/iconos/granada.png')
print('Hecho:', o.size)
