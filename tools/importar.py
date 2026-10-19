"""Muebles del dueño → sprites del juego, con un solo comando.

  py tools/importar.py            convierte lo nuevo o cambiado de assets/sources/salas/
  py tools/importar.py nevera-b   vuelve a convertir esos (por su nombre de archivo), aunque no hayan cambiado

Flujo: dejar la imagen (PNG o WEBP con fondo transparente, de Gemini o ChatGPT) en su carpeta de
assets/sources/salas/<sala>/ → ejecutar el comando → sale en el juego.

Nombres: <mueble>[-<variante>][-lado].png, con el nombre en español del catálogo (src/catalogo.js → MUEBLES,
campo `archivo`): nevera.png es la de siempre; nevera-b.png, nevera-c.png… otras variantes que el juego elige al
azar por apartamento; nevera-lado.png / nevera-b-lado.png, el dibujo para las paredes laterales (hecho para la
izquierda: en la derecha se pone en espejo). La carpeta es solo para ordenar: vale cualquiera menos descartes/.

Cada imagen: fuera el fondo y el halo blanco que deja la IA, recortada, reducida al ancho del mueble en el
catálogo (el de frente, a su largo `len`; el de lado, a su fondo `dep`, para que choque justo con lo que se ve) y
con el contorno oscuro de los demás muebles. Deja assets/sprites/mueble-<tipo>[-<variante>][-lado].png y su .json
con "scale": 1 (cada píxel, 2 unidades del juego: la misma densidad que los personajes; hasta el 19 oct salían a
0,5, con el doble de detalle), y lo apunta en manifest.json.

Para saber qué es nuevo, apunta la huella de cada original en assets/sources/salas/importados.json. Un mueble de
tipo nuevo (que no está en el catálogo) no se convierte: hay que añadirlo antes a src/catalogo.js.
"""
import hashlib, json, os, subprocess, sys
from PIL import Image

SALAS = 'assets/sources/salas'
OUT = 'assets/sprites'
REGISTRO = f'{SALAS}/importados.json'
OUTLINE = (29, 27, 44, 255)
IMAGENES = ('.png', '.webp', '.jpg', '.jpeg')
# Muebles dibujados "a tamaño de personaje": cada píxel del juego son N píxeles del original. Se encogen justo
# N veces (no al ancho del catálogo) y salen con la escala indicada ("scale": 1 = el mismo tamaño de píxel que Johnny).
# Para añadir otro mueble así: su tipo (el del catálogo), el N y la escala.
BLOQUE = {'lamp': (8, 1), 'sofa': (12.7, 1), 'tv': (12.7, 1), 'armchair': (12.7, 1), 'bookshelf': (12.7, 1)}  # tipo: (N, scale del .json: 1 = 2 unidades por píxel, 0.5 = 1)


def catalogo():
    """{nombre en español: (tipo, len, dep)} sacado de src/catalogo.js, el mismo que usa el juego"""
    js = "import('./src/catalogo.js').then((m) => console.log(JSON.stringify(m.MUEBLES)))"
    muebles = json.loads(subprocess.check_output(['node', '--no-warnings', '-e', js]))
    return {v['archivo'].split('/')[-1]: (k, v['len'], v['dep']) for k, v in muebles.items()}


def huella(ruta):
    return hashlib.sha1(open(ruta, 'rb').read()).hexdigest()[:16]


def originales():
    """(ruta relativa a salas/, ruta completa) de cada imagen, menos descartes/"""
    for sala in sorted(os.listdir(SALAS)):
        d = f'{SALAS}/{sala}'
        if sala == 'descartes' or not os.path.isdir(d): continue
        for f in sorted(os.listdir(d)):
            if f.lower().endswith(IMAGENES): yield f'{sala}/{f}', f'{d}/{f}'


def entiende(nombre, cat):
    """'nevera-b-lado' → (tipo, len, dep, variante, lado) o un texto con lo que falla"""
    partes = nombre.split('-')
    lado = partes[-1] == 'lado'
    if lado: partes.pop()
    variante = ''
    if len(partes) > 1 and len(partes[-1]) == 1:
        variante = partes.pop()
        if variante == 'a': return f'la primera variante se llama {"-".join(partes)} (sin -a)'
        if not 'b' <= variante <= 'z': return f'la variante tiene que ser una letra de la b a la z'
    base = '-'.join(partes)
    if base not in cat: return f'"{base}" es un mueble nuevo: hay que añadirlo antes a src/catalogo.js'
    return *cat[base], variante, lado


