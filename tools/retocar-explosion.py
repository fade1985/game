# Retoca la explosión de PixelLab (18 oct 2026): el dueño no quería los círculos del principio.
#  - fotograma 1: destello blanco con puntas (sin contorno, es luz)
#  - fotogramas 2-3: bola de fuego irregular en vez de la bola redonda
#  - fotogramas 4-6: fuera el aro de la onda expansiva (y la bola del 4 recortada irregular)
# Lee el original (assets/sources/efectos/explosion.png, rejilla 4x3) y escribe la tira del juego.
# Uso: py tools/retocar-explosion.py
import math, random, os
from PIL import Image

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(RAIZ, 'assets', 'sprites', 'objeto-fx-explosion.png')
rejilla = Image.open(os.path.join(RAIZ, 'assets', 'sources', 'efectos', 'explosion.png')).convert('RGBA')
img = Image.new('RGBA', (12 * 96, 96))
for f in range(12):
    img.paste(rejilla.crop(((f % 4) * 96, (f // 4) * 96, (f % 4) * 96 + 96, (f // 4) * 96 + 96)), (f * 96, 0))

W = (255, 255, 255, 255); PALE = (255, 243, 168, 255); YEL = (255, 208, 74, 255); ORA = (255, 154, 42, 255)
RED = (240, 90, 28, 255); DRED = (194, 42, 20, 255); OUT = (27, 4, 4, 255); T = (0, 0, 0, 0)
C = 48  # centro de la celda (96x96)

def outline(fr):
    """Pone contorno oscuro a los píxeles opacos que tocan un hueco transparente."""
    px = fr.load(); add = []
    for y in range(96):
        for x in range(96):
            if px[x, y][3] == 0: continue
            if px[x, y] == OUT: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < 96 and 0 <= ny < 96) or px[nx, ny][3] == 0:
                    add.append((x, y)); break
    for p in add: px[p] = OUT
    # fuera los puntos de contorno sueltos (restos del aro): contorno que no toca color
    quitar = [(x, y) for y in range(96) for x in range(96) if px[x, y] == OUT and not any(
        0 <= x + dx < 96 and 0 <= y + dy < 96 and px[x + dx, y + dy][3] and px[x + dx, y + dy] != OUT
        for dx in (-1, 0, 1) for dy in (-1, 0, 1))]
    for p in quitar: px[p] = T

def quitar_aro(fr, rmin):
    px = fr.load()
    for y in range(96):
        for x in range(96):
            if px[x, y][3] and math.hypot(x + 0.5 - C, y + 0.5 - C) >= rmin:
                # las chispas blancas sueltas se quedan
                if px[x, y] == W and all(px[x + dx, y + dy][3] == 0 or px[x + dx, y + dy] == W
                                         for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < 96 and 0 <= y + dy < 96):
                    continue
                px[x, y] = T
    outline(fr)

def forma(base, puntas, amp, seed, m0=0.06, m1=0.15):
    """Radio que cambia con el ángulo: ondas al azar + puntas."""
    rnd = random.Random(seed)
    ondas = [(k, rnd.uniform(0, 6.28), rnd.uniform(m0, m1)) for k in (3, 4, 7)]
    fases = rnd.uniform(0, 6.28)
    def R(a):
        r = 1 + sum(m * math.sin(k * a + f) for k, f, m in ondas)
        r += amp * max(0, math.cos(puntas * a + fases)) ** 6
        return base * r
    return R

def recortar(fr, R):
    """Recorta la bola redonda del original con una forma irregular."""
    px = fr.load()
    for y in range(96):
        for x in range(96):
            dx, dy = x + 0.5 - C, y + 0.5 - C
            if px[x, y][3] and math.hypot(dx, dy) > R(math.atan2(dy, dx)): px[x, y] = T
    outline(fr)

def fogonazo(base, puntas, amp, colores, cortes, seed, borde, m0=0.06, m1=0.15):
    """Mancha de luz irregular."""
    R = forma(base, puntas, amp, seed, m0, m1)
    fr = Image.new('RGBA', (96, 96), T); px = fr.load()
    for y in range(96):
        for x in range(96):
            dx, dy = x + 0.5 - C, y + 0.5 - C
            d = math.hypot(dx, dy) / R(math.atan2(dy, dx))
            if d > 1: continue
            for c, lim in zip(colores, cortes):
                if d <= lim: px[x, y] = c; break
    if borde: outline(fr)
    return fr

frames = [img.crop((f * 96, 0, f * 96 + 96, 96)) for f in range(12)]
# 1: destello blanco con puntas, sin contorno (es luz)
frames[0] = fogonazo(9, 7, 0.9, [W, PALE, YEL], [0.55, 0.8, 1], 3, False)
# 2: bola de fuego que nace, irregular
frames[1] = fogonazo(13, 9, 0.3, [W, PALE, YEL, ORA, RED], [0.35, 0.55, 0.72, 0.88, 1], 5, True, 0.04, 0.09)
frames[2] = fogonazo(18, 6, 0.22, [W, PALE, YEL, ORA, RED, DRED], [0.2, 0.38, 0.56, 0.72, 0.87, 1], 21, True)
# 3-6: fuera el aro de la onda expansiva
for f, r in ((3, 22.3), (4, 27), (5, 30.5)):
    quitar_aro(frames[f], r)
recortar(frames[3], forma(19, 7, 0.3, 33, 0.07, 0.13))

out = Image.new('RGBA', img.size, T)
for f, fr in enumerate(frames): out.paste(fr, (f * 96, 0))
out.save(SRC)
