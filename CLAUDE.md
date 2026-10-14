# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del proyecto

Juego 2D en `<canvas>` con Charizard como personaje y dos fondos (bosque → volcán). **El juego todavía no existe**: el repo solo contiene los assets, los datos de sprites ya calculados (`spritesheet.js`) y el script que los genera. No hay `package.json`, ni `index.html`, ni build, ni linter, ni tests. No es un repositorio git.

## Comandos

Regenerar `spritesheet.js` cuando cambien los assets (requiere Python con Pillow: `pip install pillow`):

```
python tools/gen_spritesheet.py .
```

El argumento es la raíz del proyecto. Al terminar imprime `missing anchors: N [...]`: los frames en los que no se encontró algún píxel de anclaje.

`spritesheet.js` es un módulo ES (`export`), así que el juego debe cargarse con `<script type="module">` y servirse por HTTP (p. ej. `python -m http.server`); abrir el HTML con `file://` no funciona.

## Arquitectura

Flujo de datos en una sola dirección:

```
assets/spriteChatizard/AnimData.xml + *-Anim.png / *-Offsets.png / *-Shadow.png
assets/FondoSprite/image{1,2}.png
        │  tools/gen_spritesheet.py
        ▼
spritesheet.js   (generado, ~200 KB, 1476 líneas)
        │  import
        ▼
código del juego (por escribir)
```

- Los assets siguen el formato PMD SpriteCollab: cada animación es una grilla donde la **columna es el frame** y la **fila es la dirección** (8 filas; `Sleep` tiene una sola y todas las direcciones apuntan a ella). El tamaño de frame cambia entre animaciones (p. ej. walk 56×72, attack 72×80).
- El generador lee tamaños y duraciones de `AnimData.xml` y saca los anclajes buscando píxeles de color en `*-Offsets.png` (negro = `head`, verde = `center`, rojo = `leftHand`, azul = `rightHand`) y el píxel blanco de `*-Shadow.png` (`shadow`).
- `spritesheet.js` exporta `TICK_MS`, `SHADOW_SIZE`, `DIRECTIONS`, `BACKGROUNDS`, `BACKGROUND_SEQUENCE`, `CHARIZARD` y los helpers `getFrame(anim, dir, i)` y `frameIndexAt(anim, ms, loop)`. Cada animación de `CHARIZARD` trae `src`, tamaños, `durations` (ticks de 1/60 s), `durationsMs`, `totalMs`, `events` opcionales (`rush`/`hit`/`return`, solo en ataques) y `frames[dir][i] = { sx, sy, sw, sh, center, head, leftHand, rightHand, shadow }`, con los anclajes relativos a la esquina superior izquierda del frame.
- Los dos fondos miden 2752×1536 y comparten encuadre, por lo que se pueden mezclar con crossfade (`globalAlpha`) sin que el escenario salte.
- La carpeta se llama `spriteChatizard` (con esa errata); las rutas del generador y de `spritesheet.js` dependen de ese nombre.

## Reglas al trabajar con los sprites

1. **No calcular coordenadas.** Usar siempre `spritesheet.js`.
2. **No leer `spritesheet.js` completo.** Leer solo la cabecera (líneas 1–37, hasta `export const CHARIZARD`) y el bloque de la animación que haga falta, localizándolo con `grep -n "^  walk:" spritesheet.js`.
3. Usar `getFrame` y `frameIndexAt` en vez de reimplementarlos.
4. Dibujar alineando por `frame.shadow` (los pies) para que Charizard no "salte" entre animaciones de distinto tamaño: `dx = px - f.shadow.x * escala`, `dy = py - f.shadow.y * escala`.
5. Los proyectiles (Lanzallamas) salen de `frame.head`.
6. No editar `spritesheet.js` a mano: regenerarlo. Los cambios en los helpers o en la cabecera se hacen en las plantillas de `tools/gen_spritesheet.py`.

Animaciones: `idle` · `walk` · `attack` · `jab` · `shoot` · `hover` · `swing` · `double` · `hop` · `charge` · `rotate` · `hurt` · `sleep`
Direcciones: `down` · `downRight` · `right` · `upRight` · `up` · `upLeft` · `left` · `downLeft`

## Flujo de specs

El proyecto tiene instaladas las skills `/spec` y `/spec-impl` (en `.agents/skills/`, enlazadas desde `.claude/skills/`, versiones fijadas en `skills-lock.json`). `/spec` redacta specs numeradas en `specs/NN-slug.md`; `/spec-impl` implementa una spec aprobada paso a paso, por defecto en una rama `spec-NN-slug`, y nunca hace commit por su cuenta. `/spec-impl` necesita git, así que hay que ejecutar `git init` antes de usarla.