def convierte(src, w, bloque=None):
    """La receta de siempre: sin fondo, recortado, a `w` píxeles de ancho (contorno incluido) y con contorno"""
    im = Image.open(src).convert('RGBA')
    if im.getchannel('A').getextrema()[0] >= 128:
        return None  # sin nada transparente: el fondo es de verdad (o un damero pintado)
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            # fondo transparente y el halo blanco que deja la IA alrededor
            if a < 128 or (min(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 30): px[x, y] = (0, 0, 0, 0)
            else: px[x, y] = (r, g, b, 255)
    im = im.crop(im.getbbox())
    if bloque:
        w, h = max(1, round(im.size[0] / bloque)), max(1, round(im.size[1] / bloque))
    else:
        w -= 2  # el contorno ocupa un píxel a cada lado
        h = max(1, round(w * im.size[1] / im.size[0]))
    # color medio de cada píxel nuevo, contando solo lo que no es fondo
    color = im.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
    lleno = im.getchannel('A').resize((w, h), Image.BOX)
    out = Image.new('RGBA', (w + 2, h + 1))  # sitio para el contorno a los lados y arriba
    for y in range(h):
        for x in range(w):
            if lleno.getpixel((x, y)) > 110:
                r, g, b, _ = color.getpixel((x, y))
                out.putpixel((x + 1, y + 1), (r, g, b, 255))
    # contorno: cada hueco vacío pegado al dibujo
    W, H = out.size
    borde = [(x, y) for y in range(H) for x in range(W) if out.getpixel((x, y))[3] == 0 and any(
        0 <= x + dx < W and 0 <= y + dy < H and out.getpixel((x + dx, y + dy))[3] == 255
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for p in borde: out.putpixel(p, OUTLINE)
    return out


def main(forzar):
    cat = catalogo()
    registro = json.load(open(REGISTRO, encoding='utf-8')) if os.path.exists(REGISTRO) else {}
    hechos, avisos = [], []
    for rel, ruta in originales():
        nombre = os.path.splitext(os.path.basename(rel))[0]
        hoy = huella(ruta)
        if nombre not in forzar and registro.get(rel, {}).get('huella') == hoy: continue
        que = entiende(nombre, cat)
        if isinstance(que, str): avisos.append(f'{rel}: {que}'); continue
        tipo, largo, fondo, variante, lado = que
        sid = f'mueble-{tipo}' + (f'-{variante}' if variante else '') + ('-lado' if lado else '')
        bloque, escala = BLOQUE.get(tipo, (None, 1))
        # a la densidad de los personajes: cada píxel, 2 unidades del juego (el ancho del catálogo va en unidades)
        im = convierte(ruta, round((fondo if lado else largo) / 2), bloque)
        if im is None: avisos.append(f'{rel}: no tiene fondo transparente (¿un damero pintado?); no se convierte'); continue
        im.save(f'{OUT}/{sid}.png')
        meta = {'cell': [im.width, im.height], 'pivot': [im.width // 2, im.height], 'scale': escala,
                'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}}}
        with open(f'{OUT}/{sid}.json', 'w', encoding='utf-8', newline='\n') as f:
            json.dump(meta, f, indent=2); f.write('\n')
        registro[rel] = {'huella': hoy, 'sprite': sid}
        hechos.append(sid)
        print(f'  {rel} → {sid} ({im.width} × {im.height} píxeles)')
    if hechos:
        ruta = f'{OUT}/manifest.json'
        lista = json.load(open(ruta, encoding='utf-8'))
        lista += [s for s in hechos if s not in lista]
        with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(lista, f, indent=2); f.write('\n')
        with open(REGISTRO, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(dict(sorted(registro.items())), f, indent=2, ensure_ascii=False); f.write('\n')
    for a in avisos: print('  ¡ojo!', a)
    print(f'{len(hechos)} convertidos' if hechos else 'Nada nuevo que convertir')


if __name__ == '__main__':
    main(set(sys.argv[1:]))
