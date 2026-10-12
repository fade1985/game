"""Baja a una carpeta los fotogramas de una animación de PixelLab.

Lee por la entrada las líneas que da la herramienta get_character para esa animación, tal cual:
    south: https://backblaze.pixellab.ai/.../south/{i}.png?t=1791818896065 (i=0..12)
y guarda cada fotograma como <carpeta>/<dirección>-<n>.png. Con las rotaciones (líneas sin {i}) guarda
<carpeta>/<dirección>.png.

Uso (desde la carpeta del proyecto):
  py tools/bajar.py assets/sources/conserje-48-bate/ataque < lineas.txt
  py tools/bajar.py assets/sources/conserje-48-bate/ataque east north < lineas.txt    solo esas direcciones
"""
import os, re, subprocess, sys

folder, only = sys.argv[1], sys.argv[2:]


def get(url, path):
    # con curl: PixelLab rechaza las descargas hechas directamente desde Python
    subprocess.run(['curl', '-sSf', '-o', path, url], check=True)


os.makedirs(folder, exist_ok=True)
total = 0
for line in sys.stdin:
    m = re.match(r'\s*([a-z-]+):\s+(https://\S+)(?:\s+\(i=(\d+)\.\.(\d+)\))?', line)
    if not m or (only and m.group(1) not in only):
        continue
    d, url = m.group(1), m.group(2)
    if '{i}' in url:
        for i in range(int(m.group(3)), int(m.group(4)) + 1):
            get(url.replace('{i}', str(i)), f'{folder}/{d}-{i}.png')
            total += 1
    else:
        get(url, f'{folder}/{d}.png')
        total += 1
    print(d, 'bajado')
print(total, 'archivos en', folder)
