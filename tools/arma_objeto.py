"""Las armas como objeto suelto (en su mueble de la sala de mantenimiento y en el suelo), en pixel art dibujado con
código: un píxel = una unidad del juego ("scale": 0.5 en el .json). El origen (pivote) es la empuñadura y el arma
apunta a la derecha, igual que `drawWeapon` de src/weapons.js, que sigue valiendo si falta el sprite.

  py tools/arma_objeto.py        -> assets/sprites/arma-<id>.png y .json (fregona, bate, cuchillo, pistola, escopeta, mp5)
"""
import json
from PIL import Image, ImageDraw

OUT = (29, 27, 44, 255)  # el contorno de siempre (#1d1b2c)


def hex_(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def luz(c, k):
    return tuple(max(0, min(255, round(v * k))) for v in c[:3]) + (255,)


class Lienzo:
    def __init__(self, w, h, ox, oy):
        self.w, self.h, self.ox, self.oy = w, h, ox, oy
        self.capas = []  # [(imagen RGBA, sombreado)]

    def forma(self, color, dibujar, sombreado=True):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        dibujar(d, lambda x, y: (x + self.ox, y + self.oy), hex_(color))
        self.capas.append((im, sombreado))

    def detalle(self, dibujar):
        """Pegado al final, sin contorno ni sombreado (rayas, remaches...)."""
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        dibujar(ImageDraw.Draw(im), lambda x, y: (x + self.ox, y + self.oy))
        self.capas.append((im, None))

    def render(self):
        base = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for im, sombra in self.capas:
            if sombra is None:
                base.alpha_composite(im)
                continue
            px, W, H = im.load(), self.w, self.h
            out = im.copy()
            q = out.load()
            for y in range(H):
                for x in range(W):
                    if px[x, y][3] == 0:
                        continue
                    arriba = px[x, y - 1][3] if y > 0 else 0
                    abajo = px[x, y + 1][3] if y < H - 1 else 0
                    c = px[x, y]
                    if sombra and not arriba:
                        q[x, y] = luz(c, 1.28)   # filo de luz arriba
                    elif sombra and not abajo:
                        q[x, y] = luz(c, 0.72)   # y sombra abajo
            base.alpha_composite(out)
        # contorno de 1 píxel alrededor de todo
        a = base.load()
        res = base.copy()
        r = res.load()
        for y in range(self.h):
            for x in range(self.w):
                if a[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and a[nx, ny][3]:
                            r[x, y] = OUT
                            break
        return res


def rect(d, p, x0, y0, x1, y1, c):
    a, b = p(x0, y0), p(x1, y1)
    d.rectangle([a, (b[0] - 1, b[1] - 1)], fill=c)


def armas():
    out = {}
    M = 3  # margen para el contorno

    # fregona: palo azul, cabezal blanco de tiras y abrazadera amarilla
    L = Lienzo(66 + M, 32, 6 + M, 16)
    L.forma('#4f86f7', lambda d, p, c: rect(d, p, -6, -2, 44, 3, c))
    L.forma('#eef1f8', lambda d, p, c: d.ellipse([p(41, -14), p(60, 14)], fill=c))
    L.forma('#ffd23f', lambda d, p, c: rect(d, p, 40, -7, 46, 7, c))
    def tiras(d, p):
        for i in range(-3, 4):
            d.line([p(48, i * 4), p(58, i * 4 + (1 if i else 0))], fill=(120, 130, 160, 255))
    L.detalle(tiras)
    out['fregona'] = L

    # bate: madera clara con el mango envuelto
    L = Lienzo(58 + M, 20, 6 + M, 10)
    def bate(d, p, c):
        d.polygon([p(-6, -2), p(36, -5), p(47, -4), p(52, -1), p(52, 1), p(47, 4), p(36, 5), p(-6, 3)], fill=c)
    L.forma('#e0a868', bate)
    L.forma('#3b3550', lambda d, p, c: rect(d, p, -4, -2, 9, 3, c))
    L.detalle(lambda d, p: [d.line([p(14, -1), p(46, -2)], fill=(255, 224, 170, 255)), d.line([p(-3, 0), p(8, 0)], fill=(90, 84, 120, 255))])
    out['bate'] = L

    # cuchillo: mango marrón con remaches y hoja
    L = Lienzo(34 + M, 16, 5 + M, 8)
    L.forma('#5b3a29', lambda d, p, c: rect(d, p, -5, -3, 9, 3, c))
    L.forma('#9aa0b0', lambda d, p, c: rect(d, p, 8, -4, 10, 4, c))
    L.forma('#dfe4ef', lambda d, p, c: d.polygon([p(10, -4), p(31, -1), p(31, 0), p(10, 4)], fill=c))
    L.detalle(lambda d, p: [d.point(p(-2, 0), fill=(200, 200, 210, 255)), d.point(p(4, 0), fill=(200, 200, 210, 255)), d.line([p(11, 0), p(28, 0)], fill=(255, 255, 255, 255))])
    out['cuchillo'] = L

    # pistola: corredera gris, empuñadura oscura y guardamonte
    L = Lienzo(28 + M, 20, 4 + M, 8)
    L.forma('#2f3240', lambda d, p, c: rect(d, p, -2, 1, 5, 12, c))
    L.forma('#4a4e5c', lambda d, p, c: rect(d, p, -4, -4, 23, 3, c))
    L.forma('#3a3d47', lambda d, p, c: rect(d, p, 5, 3, 11, 5, c))
    L.detalle(lambda d, p: [d.line([p(0, -3), p(20, -3)], fill=(130, 136, 154, 255)), d.rectangle([p(-3, -4), p(-2, -3)], fill=(30, 30, 40, 255)), d.point(p(22, -3), fill=(30, 30, 40, 255))])
    out['pistola'] = L

    # escopeta: culata de madera, cañón y guardamanos
    L = Lienzo(48 + M, 22, 8 + M, 11)
    L.forma('#8b5a3c', lambda d, p, c: d.polygon([p(-8, -3), p(10, -4), p(10, 5), p(-8, 5)], fill=c))
    L.forma('#4a4e5c', lambda d, p, c: rect(d, p, 8, -4, 41, 3, c))
    L.forma('#a06a45', lambda d, p, c: rect(d, p, 14, 2, 27, 7, c))
    L.detalle(lambda d, p: [d.line([p(10, -3), p(40, -3)], fill=(130, 136, 154, 255)), d.line([p(-6, -1), p(8, -1)], fill=(180, 120, 84, 255))])
    out['escopeta'] = L

    # MP5: culata, cuerpo, cargador curvo y cañón
    L = Lienzo(36 + M, 24, 9 + M, 8)
    L.forma('#2f3240', lambda d, p, c: rect(d, p, -9, -4, 3, 3, c))
    L.forma('#3a3d47', lambda d, p, c: rect(d, p, 1, -4, 26, 4, c))
    L.forma('#2f3240', lambda d, p, c: d.polygon([p(11, 3), p(17, 3), p(18, 13), p(13, 13)], fill=c))
    L.forma('#2f3240', lambda d, p, c: rect(d, p, 24, -2, 27, 1, c))
    L.detalle(lambda d, p: [d.line([p(3, -3), p(24, -3)], fill=(120, 126, 144, 255)), d.line([p(14, 5), p(15, 12)], fill=(70, 74, 90, 255))])
    out['mp5'] = L
    return out


for id_, L in armas().items():
    im = L.render()
    im.save(f'assets/sprites/arma-{id_}.png')
    json.dump({'cell': [L.w, L.h], 'pivot': [L.ox, L.oy], 'scale': 0.5,
               'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}}},
              open(f'assets/sprites/arma-{id_}.json', 'w'), indent=2)
    print(id_, im.size)
