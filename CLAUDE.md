# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del proyecto

Juego 2D en `<canvas>` con Charizard como personaje y dos fondos (bosque → volcán). Están implementados:

- El MVP (`specs/00-mvp-charizard-movimiento.md`): Charizard se mueve por el fondo 1 con flechas/WASD en 8 direcciones, animado con `idle` y `walk`.
- La barra de vida (`specs/01-barra-de-vida.md`): Charizard tiene 100 PS en un HUD, los pierde con un placaje de prueba (H), reacciona con `hurt`, se debilita con `sleep` a 0 PS y se restaura con R.

`index.html` contiene el canvas y el HUD, y carga `src/main.js` como módulo. No hay `package.json`, ni build, ni linter. Las únicas pruebas automáticas son las de la lógica de combate, con el runner incluido en Node.

Controles: flechas/WASD para moverse · `H` "Placaje de prueba" (potencia nominal 15; el daño efectivo nunca supera los PS restantes, por eso el séptimo golpe resta 10) · `R` restaurar los PS.

## Comandos

Arrancar el juego (desde la raíz del proyecto) y abrir `http://localhost:8000`:

```
python -m http.server 8000
```

Ejecutar las pruebas de lógica (requiere Node ≥ 22, sin dependencias ni `package.json`):

```
node --test
```

Sin argumentos, Node encuentra `tests/combat.test.js`. No usar `node --test tests/`: en Node ≥ 22 el argumento es un patrón de archivos y una carpeta falla con `Cannot find module`.

Regenerar `spritesheet.js` cuando cambien los assets (requiere Python con Pillow: `pip install pillow`):

```
python tools/gen_spritesheet.py .
```

El argumento es la raíz del proyecto. Al terminar imprime `missing anchors: N [...]`: los frames en los que no se encontró algún píxel de anclaje.

`spritesheet.js`, `src/main.js` y `src/combat.js` son módulos ES (`export`/`import`), así que el juego se carga con `<script type="module">` y debe servirse por HTTP; abrir `index.html` con `file://` no funciona. Requisitos: Python 3 para servir el juego (y Pillow solo para regenerar `spritesheet.js`), un navegador moderno, y Node ≥ 22 solo para las pruebas.

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
src/main.js      (juego; index.html lo carga como módulo)
        ▲  import
src/combat.js    (lógica de PS pura; tests/combat.test.js la prueba con node --test)
```

- `src/combat.js` es puro: no importa nada ni usa `window`, `document` o el canvas, para poder probarlo en Node y reutilizarlo en la Feature 02. Exporta `MAX_HP`, `TEST_ATTACK` (`{ name: "Placaje de prueba", power: 15 }`), `createCombatant({ name, maxHp })`, `applyAttack`, `isFainted`, `restore` y `hpLevel`. Las funciones no modifican el combatiente `{ name, hp, maxHp }`: devuelven uno nuevo. `applyAttack` devuelve `{ combatant, damage }`, donde el daño efectivo es `min(power, hp)`, así que los PS nunca bajan de 0. `hpLevel` devuelve `high` (> 50 %), `medium` (> 20 %) o `low`.
- `src/main.js` se encarga del teclado, las animaciones, el HUD y el render. `player.state` es `normal`, `hurt` (500 ms, `HURT_MS`, sin movimiento) o `fainted` (`sleep`, sin movimiento ni daño). Cada golpe reinicia `hurt`. El golpe letal pasa por `hurt` y después a `fainted`. R vuelve a `normal`/`idle` desde cualquier estado conservando la dirección. H y R ignoran `event.repeat`.
- El HUD (nombre, barra, `PS N/100`, `Debilitado` y controles) es DOM dentro de `#stage`, en px fijos y con `pointer-events: none`, para que no se escale con el canvas. Se actualiza con `renderHud()` solo cuando cambian los PS o el estado. El aviso flotante del daño se dibuja en el canvas sobre `frame.head`.

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

El proyecto tiene instaladas las skills `/spec` y `/spec-impl` (en `.agents/skills/`, enlazadas desde `.claude/skills/`, versiones fijadas en `skills-lock.json`). `/spec` redacta specs numeradas en `specs/NN-slug.md`; `/spec-impl` implementa una spec aprobada paso a paso, por defecto en una rama `spec-NN-slug`, y nunca hace commit por su cuenta. El trabajo se hace en la rama `sdd/ejercicio-final`; `specs/.spec-config.yml` tiene `AutoCreateBranch: false` para que `/spec-impl` no cree ramas sin preguntar.
