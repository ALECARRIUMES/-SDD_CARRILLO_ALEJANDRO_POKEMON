# Pokémon Game — Charizard

Juego 2D en canvas con Charizard como personaje y dos fondos (bosque → volcán).

## Estructura
- `assets/spriteChatizard/` → hojas de sprites de Charizard (formato PMD SpriteCollab).
- `assets/FondoSprite/` → `image1.png` (bosque, inicio) y `image2.png` (volcán, destino).
- `spritesheet.js` → coordenadas YA CALCULADAS de todos los sprites y fondos.
- `tools/gen_spritesheet.py` → regenera `spritesheet.js` si cambian los assets.

## Reglas para la IA
1. **No calcular coordenadas.** Usar siempre `spritesheet.js`.
2. **No leer `spritesheet.js` completo** (~200 KB). Leer solo:
   - la cabecera (líneas 1–37, hasta `export const CHARIZARD`), y
   - el bloque de la animación que se necesite, ej. `CHARIZARD.walk`
     (buscar con `grep -n "^  walk:" spritesheet.js`).
3. Usar `getFrame(anim, dir, i)` y `frameIndexAt(anim, ms)` en vez de reimplementarlos.
4. Dibujar alineando por `frame.shadow` (pies) para que Charizard no "salte" entre animaciones.
5. Proyectiles (Lanzallamas) salen de `frame.head`.
6. No editar `spritesheet.js` a mano: regenerar con `python3 tools/gen_spritesheet.py .`

## Animaciones disponibles
`idle` · `walk` · `attack` · `jab` · `shoot` · `hover` · `swing` · `double` · `hop` · `charge` · `rotate` · `hurt` · `sleep`
Direcciones: `down` · `downRight` · `right` · `upRight` · `up` · `upLeft` · `left` · `downLeft`
