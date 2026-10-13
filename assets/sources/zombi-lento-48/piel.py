"""Piel del zombi lento: la piel y la camisa salieron del mismo tono, así que se separan por claridad."""
import colorsys
from PIL import Image, ImageDraw
D='south south-east east north-east north north-west west south-west'.split()
base='assets/sources/zombi-lento-48'
def hsv(p): return colorsys.rgb_to_hsv(p[0]/255,p[1]/255,p[2]/255)
def rgb(h,s,v): return tuple(round(c*255) for c in colorsys.hsv_to_rgb(h,s,v))
# retoque a mano: brillos de la camisa que no son piel (x0, y0, x1, y1)
CAMISA={'north-east':[(13,26,26,32)],'west':[(30,24,34,29)],'east':[(22,25,26,28)]}
Z=6
sh=Image.new('RGBA',(8*48*Z,2*48*Z),(60,60,70,255))
for i,d in enumerate(D):
    src=Image.open(f'{base}/rotations-original/{d}.png').convert('RGBA')
    im=src.copy(); px=im.load(); sp=src.load()
    def clara(x,y):
        if not (0<=x<48 and 0<=y<48) or not sp[x,y][3]: return False
        h,s_,v=hsv(sp[x,y]); return 20<=h*360<=62 and v>=0.78
    def roja(x,y):     # el muñón y la sangre
        if not (0<=x<48 and 0<=y<48) or not sp[x,y][3]: return False
        h,s_,v=hsv(sp[x,y]); return (h*360<=16 or h*360>=345) and s_>=0.6 and v>=0.3
    def junto_al_munon(x,y):   # los brillos pegados al muñón son camisa rota, no piel
        return sum(roja(x+i,y+j) for i in range(-4,5) for j in range(-4,5))>=6
    def retoque(x,y):
        return any(a<=x<=c and b<=y<=e for a,b,c,e in CAMISA.get(d,[]))
    def mancha(x,y):   # las líneas sueltas de brillo son camisa, no piel
        return sum(clara(x+i,y+j) for i in range(-2,3) for j in range(-2,3))>=5
    for y in range(48):
        for x in range(48):
            r,g,b,a=sp[x,y]
            if not a: continue
            h,s,v=hsv((r,g,b)); hd=h*360
            if 20<=hd<=62 and v>=0.78 and mancha(x,y) and not junto_al_munon(x,y) and not retoque(x,y):            # piel clara: cara y manos
                px[x,y]=rgb(88/360,max(s,0.3)*0.85,v*0.9)+(a,)
            elif roja(x,y):                       # rojo vivo: se apaga
                px[x,y]=rgb(h,s*0.9,v*0.62)+(a,)
            elif 20<=hd<=62 and v>=0.78 and not (retoque(x,y) or junto_al_munon(x,y)):
                px[x,y]=rgb(70/360,s*0.9,v*0.9)+(a,)   # dedos y brillos finos de piel: pálidos, algo verdosos
            elif 20<=hd<=62 and 0.5<=v:           # camisa (y sus brillos): marrón más oscuro y apagado
                px[x,y]=rgb(27/360,max(s,0.45)*0.9,min(v,0.74)*0.74)+(a,)
    im.save(f'{base}/rotations/{d}.png')
    sh.alpha_composite(src.resize((48*Z,48*Z),Image.NEAREST),(i*48*Z,0))
    sh.alpha_composite(im.resize((48*Z,48*Z),Image.NEAREST),(i*48*Z,48*Z))
sh.save('assets/pruebas/zombi-lento-piel.png')
