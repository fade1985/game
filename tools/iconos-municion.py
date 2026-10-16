# Iconos de munición para el HUD: una bala (pistola y MP5) y un cartucho (escopeta), en pixel art.
# Se lanza desde la carpeta del proyecto: py tools/iconos-municion.py  (escribe assets/ui/iconos/bala.png y cartucho.png)
from PIL import Image
O = (71, 41, 55, 255)      # contorno (el mismo de los demás iconos)
cols = {
  'O': O, '.': (0, 0, 0, 0),
  't': (255, 224, 102, 255), 'T': (201, 138, 42, 255),   # punta: luz y sombra
  'c': (232, 196, 90, 255), 'C': (168, 116, 36, 255),    # casquillo de latón: luz y sombra
  'r': (214, 64, 52, 255), 'R': (140, 32, 30, 255),      # cartucho rojo: luz y sombra
  'b': (240, 200, 96, 255), 'B': (170, 120, 40, 255),    # culote de latón del cartucho
}
bala = [
  '.OOO.',
  'OttTO',
  'OttTO',
  'OOOOO',
  'OccCO',
  'OccCO',
  'OccCO',
  'OccCO',
  'OccCO',
  'OOOOO',
]
cartucho = [
  'OOOOO',
  'OrrRO',
  'OrrRO',
  'OrrRO',
  'OrrRO',
  'OrrRO',
  'OOOOO',
  'ObbBO',
  'ObbBO',
  'OOOOO',
]
for nombre, filas in (('bala', bala), ('cartucho', cartucho)):
    im = Image.new('RGBA', (len(filas[0]), len(filas)))
    for y, fila in enumerate(filas):
        for x, ch in enumerate(fila):
            im.putpixel((x, y), cols[ch])
    im.save(f'assets/ui/iconos/{nombre}.png')
    print(nombre, im.size)
