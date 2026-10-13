"""Pide fondos de estancias a Grok Imagine (API de xAI) y los guarda en assets/sources/fondos/grok/.

Usa los textos de docs/PROMPTS_BANOS.md (un apartado por tamaño y entrada) y, como referencia de estilo y de
encuadre, assets/sources/fondos/referencia-encuadre.png. Cada imagen cuesta dinero (0,04 $ con el modelo
grok-imagine-image-2.0, octubre de 2026): decirle el coste al dueño antes de lanzar tandas.

La clave va en la variable de entorno XAI_API_KEY (en Windows: setx XAI_API_KEY "..."). Nunca en el código,
en el chat ni en un commit.

Uso (desde la carpeta del proyecto):
  py tools/grok.py bano-pequeno-izquierda            4 versiones de ese apartado
  py tools/grok.py bano-grande-abajo 2 16:9          2 versiones, apaisadas
"""
import base64, json, os, re, sys, urllib.request, urllib.error

MODEL = 'grok-imagine-image-2.0'
REF = 'assets/sources/fondos/referencia-encuadre.png'
OUT = 'assets/sources/fondos/grok'


def clave():
    k = os.environ.get('XAI_API_KEY')
    if not k and os.name == 'nt':
        # recién puesta con setx: aún no está en esta terminal, pero sí en el registro del usuario
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as h:
            k = winreg.QueryValueEx(h, 'XAI_API_KEY')[0]
    assert k, 'falta la variable de entorno XAI_API_KEY'
    return k


def texto(nombre):
    md = open('docs/PROMPTS_BANOS.md', encoding='utf-8').read()
    m = re.search(rf'^## {re.escape(nombre)}\n.*?```text\n(.*?)```', md, re.S | re.M)
    assert m, f'no hay apartado "{nombre}" en docs/PROMPTS_BANOS.md'
    return m.group(1).strip()


def pedir(nombre, n=4, aspecto=None):
    ref = 'data:image/png;base64,' + base64.b64encode(open(REF, 'rb').read()).decode()
    body = {'model': MODEL, 'prompt': texto(nombre), 'n': n, 'response_format': 'b64_json',
            'image': {'url': ref, 'type': 'image_url'}}
    if aspecto:
        body['aspect_ratio'] = aspecto
    req = urllib.request.Request('https://api.x.ai/v1/images/edits', json.dumps(body).encode(), {
        'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clave(), 'User-Agent': 'zombie-scape/1.0'})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        sys.exit(f'error {e.code}: {e.read().decode()[:600]}')
    os.makedirs(OUT, exist_ok=True)
    # no pisar lo que ya haya: sigue la numeración
    i = 1
    for d in res.get('data', []):
        while os.path.exists(f'{OUT}/{nombre}-{i}.png') or os.path.exists(f'{OUT}/{nombre}-{i}.jpg'):
            i += 1
        raw = base64.b64decode(d['b64_json']) if d.get('b64_json') else urllib.request.urlopen(d['url']).read()
        ext = 'png' if raw[:4] == b'\x89PNG' else 'jpg'
        open(f'{OUT}/{nombre}-{i}.{ext}', 'wb').write(raw)
        print(f'{OUT}/{nombre}-{i}.{ext}')
    print('uso:', json.dumps(res.get('usage', {})))


if __name__ == '__main__':
    pedir(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 4, sys.argv[3] if len(sys.argv) > 3 else None)
