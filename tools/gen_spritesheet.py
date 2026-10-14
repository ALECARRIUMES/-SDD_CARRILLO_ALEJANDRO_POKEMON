import sys, json, xml.etree.ElementTree as ET
from PIL import Image
root = sys.argv[1] if len(sys.argv) > 1 else '.'
D = root + '/assets/spriteChatizard/'
DIRS = ['down','downRight','right','upRight','up','upLeft','left','downLeft']
COLORS = {(0,0,0):'head',(0,255,0):'center',(255,0,0):'leftHand',(0,0,255):'rightHand'}
def camel(n): return n[0].lower()+n[1:]
x = ET.parse(D+'AnimData.xml').getroot()
out=[]; stats=[]
out.append("""/**
 * spritesheet.js — Coordenadas pre-calculadas de TODOS los sprites del juego.
 * Generado con tools/gen_spritesheet.py (python3 tools/gen_spritesheet.py .) a partir de assets/spriteChatizard/AnimData.xml + los PNG.
 * NO editar a mano: si cambian los assets, regenerar.
 *
 * ── Cómo leer este archivo ────────────────────────────────────────────────
 * Cada frame trae { sx, sy, sw, sh } = recorte para ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh).
 * Las hojas son grillas: COLUMNA = frame de la animación, FILA = dirección.
 * Orden de filas (convención PMD SpriteCollab):
 *   0 down · 1 downRight · 2 right · 3 upRight · 4 up · 5 upLeft · 6 left · 7 downLeft
 *   (Sleep solo tiene 1 fila → todas las direcciones apuntan a la misma.)
 *
 * Anclajes por frame (coordenadas RELATIVAS a la esquina sup-izq del frame), leídos de *-Offsets.png / *-Shadow.png:
 *   center    → centro del cuerpo (pixel verde)
 *   head      → cabeza (pixel negro)           ← origen natural para Lanzallamas/proyectiles
 *   leftHand  → mano izquierda (pixel rojo)
 *   rightHand → mano derecha (pixel azul)
 *   shadow    → punto de apoyo en el suelo (pixel blanco de *-Shadow.png) ← usalo como "pies"
 * Para dibujar con los pies en (px, py):  dx = px - f.shadow.x * escala ;  dy = py - f.shadow.y * escala
 * Así el personaje no "salta" al cambiar entre animaciones de distinto tamaño de frame.
 *
 * Tiempos: durations está en TICKS del juego original (1 tick = 1/60 s). durationsMs ya convertido.
 * events (rush/hit/return): índice de frame donde ocurre embestida / impacto / regreso (dato tal cual del XML).
 */

export const TICK_MS = 1000 / 60;
export const SHADOW_SIZE = %s; // tamaño de sombra definido en AnimData.xml
export const DIRECTIONS = %s;
""" % (x.find('ShadowSize').text, json.dumps(DIRS)))

def anchors(img, x0, y0, fw, fh, white=False):
    res={}
    px=img.load()
    for yy in range(fh):
        for xx in range(fw):
            p=px[x0+xx,y0+yy]
            if p[3]==0: continue
            if white:
                if p[:3]==(255,255,255): res['shadow']=(xx,yy)
            elif p[:3] in COLORS: res[COLORS[p[:3]]]=(xx,yy)
    return res

out.append("export const BACKGROUNDS = {")
for i,n in enumerate(['image1','image2'],1):
    w,h = Image.open(root+'/assets/FondoSprite/%s.png'%n).size
    desc = 'Bosque con río y puente (escena inicial)' if i==1 else 'Zona volcánica (escena destino de la transición)'
    out.append(f"  fondo{i}: {{ src: 'assets/FondoSprite/{n}.png', sx: 0, sy: 0, sw: {w}, sh: {h} }}, // {desc}")
out.append("};")
out.append("// Ambos fondos comparten composición (mismo encuadre de plataformas y volcán): se pueden")
out.append("// mezclar con crossfade (globalAlpha) sin que el escenario 'salte'.")
out.append("export const BACKGROUND_SEQUENCE = ['fondo1', 'fondo2'];\n")

