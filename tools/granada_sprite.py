"""Convierte la captura de la granada (assets/sources/armas/granada-captura.png, con fondo gris oscuro) en:
  assets/sprites/objeto-granada.png/.json  (objeto del suelo y del vuelo, unos 12 px de alto)
  assets/ui/iconos/granada.png             (icono del HUD, 32x32)
  py tools/granada_sprite.py
"""
import json
from collections import deque
from PIL import Image

OUT = (29, 27, 44, 255)  # contorno de siempre (#1d1b2c)
im = Image.open('assets/sources/armas/granada-captura.png').convert('RGBA')
W, H = im.size
px = im.load()

def fondo(p):
    r, g, b, a = p
    return a < 40 or (r < 62 and g < 62 and b < 72 and abs(r - b) < 24) or (r > 235 and g > 235 and b > 235)

# quitar el fondo: se inunda desde los bordes con lo que parece fondo (gris oscuro o blanco del margen)
vis = [[False] * W for _ in range(H)]
dq = deque()
for x in range(W):
    dq.append((x, 0)); dq.append((x, H - 1))
for y in range(H):
    dq.append((0, y)); dq.append((W - 1, y))
while dq:
    x, y = dq.popleft()
    if x < 0 or y < 0 or x >= W or y >= H or vis[y][x] or not fondo(px[x, y]):
        continue
    vis[y][x] = True
    px[x, y] = (0, 0, 0, 0)
    dq.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
im = im.crop(im.getbbox())

def reducir(alto):
    w = max(1, round(im.width * alto / im.height))
    p = im.resize((w, alto), Image.BOX)
    q = p.load()
    for y in range(alto):
        for x in range(w):
            r, g, b, a = q[x, y]
            q[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    return p

def contorno(p):
    w, h = p.size
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(p, (1, 1))
    src, dst = out.copy().load(), out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w + 2 and 0 <= ny < h + 2 and src[nx, ny][3]:
                    dst[x, y] = OUT
                    break
    return out

s = contorno(reducir(12))
s.save('assets/sprites/objeto-granada.png')
json.dump({'cell': list(s.size), 'pivot': [s.width / 2, s.height / 2 + 1],
           'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}}},
          open('assets/sprites/objeto-granada.json', 'w'), indent=2)
ic = contorno(reducir(22))
lienzo = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
lienzo.paste(ic, ((32 - ic.width) // 2, (32 - ic.height) // 2))
lienzo.save('assets/ui/iconos/granada.png')
print(s.size, ic.size)
