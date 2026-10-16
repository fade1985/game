# Saca baldosas de suelo y columnas de pared de una imagen entera de una estancia (hecha con ChatGPT/Gemini)
# y las reduce a pixel art.
#
# Idea: cada baldosa se recorta de junta a junta, así que cualquier baldosa casa con cualquier otra (el borde
# siempre es junta). El juego las mezcla al azar y no se nota la repetición.
#
# Uso: py tools/extraer_baldosas.py   (las medidas de la imagen van en MEDIDAS, abajo)
# Salida: assets/sources/suelos/<nombre>-suelo.png   (fila de baldosas de 16x16)
#         assets/sources/suelos/<nombre>-pared.png   (azulejos de 12x10: arriba los limpios, abajo los sucios)
#         assets/sources/suelos/<nombre>-rodapie.png (trozos de rodapié de 12x5)
# La pared del juego (48 de alto) se monta apilando: rodapié (5) + 4 azulejos (40) + 3 píxeles de otro.
import sys
from PIL import Image

AZ_W, AZ_H, ROD_H = 12, 10, 5  # azulejo y rodapié, en píxeles de dibujo
COLORES = 32      # paleta común de suelo y pared

# Posiciones de las juntas en la imagen original (medidas a mano con perfiles de brillo)
MEDIDAS = {
    'bano': {
        'origen': 'assets/sources/suelos/bano-origen.webp',
        # suelo: centro de la imagen, donde las juntas están casi rectas
        'suelo_x': [389, 451, 512, 573, 636, 697],
        'suelo_y': [474, 522, 574, 624, 680, 732],
        # pared: azulejos sueltos de las zonas sin muebles (columnas, filas) y el rodapié
        'pared_zonas': [
            ([54, 96, 139, 184, 227, 273, 318, 366, 411, 459], [57, 91, 129, 166, 204, 240, 277, 311, 349]),
            ([650, 699, 744, 790, 838, 884, 925, 970], [57, 91, 129]),
        ],
        'rodapie': (54, 367, 459, 385),
    },
}


def junta(img, color):
    # junta de 1 píxel arriba y a la izquierda: así cada baldosa trae su propia junta y casan todas
    w, h = img.size
    p = img.load()
    for x in range(w):
        p[x, 0] = color
    for y in range(h):
        p[0, y] = color


def media(img, caja, oscuros=1.0):
    # color medio de la caja; con oscuros < 1, solo de esa fracción de píxeles más oscuros
    pxs = sorted(img.crop(caja).get_flattened_data(), key=sum)
    pxs = pxs[:max(1, int(len(pxs) * oscuros))]
    n = len(pxs)
    return tuple(sum(px[c] for px in pxs) // n for c in range(3))


def igualar(piezas, fuerza=0.7):
    # acerca el brillo de cada pieza al de la media, para que no quede un tablero de ajedrez
    medias = [media(t, (1, 1, t.width, t.height)) for t in piezas]
    total = tuple(sum(m[c] for m in medias) / len(medias) for c in range(3))
    out = []
    for t, m in zip(piezas, medias):
        d = [int((total[c] - m[c]) * fuerza) for c in range(3)]
        out.append(t.copy())
        px = out[-1].load()
        for y in range(1, t.height):
            for x in range(1, t.width):
                r, g, b = px[x, y]
                px[x, y] = (max(0, min(255, r + d[0])), max(0, min(255, g + d[1])), max(0, min(255, b + d[2])))
    return out


def main(nombre):
    m = MEDIDAS[nombre]
    src = Image.open(m['origen']).convert('RGB')
    sx, sy = m['suelo_x'], m['suelo_y']

    # color de la junta del suelo: una franja fina sobre una línea medida
    color_junta = media(src, (sx[1] + 5, sy[2] - 2, sx[2] - 5, sy[2] + 3), 0.25)

    suelo = []
    for j in range(len(sy) - 1):
        for i in range(len(sx) - 1):
            b = src.crop((sx[i] + 2, sy[j] + 2, sx[i + 1] - 1, sy[j + 1] - 1)).resize((15, 15), Image.LANCZOS)
            t = Image.new('RGB', (16, 16))
            t.paste(b, (1, 1))
            junta(t, color_junta)
            suelo.append(t)

    # azulejos de pared: cada uno con su junta, separados en limpios y sucios según lo que varía su color
    zx, zy = m['pared_zonas'][0]
    junta_pared = media(src, (zx[2] + 5, zy[3] - 2, zx[3] - 5, zy[3] + 3), 0.25)
    limpios, sucios = [], []
    for xs, ys in m['pared_zonas']:
        for j in range(len(ys) - 1):
            for i in range(len(xs) - 1):
                caja = (xs[i] + 2, ys[j] + 2, xs[i + 1] - 1, ys[j + 1] - 1)
                lum = list(src.crop(caja).convert('L').get_flattened_data())
                med = sum(lum) / len(lum)
                var = (sum((v - med) ** 2 for v in lum) / len(lum)) ** 0.5
                t = Image.new('RGB', (AZ_W, AZ_H))
                t.paste(src.crop(caja).resize((AZ_W - 1, AZ_H - 1), Image.LANCZOS), (1, 1))
                junta(t, junta_pared)
                (limpios if var < 14 else sucios).append(t)

    suelo, limpios, sucios = igualar(suelo), igualar(limpios), igualar(sucios, 0.4)

    x0, y0, x1, y1 = m['rodapie']
    paso = (x1 - x0) // 4
    rodapie = [src.crop((x0 + k * paso, y0, x0 + (k + 1) * paso, y1)).resize((AZ_W, ROD_H), Image.LANCZOS) for k in range(4)]

    # paleta común para que suelo y pared parezcan de la misma mano
    ancho = max(16 * len(suelo), AZ_W * max(len(limpios), len(sucios)))
    hoja = Image.new('RGB', (ancho, 16 + 2 * AZ_H + ROD_H))
    for k, t in enumerate(suelo):
        hoja.paste(t, (16 * k, 0))
    for k, t in enumerate(limpios):
        hoja.paste(t, (AZ_W * k, 16))
    for k, t in enumerate(sucios):
        hoja.paste(t, (AZ_W * k, 16 + AZ_H))
    for k, t in enumerate(rodapie):
        hoja.paste(t, (AZ_W * k, 16 + 2 * AZ_H))
    hoja = hoja.quantize(COLORES, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')

    hoja.crop((0, 0, 16 * len(suelo), 16)).save(f'assets/sources/suelos/{nombre}-suelo.png')
    pared = Image.new('RGBA', (AZ_W * max(len(limpios), len(sucios)), 2 * AZ_H))
    pared.paste(hoja.crop((0, 16, AZ_W * len(limpios), 16 + AZ_H)), (0, 0))
    pared.paste(hoja.crop((0, 16 + AZ_H, AZ_W * len(sucios), 16 + 2 * AZ_H)), (0, AZ_H))
    pared.save(f'assets/sources/suelos/{nombre}-pared.png')
    hoja.crop((0, 16 + 2 * AZ_H, AZ_W * len(rodapie), 16 + 2 * AZ_H + ROD_H)).save(f'assets/sources/suelos/{nombre}-rodapie.png')
    print(f'{len(suelo)} baldosas de suelo, {len(limpios)} azulejos limpios y {len(sucios)} sucios')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'bano')