out.append("export const CHARIZARD = {")
for a in x.iter('Anim'):
    name=a.find('Name').text; fw=int(a.find('FrameWidth').text); fh=int(a.find('FrameHeight').text)
    durs=[int(d.text) for d in a.find('Durations')]
    anim=Image.open(D+name+'-Anim.png'); W,H=anim.size
    off=Image.open(D+name+'-Offsets.png').convert('RGBA'); sh=Image.open(D+name+'-Shadow.png').convert('RGBA')
    cols, rows = W//fw, H//fh
    assert cols==len(durs)
    ev={k:int(a.find(t).text) for k,t in [('rush','RushFrame'),('hit','HitFrame'),('return','ReturnFrame')] if a.find(t) is not None}
    out.append(f"  {camel(name)}: {{")
    out.append(f"    src: {{ anim: 'assets/spriteChatizard/{name}-Anim.png', shadow: 'assets/spriteChatizard/{name}-Shadow.png', offsets: 'assets/spriteChatizard/{name}-Offsets.png' }},")
    out.append(f"    sheetSize: {{ w: {W}, h: {H} }}, frameWidth: {fw}, frameHeight: {fh}, frameCount: {cols}, rows: {rows},")
    out.append(f"    durations: {json.dumps(durs)},")
    out.append(f"    durationsMs: {json.dumps([round(d*1000/60,1) for d in durs])}, totalMs: {round(sum(durs)*1000/60,1)},")
    if ev: out.append("    events: { " + ", ".join(f"{k}: {v}" for k,v in ev.items()) + " },")
    out.append("    frames: {")
    for di,dname in enumerate(DIRS):
        r = di if rows==8 else 0
        out.append(f"      {dname}: [")
        for c in range(cols):
            x0,y0=c*fw,r*fh
            an=anchors(off,x0,y0,fw,fh); an.update(anchors(sh,x0,y0,fw,fh,True))
            parts=[f"sx: {x0}, sy: {y0}, sw: {fw}, sh: {fh}"]
            for k in ['center','head','leftHand','rightHand','shadow']:
                if k in an: parts.append(f"{k}: {{ x: {an[k][0]}, y: {an[k][1]} }}")
                else: stats.append((name,dname,c,k))
            out.append("        { " + ", ".join(parts) + " },")
        out.append("      ],")
    out.append("    },")
    out.append("  },")
out.append("};\n")
out.append("""/** Devuelve el frame listo para drawImage. anim: 'walk' | 'attack' | ... ; dir: una de DIRECTIONS. */
export function getFrame(anim, dir, index) {
  const a = CHARIZARD[anim];
  const list = a.frames[dir];
  return list[index % list.length];
}

/** Índice de frame según el tiempo transcurrido (ms) respetando las duraciones individuales. */
export function frameIndexAt(anim, elapsedMs, loop = true) {
  const a = CHARIZARD[anim];
  let t = loop ? elapsedMs % a.totalMs : Math.min(elapsedMs, a.totalMs - 0.001);
  for (let i = 0; i < a.durationsMs.length; i++) {
    if (t < a.durationsMs[i]) return i;
    t -= a.durationsMs[i];
  }
  return a.durationsMs.length - 1;
}

/**
 * Guía de animaciones (nombre PMD → uso sugerido en el juego):
 *   idle    → parado/respirando            walk    → caminar
 *   attack  → golpe cuerpo a cuerpo        jab     → golpe rápido
 *   shoot   → lanzar proyectil (Lanzallamas) — origen: head
 *   hover   → volar/flotar                 swing   → coletazo/barrido
 *   double  → ataque doble                 hop     → salto
 *   charge  → cargar energía               rotate  → giro
 *   hurt    → recibe daño                  sleep   → dormido / KO
 */
""")
open(root+'/spritesheet.js','w').write("\n".join(out))
print('missing anchors:', len(stats), stats[:10])
