# Convierte una textura de suelo entera (hecha con Gemini/ChatGPT, vista cenital y que se repite sin costura)
# en el sprite de suelo de una estancia. No se recorta: se reduce entera y el juego la repite.
#
# Uso: py tools/textura_suelo.py <imagen> <estancia> <baldosas por lado>
#   ej.: py tools/textura_suelo.py assets/sources/suelos/bano-suelo-gemini.webp bano 12
#
# Cada baldosa de la imagen pasa a medir 16 píxeles (una casilla), con la misma densidad que los personajes
# ("scale": 1; desde el 19 oct todo el juego va a una sola densidad). Se reduce con la media de color de cada
# bloque (BOX), así vale una imagen grande de la IA sin pixelar antes.
# "suavizar" es cuánto se tiñe el suelo con el color de la estancia (0 = nada).
import json, sys
from PIL import Image

src, estancia, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
lado = 16 * n
img = Image.open(src).convert('RGB').resize((lado, lado), Image.BOX)
img.save(f'assets/sprites/suelo-{estancia}.png')
meta = {
    'cell': [lado, lado], 'pivot': [0, 0], 'scale': 1, 'suavizar': 0,
    'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}},
}
with open(f'assets/sprites/suelo-{estancia}.json', 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2)
print(f'suelo-{estancia}: {lado}x{lado}')
