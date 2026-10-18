"""Dibuja la granada en pixel art, píxel a píxel (18 oct 2026), siguiendo el diseño del dueño
(assets/sources/efectos/granada.png: piña verde oliva con gajos, palanca al lado y anilla arriba).
Al reducir ese dibujo salía borroso y se perdía la anilla, así que aquí se pinta a mano a 16x22:
  assets/sprites/objeto-granada.png   (objeto del suelo y del vuelo; el .json lleva cell 16x22)
  assets/ui/iconos/granada.png        (icono del HUD, la misma granada centrada en 32x32)
  py tools/granada_sprite.py
"""
from PIL import Image
C = {
    'K': (29, 27, 44), 'd': (38, 42, 20), '1': (66, 72, 34), '2': (98, 106, 52), '3': (132, 140, 76),
    '4': (184, 190, 124), 'm': (62, 64, 60), 'n': (104, 106, 98), 'o': (140, 142, 130), 'r': (168, 170, 150),
}
W, H = 14, 20
g = [['.'] * W for _ in range(H)]
# cuerpo ovalado (filas 4-19), gajos separados por ranuras en las columnas 3 y 7 y las filas 8, 12, 16
anchos = {4: (2, 8), 5: (1, 9), 18: (1, 9), 19: (2, 8)}
for y in range(4, 20):
    a, b = anchos.get(y, (0, 10))
    for x in range(a, b + 1):
        if x in (3, 7) or y in (8, 12, 16):
            c = 'd'
        else:
            seg = 0 if x < 3 else 1 if x < 7 else 2   # columna de gajos: izquierda clara, derecha oscura
            c = ['3', '2', '1'][seg]
            if x in (0, 10) or y in (19,): c = ['2', '1', 'd'][seg] if x != 0 else '2'
            if y in (9, 13, 17) and seg < 2 and x in (1, 4): c = '4' if (seg == 0 and y == 9) else '3'  # brillo arriba-izquierda de cada gajo
        g[y][x] = c
g[5][4] = '3'; g[5][5] = '3'; g[6][1] = '4'; g[6][2] = '3'; g[9][2] = '4'
# boca de la espoleta (metal) y la cabeza de la palanca encima
for y in range(1, 4):
    for x in range(3, 8):
        g[y][x] = 'n' if x < 6 else 'm'
    g[y][3] = 'o'
for x in range(2, 9): g[0][x] = '3' if x < 7 else '2'
# palanca: baja pegada al lado derecho
g[0][9] = '2'
for y in range(1, 16):
    x = 9 if y < 2 else 10 if y < 4 else 11
    g[y][x] = '2'
    if y >= 4: g[y][12 if y < 15 else 11] = '1' if y < 15 else '1'
# anilla (encima de la palanca, arriba a la derecha)
for x, y in [(10, 0), (11, 0), (12, 0), (9, 1), (13, 1), (9, 2), (13, 2), (10, 3), (11, 3), (12, 3)]:
    g[y][x] = 'r'

out = Image.new('RGBA', (W + 2, H + 2), (0, 0, 0, 0)); q = out.load()
for y in range(H):
    for x in range(W):
        if g[y][x] != '.': q[x + 1, y + 1] = C[g[y][x]] + (255,)
add = []
for y in range(H + 2):
    for x in range(W + 2):
        if q[x, y][3]: continue
        if any(0 <= x + dx < W + 2 and 0 <= y + dy < H + 2 and q[x + dx, y + dy][3] and q[x + dx, y + dy][:3] != C['K']
               for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            add.append((x, y))
for a in add: q[a] = C['K'] + (255,)
out.save('assets/sprites/objeto-granada.png')
lienzo = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
lienzo.paste(out, ((32 - out.width) // 2, (32 - out.height) // 2))
lienzo.save('assets/ui/iconos/granada.png')
print('Hecho:', out.size)
