# Convierte una textura de la tapa de los muros (vista cenital, sin costura; de Gemini) en el sprite
# `tapa-<nombre>`. Se recorta el margen transparente y se reduce entera a 128 píxeles (8 casillas), con la misma
# densidad que los personajes ("scale": 1), como los suelos.
#
# Uso: py tools/textura_tapa.py <imagen> <nombre>
#   ej.: py tools/textura_tapa.py assets/sources/suelos/tapa-salon.png salon
import json, sys
from PIL import Image

LADO = 128
src, nombre = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
bb = im.getchannel('A').getbbox()
if bb:
    im = im.crop(bb)
im = im.convert('RGB').resize((LADO, LADO), Image.BOX)
im.save(f'assets/sprites/tapa-{nombre}.png')
meta = {
    'cell': [LADO, LADO], 'pivot': [0, 0], 'scale': 1, 'suavizar': 0,
    'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}},
}
with open(f'assets/sprites/tapa-{nombre}.json', 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2)
print(f'tapa-{nombre}: {LADO}x{LADO}')
