"""Baja de una vez todas las animaciones de un personaje de PixelLab (su zip) y las deja como las espera
tools/zombi.py: assets/sources/<fuente>/<animación>/<dirección>-<n>.png

Uso (desde la carpeta del proyecto):
  py tools/bajar_zip.py <id del personaje> <fuente>              todas las animaciones
  py tools/bajar_zip.py <id del personaje> <fuente> muerte golpe  solo esas

La carpeta se llama como la animación en PixelLab (animation_name), menos "andar", que va a walk/.
"""
import os, re, subprocess, sys, tempfile, zipfile

char, source, only = sys.argv[1], sys.argv[2], sys.argv[3:]
NAMES = {'andar': 'walk'}

with tempfile.TemporaryDirectory() as tmp:
    z = os.path.join(tmp, 'p.zip')
    # con curl: PixelLab rechaza las descargas hechas directamente desde Python
    subprocess.run(['curl', '-sSf', '-o', z, f'https://api.pixellab.ai/mcp/characters/{char}/download'], check=True)
    count = {}
    with zipfile.ZipFile(z) as zf:
        for name in zf.namelist():
            parts = name.split('/')      # <estado>/animations/<animación>/<dirección>/frame_00N.png
            if len(parts) != 5 or parts[1] != 'animations' or not parts[4].startswith('frame_'):
                continue
            # si la misma animación está repartida en varios grupos, PixelLab añade "-<grupo>" al nombre
            anim, d, n = re.sub(r'-[0-9a-f]{8}$', '', parts[2]), parts[3], int(parts[4][6:9])
            if only and anim not in only:
                continue
            folder = f'assets/sources/{source}/{NAMES.get(anim, anim)}'
            os.makedirs(folder, exist_ok=True)
            with open(f'{folder}/{d}-{n}.png', 'wb') as f:
                f.write(zf.read(name))
            count.setdefault((anim, folder), set()).add(d)
for (anim, folder), ds in sorted(count.items()):
    print(f'{anim} -> {folder}: {len(ds)} direcciones ({", ".join(sorted(ds))})')
