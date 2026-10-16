# Convierte una textura de suelo entera (hecha con Gemini/ChatGPT, vista cenital y que se repite sin costura)
# en el sprite de suelo de una estancia. No se recorta: se reduce entera y el juego la repite.
#
# Uso: py tools/textura_suelo.py <imagen> <estancia> <baldosas por lado>
#   ej.: py tools/textura_suelo.py assets/sources/suelos/bano-suelo-gemini.webp bano 12
#
# Cada baldosa de la imagen pasa a medir 16 píxeles de dibujo (una casilla). No vale la pena más detalle: el juego
# pinta el fondo a la resolución del pixel art y lo saltaría.
# "suavizar" es cuánto se tiñe el suelo con el color de la estancia (0 = nada).
import json, sys
from PIL import Image

src, estancia, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
lado = 16 * n
img = Image.open(src).convert('RGB').resize((lado, lado), Image.LANCZOS)
img.save(f'assets/sprites/suelo-{estancia}.png')
meta = {
    'cell': [lado, lado], 'pivot': [0, 0], 'suavizar': 0,
    'anims': {'idle': {'fps': 1, 'dirs': {'south': {'row': 0, 'frames': 1}}}},
}
with open(f'assets/sprites/suelo-{estancia}.json', 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2)
print(f'suelo-{estancia}: {lado}x{lado}')
