# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del proyecto

Juego 2D en `<canvas>` con Charizard como personaje y dos fondos (bosque → volcán). Están implementados:

- El MVP (`specs/00-mvp-charizard-movimiento.md`): Charizard se mueve por el fondo 1 con flechas/WASD en 8 direcciones, animado con `idle` y `walk`.
- La barra de vida (`specs/01-barra-de-vida.md`): Charizard tiene 100 PS en un HUD, los pierde con un placaje de prueba (H), reacciona con `hurt`, se debilita con `sleep` a 0 PS y se restaura con R.
- El rival por turnos (`specs/02-rival-por-turnos.md`): un "Charizard rival" azul (los mismos sprites con rojo y azul intercambiados) fijo en el fondo. Cerca de él, Enter inicia un combate por turnos que termina en victoria o derrota.

`index.html` contiene el canvas, los dos HUD y el banner, y carga `src/main.js` como módulo. No hay `package.json`, ni build, ni linter. Las pruebas automáticas cubren solo la lógica pura (`combat.js`, `battle.js`, `recolor.js`), con el runner incluido en Node.

Controles:

| Tecla | Exploración | Combate |
| --- | --- | --- |
| Flechas / WASD | Moverse | Sin efecto |
| `H` | "Placaje de prueba" (potencia nominal 15; el daño efectivo nunca supera los PS restantes, por eso el séptimo golpe resta 10) | Sin efecto |
| `R` | Restaura a los dos Pokémon (100 PS, `idle`, sin avisos) | Sin efecto |
| `Enter` | Inicia el combate a menos de 400 px del rival, si ninguno está debilitado y Charizard no está en `hurt` | Vuelve a exploración, solo con el resultado visible |
| `Espacio` | Sin efecto | Arañazo, solo en el turno de Charizard |

## Comandos

Arrancar el juego (desde la raíz del proyecto) y abrir `http://localhost:8000`:

```
python -m http.server 8000
```

Ejecutar las pruebas de lógica (requiere Node ≥ 22, sin dependencias ni `package.json`):

```
node --test
```

Sin argumentos, Node encuentra los `tests/*.test.js` (`combat`, `battle`, `recolor`). No usar `node --test tests/`: en Node ≥ 22 el argumento es un patrón de archivos y una carpeta falla con `Cannot find module`.

Las pruebas automáticas validan la lógica (PS, turnos, secuencias de victoria y derrota, recoloreado de píxeles, pureza de los módulos). Todo lo visual —animaciones, HUD, banner, teclado, posiciones, errores de carga— se verifica a mano en el navegador con los criterios `V*` de cada spec.

Regenerar `spritesheet.js` cuando cambien los assets (requiere Python con Pillow: `pip install pillow`):

```
python tools/gen_spritesheet.py .
```

El argumento es la raíz del proyecto. Al terminar imprime `missing anchors: N [...]`: los frames en los que no se encontró algún píxel de anclaje.

`spritesheet.js` y los módulos de `src/` son módulos ES (`export`/`import`), así que el juego se carga con `<script type="module">` y debe servirse por HTTP; abrir `index.html` con `file://` no funciona. Requisitos: Python 3 para servir el juego (y Pillow solo para regenerar `spritesheet.js`), un navegador moderno, y Node ≥ 22 solo para las pruebas.

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
src/battle.js    (turnos, puro)  ──import──►  src/combat.js  (PS y daño, puro)
src/recolor.js   (recoloreado del rival, puro)
tests/           (combat, battle y recolor; node --test)
```

Los tres módulos de lógica son puros (sin `window`, `document` ni canvas) y no modifican lo que reciben: devuelven objetos nuevos. Cada uno tiene una prueba que lo comprueba.

- `src/combat.js`: combatiente `{ name, hp, maxHp }`. Exporta `MAX_HP`, `TEST_ATTACK` (`{ name: "Placaje de prueba", power: 15 }`), `createCombatant({ name, maxHp })`, `applyAttack`, `isFainted`, `restore` y `hpLevel`. `applyAttack` devuelve `{ combatant, damage }`, donde el daño efectivo es `min(power, hp)`, así que los PS nunca bajan de 0. `hpLevel` devuelve `high` (> 50 %), `medium` (> 20 %) o `low`.
- `src/battle.js`: combate `{ phase, player, rival }`, con `phase` en `playerTurn` → `rivalTurn` → … hasta `victory` o `defeat`. Exporta `PLAYER_ATTACK` (Arañazo, 25), `RIVAL_ATTACK` (Placaje, 20), `canStartBattle`, `createBattle` (recibe los PS tal cual), `playerAttack` y `rivalAttack` (→ `{ battle, damage, accepted }`; fuera de turno o tras el final devuelven el mismo combate con `accepted: false`), `isOver` y `finishBattle` (PS finales, o `null` si sigue el combate). Desde 100 PS gana Charizard (rival 75 → C 80 → … → rival 0); desde 40 pierde (rival 75 → C 20 → rival 50 → C 0).
- `src/recolor.js`: `recolorPixels(data)` intercambia R y B de cada píxel con `A > 0`; A y los píxeles totalmente transparentes no cambian.
- `src/main.js`: teclado, entidades, animaciones, HUD, banner y coordinación del combate.
  - Entidades: `player` y `rivalEntity` comparten modelo (`x`, `y`, `dir`, `anim`, `animMs`, `state`, `hurtMs`). `state` es `normal`, `hurt` (500 ms, `HURT_MS`, sin movimiento) o `fainted` (`sleep`). Cada golpe reinicia `hurt` y el golpe letal pasa por `hurt` y después a `fainted`. Se dibujan alineadas por `frame.shadow` y ordenadas por `y`; el rival usa `rivalImages`, copias recoloreadas una vez al cargar en canvas auxiliares (las imágenes originales no se tocan).
  - Modos: `mode` es `explore` o `battle`. Al entrar se guarda `explorePose` y Charizard se coloca a 320 px a la izquierda del rival mirando a la derecha; al salir recupera posición y dirección. El derrotado sigue en `sleep` y R restaura a los dos.
  - Etapas (`stage`): `awaitInput` → (Espacio) `playerAttacking` → `rivalWaiting` (800 ms, `RIVAL_DELAY_MS`, desde el fin de la animación de Charizard) → `rivalAttacking` → `awaitInput`; con un debilitado, `resolving` → (perdedor en `sleep`) `result` → (Enter) exploración.
  - Ataques: `action = { who, ms, hitApplied }`, uno a la vez. `attack` se reproduce sin bucle; el daño se aplica una sola vez cuando `action.ms` alcanza `ATTACK_HIT_MS` (suma de `durationsMs` antes de `events.hit`, ≈ 250 ms de 450). Los umbrales son por tiempo para no saltarse el impacto si se pierden fotogramas.
  - PS: en exploración mandan `charizard` y `rival`; en combate, `battle.player` y `battle.rival`. HUD y reacciones leen siempre de `hpSource()` y la única transferencia es `finishBattle` al salir.
  - Teclas: H, R, Enter y Espacio ignoran `event.repeat`; H y R solo actúan en exploración.
- Interfaz (DOM dentro de `#stage`, px fijos, `pointer-events: none`): HUD de Charizard arriba a la izquierda (con la línea de controles, oculta en combate), HUD del rival arriba a la derecha, resaltado con borde en el HUD de quien tiene el turno, y banner abajo en el centro (`Enter: combatir`, turno y resultado). Los HUD se actualizan con `renderHud()` solo cuando cambian; los avisos flotantes de daño se dibujan en el canvas sobre `frame.head` del defensor.

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
