"""Saca variantes de color de la hoja de un zombi (ropa y piel), sin tocar nada más.

Uso:  py tools/variantes.py zombi-normal            (rehace todas las variantes de ese zombi)
      py tools/variantes.py zombi-normal rojo       (solo una)

Lee assets/sprites/<zombi>.png y escribe assets/sprites/<zombi>-<variante>.png (+ su .json, que es copia del
original). Luego hay que apuntar los ids nuevos en assets/sprites/manifest.json y en `variantes` de zombies.js.

Cómo decide qué es cada cosa (por el tono de cada píxel, así el sombreado se conserva):
  - camisa: azul claro (luz >= LUZ_CAMISA)      - pantalón: azul oscuro (luz < LUZ_CAMISA)
  - piel: verde                                  - lo demás (pelo, zapatos, sangre, contornos) no se toca
Cada variante dice, por prenda: tono nuevo en grados (None = el de antes), cuánta saturación se conserva
y cuánta luz. La hoja original no se modifica.
"""
import colorsys, json, shutil, sys
from PIL import Image

LUZ_CAMISA = 0.42
AZUL = (185, 250)     # tonos de la ropa, en grados
VERDE = (60, 130)     # tonos de la piel

# prenda: (tono nuevo, saturación ×, luz ×)
VARIANTES = {
    'rojo':   {'camisa': (4, 1.9, 0.95),  'pantalon': (20, 0.35, 0.9)},    # camiseta roja, pantalón casi negro
    'bata':   {'camisa': (None, 0.12, 1.15), 'pantalon': (165, 0.9, 1.15)},  # bata blanca, pantalón verde clínico
    'pijama': {'camisa': (320, 1.4, 1.0), 'pantalon': (320, 1.2, 0.95), 'piel': (75, 0.7, 1.05)},  # pijama rosa
    'pelado': {'camisa': (35, 0.9, 1.0),  'pantalon': (30, 0.7, 0.8), 'piel': (170, 0.45, 1.05)},  # marrón y piel azulada
}


def mover(h, s, v, regla):
    nh, ns, nv = regla
    h = h if nh is None else nh / 360
    return colorsys.hsv_to_rgb(h, min(1, s * ns), min(1, v * nv))


def variante(origen, nombre, reglas):
    im = Image.open(f'assets/sprites/{origen}.png').convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            grados = h * 360
            regla = None
            if s > 0.1 and v > 0.12:
                if AZUL[0] <= grados <= AZUL[1]:
                    regla = reglas.get('camisa' if v >= LUZ_CAMISA else 'pantalon')
                elif VERDE[0] <= grados <= VERDE[1]:
                    regla = reglas.get('piel')
            if regla:
                rr, gg, bb = mover(h, s, v, regla)
                px[x, y] = (round(rr * 255), round(gg * 255), round(bb * 255), a)
    im.save(f'assets/sprites/{origen}-{nombre}.png')
    shutil.copyfile(f'assets/sprites/{origen}.json', f'assets/sprites/{origen}-{nombre}.json')
    print(f'{origen}-{nombre}')


if __name__ == '__main__':
    zombi = sys.argv[1]
    for nombre, reglas in VARIANTES.items():
        if len(sys.argv) < 3 or sys.argv[2] == nombre:
            variante(zombi, nombre, reglas)
