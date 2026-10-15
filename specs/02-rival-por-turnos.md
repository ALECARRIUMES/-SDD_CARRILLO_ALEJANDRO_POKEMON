# SPEC 02 — Rival por turnos

> **Estado:** Aprobado
> **Depende de:** SPEC 00 (`00-mvp-charizard-movimiento.md`), SPEC 01 (`01-barra-de-vida.md`)
> **Fecha:** 2026-10-14
> **Objetivo:** Añadir un "Charizard rival" fijo en el escenario contra el que Charizard combate por turnos (Arañazo 25 contra Placaje 20) hasta que uno queda debilitado.

## Por qué existe esta spec

La Feature 01 dio PS a Charizard, pero no hay contra quién combatir. Esta spec añade un rival controlado por la computadora y un combate por turnos determinista, reutilizando `src/combat.js` sin cambiarlo. La lógica de turnos y el recoloreado van en módulos puros, probados con Node. `src/main.js` solo orquesta la entrada, los tiempos, las animaciones y la interfaz.

## Alcance

**Dentro:**

- Módulo puro `src/battle.js`: fases del combate, ataques por turno y transferencia de PS.
- Módulo puro `src/recolor.js`: intercambio de los canales rojo y azul.
- Pruebas en `tests/battle.test.js` y `tests/recolor.test.js`, ejecutadas con `node --test` junto a las 11 existentes.
- "Charizard rival": los sprites de Charizard recoloreados una sola vez al cargar, fijo en `RIVAL_POS`, con su propio HUD arriba a la derecha.
- Inicio del combate por proximidad (`BATTLE_RANGE = 400`) con Enter, solo si se cumplen las condiciones.
- Colocación de Charizard frente al rival al empezar y vuelta a su posición y dirección al terminar.
- Turnos: Charizard ataca con Espacio (Arañazo, 25), el rival responde solo (Placaje, 20) unos 800 ms después.
- Animación `attack` con el daño aplicado en el evento `hit`; `hurt` y `sleep` reutilizados de la Feature 01 para los dos.
- Banner de turno y resultado, y resaltado del HUD de quien actúa.
- H y R deshabilitadas en combate. R restaura a los dos Pokémon en exploración.
- Actualización de `CLAUDE.md`.

**Fuera de alcance (para specs futuras):**

- Otros Pokémon, sprites descargados o cambios en `tools/gen_spritesheet.py` o `spritesheet.js`.
- Varios rivales, combates múltiples o combates entre más de dos.
- IA con decisiones, menú de ataques, PP, tipos, estadísticas, críticos o daño aleatorio.
- Huida, pausa, recuperación automática de PS.
- Escenario de combate aparte o transiciones animadas entre modos.
- Colisiones entre Charizard y el rival.
- Experiencia, niveles, objetos, captura, multijugador, guardado y persistencia.
- Fondo 2 y sonido.
- Cambios en la Spec 01.

## Modelo de datos

### `src/battle.js`

Puro: solo importa `./combat.js`. Ninguna función modifica el combate recibido.

```js
export const PLAYER_ATTACK = { name: "Arañazo", power: 25 };
export const RIVAL_ATTACK = { name: "Placaje", power: 20 };

// Combate
// { phase: "playerTurn" | "rivalTurn" | "victory" | "defeat", player, rival }
// player y rival son combatientes de combat.js: { name, hp, maxHp }

canStartBattle(player, rival)  // → !isFainted(player) && !isFainted(rival)
createBattle(player, rival)    // → { phase: "playerTurn", player, rival }   PS tal cual, sin restaurar
playerAttack(battle)           // → { battle, damage, accepted }   solo en playerTurn
rivalAttack(battle)            // → { battle, damage, accepted }   solo en rivalTurn
isOver(battle)                 // → phase === "victory" || phase === "defeat"
finishBattle(battle)           // → { player, rival } si isOver; null si no
```

- `playerAttack` aplica `applyAttack(rival, PLAYER_ATTACK)`. Si el rival queda a 0 PS, la fase pasa a `victory`; si no, a `rivalTurn`.
- `rivalAttack` aplica `applyAttack(player, RIVAL_ATTACK)`. Si Charizard queda a 0 PS, la fase pasa a `defeat`; si no, a `playerTurn`.
- Una acción rechazada (fuera de turno o tras el final) devuelve `{ battle: <el mismo objeto>, damage: 0, accepted: false }`.

### `src/recolor.js`

```js
recolorPixels(data) // data: Uint8ClampedArray RGBA → Uint8ClampedArray nuevo
```

- Píxel con `A > 0`: intercambia R y B; G y A no cambian.
- Píxel con `A === 0` (totalmente transparente): se copia sin ningún cambio.
- Devuelve un array nuevo de la misma longitud. El array recibido queda intacto.
- Puro y sin imports.

### `src/main.js` (añadidos)

```js
// Constantes ajustables
const RIVAL_POS = { x: WORLD.w * 0.75, y: WORLD.h / 2 }; // pies del rival
const BATTLE_RANGE = 400;   // distancia máxima entre pies para combatir
const BATTLE_OFFSET = 320;  // Charizard se coloca en (RIVAL_POS.x − BATTLE_OFFSET, RIVAL_POS.y)
const RIVAL_DELAY_MS = 800; // espera del rival tras el ataque de Charizard
// Instante del impacto: suma de CHARIZARD.attack.durationsMs antes de events.hit (≈ 250 ms)
const ATTACK_HIT_MS = /* calculado al cargar, no escrito a mano */;

// Combatientes de exploración
let charizard = createCombatant({ name: "Charizard" });     // ya existe (SPEC 01)
let rival = createCombatant({ name: "Charizard rival" });

// Entidad dibujable del rival (mismo modelo que player)
const rivalEntity = { x: RIVAL_POS.x, y: RIVAL_POS.y, dir: "left", anim: "idle", animMs: 0, state: "normal", hurtMs: 0 };
// player y rivalEntity admiten anim: 'idle' | 'walk' | 'hurt' | 'sleep' | 'attack'

// Avisos flotantes: uno por combatiente; uno nuevo reemplaza al anterior del mismo combatiente
const popups = { player: null, rival: null }; // { text, ms }

// Hojas recoloreadas del rival (canvas auxiliares del mismo tamaño que la original)
const rivalImages = { idle: null, hurt: null, sleep: null, attack: null };

// Combate
let mode = "explore"; // 'explore' | 'battle'
let battle = null;    // estado de battle.js mientras mode === 'battle'
let stage = null;     // 'awaitInput' | 'playerAttacking' | 'rivalWaiting' | 'rivalAttacking' | 'resolving' | 'result'
let action = null;    // { who: 'player' | 'rival', ms, hitApplied }
let rivalDelay = 0;   // ms restantes de rivalWaiting
let explorePose = null; // { x, y, dir } de Charizard antes del combate
```

### Fuente de verdad de los PS

- En exploración, `charizard` y `rival` son los PS actuales.
- Al iniciar, `battle = createBattle(charizard, rival)` recibe esos PS sin restaurarlos.
- Durante el combate, `battle.player` y `battle.rival` son la única fuente. No hay sincronización por acción.
- Los HUD y los avisos leen siempre de `hpSource()`: `battle ? { player: battle.player, rival: battle.rival } : { player: charizard, rival }`.
- Al salir: `({ player: charizard, rival } = finishBattle(battle)); battle = null;`. Es la única transferencia.
- `src/combat.js` no cambia.

### Etapas del combate (`stage`)

| Etapa             | Fase lógica                     | Entrada aceptada                                   | Avanza cuando |
| ----------------- | ------------------------------- | -------------------------------------------------- | ------------- |
| `awaitInput`      | `playerTurn`                    | Espacio (no repetido) si Charizard no está en `hurt` | Espacio → `playerAttacking` |
| `playerAttacking` | `playerTurn` → `rivalTurn`/`victory` en el impacto | ninguna                           | Fin de la animación: `victory` → `resolving`; si no → `rivalWaiting` con `rivalDelay = RIVAL_DELAY_MS` |
| `rivalWaiting`    | `rivalTurn`                     | ninguna                                            | `rivalDelay <= 0` → `rivalAttacking` |
| `rivalAttacking`  | `rivalTurn` → `playerTurn`/`defeat` en el impacto | ninguna                          | Fin de la animación: `defeat` → `resolving`; si no → `awaitInput` |
| `resolving`       | `victory` / `defeat`            | ninguna                                            | El perdedor entra en `fainted` (`sleep`) → `result` |
| `result`          | `victory` / `defeat`            | Enter (no repetido)                                | Enter → salida a `explore` |

Reglas:

- **Impacto:** cuando `!action.hitApplied && action.ms >= ATTACK_HIT_MS`, se llama una vez a `playerAttack` o `rivalAttack`, se marca `hitApplied` y se aplican el aviso y el `hurt` del defensor.
- **Fin de la animación:** cuando `action.ms >= CHARIZARD.attack.totalMs` (450 ms). En el mismo `update` se comprueba primero el impacto y después el fin, así que un `dt` grande no se salta el impacto.
- **Retraso del rival:** empieza al terminar la animación de ataque de Charizard. `rivalDelay` se asigna solo al entrar en `rivalWaiting` y solo esa etapa lo descuenta. No se usa `setTimeout`.
- **Golpe letal:** con la fase en `victory` o `defeat` no se entra en `rivalWaiting` ni en `rivalAttacking`, y la lógica rechazaría el ataque.
- **Una acción a la vez:** `action` es única y solo `awaitInput` crea una nueva.

### Entrada y salida del combate

- **Condiciones para Enter en exploración:** distancia entre `(player.x, player.y)` y `RIVAL_POS` menor que `BATTLE_RANGE`, `canStartBattle(charizard, rival)` y `player.state !== "hurt"`.
- **Al entrar:** `explorePose = { x, y, dir }`, Charizard pasa a `(RIVAL_POS.x − BATTLE_OFFSET, RIVAL_POS.y)` mirando a `right`, `idle`, `mode = "battle"`, `stage = "awaitInput"`.
- **Al salir (Enter en `result`):** transferencia de PS, Charizard vuelve a `explorePose`. Si está debilitado, sigue en `fainted` con `sleep`; si no, `normal` con `idle`. El rival queda en `idle` mirando a `left`, o en `sleep` si perdió. `stage`, `action` y `explorePose` vuelven a `null`.

### Restauración con R (solo en exploración)

R deja a los dos Pokémon en un estado completo y coherente:

- PS: `charizard = restore(charizard)` y `rival = restore(rival)`.
- Charizard: `state = "normal"`, `anim = "idle"`, `animMs = 0`, `hurtMs = 0`, conserva `dir`.
- Rival: `state = "normal"`, `anim = "idle"`, `animMs = 0`, `hurtMs = 0`, `dir = "left"`, en `RIVAL_POS`.
- Avisos: `popups.player = null` y `popups.rival = null`.
- Ninguno queda en `sleep` ni en `hurt` después de R.
- `keys` no se toca: si hay una flecha pulsada, Charizard camina en el siguiente frame (como en la SPEC 01).

### Teclado

| Tecla   | Exploración                              | Combate                                  |
| ------- | ---------------------------------------- | ---------------------------------------- |
| Flechas / WASD | Movimiento (MVP)                  | Sin efecto                               |
| `KeyH`  | Placaje de prueba (SPEC 01)              | Sin efecto                               |
| `KeyR`  | Restaura a Charizard **y** al rival      | Sin efecto                               |
| `Enter` | Inicia el combate si se cumplen las condiciones | Solo en `result`: vuelve a exploración |
| `Space` | Sin efecto                               | Solo en `awaitInput`: Arañazo            |

- Enter y Espacio ignoran `event.repeat`. Espacio llama a `preventDefault`.
- `keys` sigue el teclado real en todos los modos; `blur` lo vacía como en el MVP.

### Interfaz

- HUD de Charizard: arriba a la izquierda, mismo aspecto que en la SPEC 01.
- HUD del rival: `#hud-rival`, arriba a la derecha (`top: 12px; right: 12px`), mismo formato: `Charizard rival`, barra, `PS N/100` y `Debilitado`.
- Ventana estrecha: cada HUD tiene `max-width: calc(50% - 18px)` y su barra `width: min(200px, 100%)`. Con la ventana ancha se ven igual que en la SPEC 01; con la estrecha, las barras se acortan y los dos HUD no se tocan. El texto mantiene 16 px.
- Resaltado: el HUD de quien tiene el turno lleva un borde (Charizard en `awaitInput` y `playerAttacking`; el rival en `rivalWaiting` y `rivalAttacking`). Ninguno en `resolving` y `result`.
- Banner `#banner`: DOM, **abajo en el centro** (`bottom: 12px`), px fijos, `max-width: calc(100% - 24px)`, texto que salta de línea si no cabe, `pointer-events: none`. Al estar abajo no se superpone con los HUD de arriba. Textos:
  - Exploración en rango y con condiciones: `Enter: combatir`.
  - Exploración en rango con alguno debilitado: `R: restaurar para combatir`.
  - `awaitInput` y `playerAttacking`: `Turno de Charizard — Espacio: Arañazo`.
  - `rivalWaiting` y `rivalAttacking`: `Turno de Charizard rival…`.
  - `result`: `¡Charizard gana! — Enter: volver` o `Charizard se ha debilitado — Enter: volver`.
  - En el resto de casos, oculto.
- La línea de controles de la SPEC 01 (`H: placaje de prueba · R: restaurar`) se oculta en combate.
- Avisos flotantes sobre el defensor: `Arañazo −25 PS`, `Placaje −20 PS`, con el daño efectivo.
- Orden de dibujo por `y`: la entidad con los pies más abajo se dibuja delante.

## Plan de implementación

Cada paso deja el juego funcionando y se verifica antes de su commit. La línea **Verificación** indica qué se comprueba al cerrarlo; los criterios de aceptación describen el producto final.

1. Crear `src/battle.js` y `tests/battle.test.js` con los casos B1–B11. `src/main.js` no cambia.
   **Verificación:** `node --test` pasa (B1–B11 y las 11 pruebas de la SPEC 01). El juego se comporta igual (V18).

2. Crear `src/recolor.js` y `tests/recolor.test.js` (R1–R4 y módulo puro). Generalizar el dibujo y la sombra a entidades, sin cambiar a Charizard. Recolorear `Idle-Anim.png` en un canvas auxiliar. Dibujar al rival en `RIVAL_POS` en `idle` mirando a `left`, con orden por `y`. Añadir `#hud-rival` con `Charizard rival` y `PS 100/100`, y el `max-width` de los dos HUD.
   **Verificación:** `node --test`. V1, V19, V17, V18 y V22 para los dos HUD (el banner aún no existe).
   **Temporal:** el rival es decorativo.

3. Entrar en combate: rango, banner de inicio, condiciones, `explorePose`, colocación, `mode = "battle"`, `stage = "awaitInput"`, bloqueo de movimiento, H y R, banner de turno, resaltado y línea de controles oculta.
   **Verificación:** V3, V4, V5, V6, V7 y V22 con el banner.
   **Temporal:** no se puede salir del combate; se recarga la página.

4. Ciclo de turnos con **daño inmediato**: Espacio en `awaitInput` llama a `playerAttack` al momento, `rivalWaiting` con `rivalDelay` único, `rivalAttack`, avisos por combatiente y `hurt`/`sleep` del defensor reutilizando la reacción de la SPEC 01. Recolorear `Hurt-Anim.png` y `Sleep-Anim.png`.
   **Verificación:** secuencias de PS de V11 y V12 en los dos HUD, V9 (sin animación de ataque), una sola respuesta del rival por turno.
   **Temporal:** el retraso del rival empieza al pulsar Espacio. Al llegar a 0 PS el combate queda en `resolving` sin banner; se recarga la página.

5. Animación de ataque: cargar `Attack-Anim.png` y su versión recoloreada, `action` con `ATTACK_HIT_MS`, impacto una sola vez antes del fin, retraso del rival desde el fin de la animación de Charizard.
   **Verificación:** V2, V8, V9, V10 y V20.
   **Temporal:** igual que el paso 4 al llegar a 0 PS.

6. Fin del combate: `resolving` → `result` cuando el perdedor entra en `sleep`, banner de resultado, Enter vuelve a exploración con `finishBattle` y `explorePose`, R restaura a los dos en exploración con estados, temporizadores y avisos reiniciados.
   **Verificación:** V11–V16, V21 y V23.

7. Actualizar `CLAUDE.md`: `src/battle.js`, `src/recolor.js`, `tests/`, controles Enter y Espacio, etapas del combate, fuente de verdad de los PS y el cambio de R.
   **Verificación:** la lista completa de criterios de aceptación.

## Criterios de aceptación

Describen el producto final, al terminar el paso 7.

### Lógica (`node --test`)

- [ ] B1. `createBattle(c40, r100)` devuelve `phase === "playerTurn"`, `player.hp === 40` y `rival.hp === 100`: no restaura los PS.
- [ ] B2. Tras `playerAttack` la fase es `rivalTurn`; tras `rivalAttack` vuelve a `playerTurn`.
- [ ] B3. Desde 100/100, alternando ataques: rival 75, Charizard 80, rival 50, Charizard 60, rival 25, Charizard 40, rival 0, y la fase es `victory`.
- [ ] B4. Desde Charizard 40 y rival 100: rival 75, Charizard 20, rival 50, Charizard 0, y la fase es `defeat`.
- [ ] B5. `rivalAttack` en `playerTurn` y `playerAttack` en `rivalTurn` devuelven `accepted: false`, `damage: 0` y el mismo objeto de combate.
- [ ] B6. En `victory` y en `defeat`, `playerAttack` y `rivalAttack` devuelven `accepted: false` y `damage: 0`.
- [ ] B7. Tras el golpe letal de Charizard, `rivalAttack` se rechaza y los PS de Charizard no cambian.
- [ ] B8. Ninguna función de `battle.js` modifica el combate ni los combatientes recibidos.
- [ ] B9. `finishBattle` devuelve `null` en `playerTurn` y `rivalTurn`. En un combate terminado devuelve los PS finales sin restaurar, conservando `name` y `maxHp`.
- [ ] B10. `canStartBattle` es `false` si cualquiera de los dos tiene 0 PS y `true` si los dos tienen PS.
- [ ] B11. `src/battle.js` solo importa `./combat.js` y no usa `window`, `document` ni el canvas.
- [ ] R1. `recolorPixels` convierte `[240, 128, 48, 255]` en `[48, 128, 240, 255]`.
- [ ] R2. El canal A no cambia en ningún píxel: `[240, 128, 48, 100]` da `[48, 128, 240, 100]`.
- [ ] R3. Los píxeles totalmente transparentes no cambian: `[0, 0, 0, 0]` y `[240, 128, 48, 0]` se devuelven idénticos.
- [ ] R4. El resultado es un array nuevo de la misma longitud y el array recibido queda intacto.
- [ ] `src/recolor.js` no importa nada ni usa `window`, `document` ni el canvas.
- [ ] Las 11 pruebas de la SPEC 01 siguen pasando.

### Navegador (`python -m http.server 8000`)

- [ ] V1. Al cargar, el rival se ve azul en `RIVAL_POS`, en `idle` mirando a la izquierda, y su HUD arriba a la derecha muestra `Charizard rival`, la barra verde y `PS 100/100`. Charizard conserva sus colores originales.
- [ ] V2. Los pies del rival no cambian de posición en pantalla al pasar entre `idle`, `attack`, `hurt` y `sleep`.
- [ ] V3. Al cargar no aparece el banner. A menos de 400 px del rival aparece `Enter: combatir` y desaparece al alejarse.
- [ ] V4. En rango con Charizard o el rival debilitado, el banner muestra `R: restaurar para combatir` y Enter no inicia el combate.
- [ ] V5. En rango con Charizard en `hurt`, Enter no inicia el combate.
- [ ] V6. Enter en rango inicia el combate: Charizard aparece frente al rival mirando a la derecha, el banner muestra `Turno de Charizard — Espacio: Arañazo`, su HUD está resaltado y la línea `H: placaje de prueba · R: restaurar` está oculta.
- [ ] V7. En combate, flechas, WASD, H y R no tienen efecto, y Enter no sale de un combate activo.
- [ ] V8. Espacio reproduce `attack` en Charizard. La barra del rival baja a `75/100` en el impacto, no al pulsar. Aparece `Arañazo −25 PS` sobre el rival, que reproduce `hurt`.
- [ ] V9. Mantener Espacio, pulsarlo varias veces durante la animación o durante el turno del rival produce un solo ataque por turno.
- [ ] V10. Al terminar la animación de ataque de Charizard empieza `rivalWaiting`: el banner muestra `Turno de Charizard rival…` y el HUD del rival se resalta, sin cambios en los PS. Unos 0,8 s después el rival empieza su ataque una sola vez; Charizard baja a `80/100` y aparece `Placaje −20 PS` al alcanzar el evento `hit` de esa animación, no al empezar la espera.
- [ ] V11. Victoria desde 100: el rival pasa por 75, 50, 25 y 0, y Charizard por 80, 60 y 40. El rival hace `hurt` y luego `sleep`, su HUD indica `Debilitado`, no responde, y después aparece `¡Charizard gana! — Enter: volver`.
- [ ] V12. Derrota: H ×4 en exploración (40 PS), esperar a que termine `hurt` e iniciar el combate. El rival pasa por 75 y 50, y Charizard por 20 y 0. Charizard hace `hurt` y luego `sleep`, y después aparece `Charizard se ha debilitado — Enter: volver`.
- [ ] V13. Enter antes de que aparezca el banner de resultado no hace nada. Con el banner visible, Enter vuelve a exploración: Charizard regresa a la posición y la dirección que tenía antes del combate y los dos HUD conservan sus PS.
- [ ] V14. Mantener Enter pulsado al volver no inicia otro combate.
- [ ] V15. Tras la victoria, el rival sigue en `sleep` y Charizard se mueve con `PS 40/100`. Tras la derrota, Charizard sigue en `sleep` y no se mueve.
- [ ] V16. R en exploración deja a los dos en `PS 100/100`, el rival en `idle` mirando a la izquierda y Charizard en `idle`. Se puede iniciar un combate nuevo y repetir V11.
- [ ] V17. En exploración, la SPEC 01 funciona igual: H con su secuencia y `hurt`, debilitamiento a 0 PS y R.
- [ ] V18. No hay regresiones del MVP: 8 direcciones, diagonal normalizada, límites del fondo, sombra, `blur` y flechas que no desplazan la página.
- [ ] V19. Al caminar por delante y por detrás del rival, se dibuja delante quien tiene los pies más abajo.
- [ ] V20. Si se renombra temporalmente `assets/spriteChatizard/Attack-Anim.png`, el canvas muestra `No se pudo cargar: assets/spriteChatizard/Attack-Anim.png`.
- [ ] V21. Cambiar de ventana durante el combate no lo pausa ni rompe los turnos. Al volver, ninguna tecla de movimiento queda activa.
- [ ] V22. Con la ventana ancha, baja y estrecha (hasta 480 px de ancho), los dos HUD siguen arriba en sus esquinas sin tocarse, el banner sigue abajo en el centro sin cubrir ningún HUD, y los textos se leen completos.
- [ ] V23. Tras una victoria o una derrota, R en exploración deja a los dos sin `sleep` ni `hurt`, sin avisos flotantes y sin `Debilitado`. Si se pulsa H justo antes de R, R cancela el `hurt` de Charizard.
- [ ] La consola no muestra errores durante el funcionamiento normal. En V20 el 404 de la imagen renombrada y el error de carga son esperados.
- [ ] `spritesheet.js`, `src/combat.js` y `specs/01-barra-de-vida.md` no tienen cambios.

## Decisiones

- **Sí:** "Charizard rival" con los sprites de Charizard y los canales rojo y azul intercambiados. Se distingue claramente sin assets nuevos.
- **No:** otro Pokémon con sprites descargados. Exige assets y cambios en el generador; sería casi otra feature.
- **No:** `ctx.filter` o una paleta "variocolor" por HSL. El soporte de `ctx.filter` varía entre navegadores y HSL es más frágil de probar.
- **Sí:** recoloreado una sola vez al cargar, en canvas auxiliares del mismo tamaño. Los originales no se tocan y `getFrame`, `shadow` y `head` siguen sirviendo.
- **Sí:** `recolorPixels` en `src/recolor.js`, puro y probado.
- **Sí:** lógica de turnos en `src/battle.js`, pura, sobre `combat.js` sin cambiarlo.
- **Sí:** inicio por proximidad (400 px) con Enter.
- **No:** Enter en cualquier lugar. El rival en el mapa perdería sentido.
- **Sí:** no se puede iniciar con un debilitado ni con Charizard en `hurt`.
- **Sí:** colocación instantánea frente al rival y vuelta a la posición y dirección previas al salir.
- **No:** combatir sin recolocar. El ataque podría verse de espaldas o solapado y la prueba no sería reproducible.
- **No:** escenario de combate aparte o transiciones animadas.
- **Sí:** Arañazo 25 y Placaje 20, 100 PS cada uno, Charizard primero. Victoria desde 100 y derrota desde 40 son reproducibles.
- **No:** daño aleatorio, tipos, críticos, PP o menú de cuatro ataques.
- **Sí:** H ×4 en exploración como forma de preparar la derrota. Reutiliza la SPEC 01.
- **Sí:** daño en el evento `hit` de `attack`, detectado por tiempo (`ATTACK_HIT_MS`).
- **No:** daño al pulsar Espacio. No coincidiría con la animación.
- **No:** detectar el impacto por índice de frame exacto. Un salto de fotogramas podría saltárselo.
- **Sí:** doble protección de turnos: la lógica rechaza acciones fuera de turno y `main.js` solo acepta Espacio en `awaitInput` con una única `action`.
- **Sí:** retraso del rival como campo descontado en `update`, asignado solo al entrar en `rivalWaiting`.
- **No:** `setTimeout` para el rival. Es fácil duplicarlo y no está ligado al bucle.
- **Sí:** `battle.player` y `battle.rival` como única fuente durante el combate, `hpSource()` para leer y una sola transferencia al salir.
- **No:** sincronizar los PS en cada acción. Habría dos estados vivos que podrían desincronizarse.
- **Sí:** resultado visible solo cuando el perdedor entra en `sleep`; Enter vuelve solo con el resultado visible.
- **No:** huida ni salida de un combate activo.
- **Sí:** al volver se conservan los PS y el debilitado sigue en `sleep`.
- **No:** restaurar los PS al salir o recuperación automática. R ya cumple esa función.
- **Sí:** H y R deshabilitadas en combate; R restaura a los dos en exploración. Cambia la regla de la SPEC 01 ("R desde cualquier estado"), que no se modifica porque está implementada; el cambio queda registrado aquí.
- **Sí:** dos HUD explícitos (Charizard y rival) en vez de una lista genérica de combatientes.
- **Sí:** un aviso flotante por combatiente.
- **Sí:** orden de dibujo por `y`, sin colisiones.
- **Sí:** sin pausa al cambiar de ventana; `blur` solo vacía las teclas, como en el MVP.
- **Sí:** errores de carga con el mecanismo existente; el juego sigue requiriendo HTTP.
- **Sí:** R reinicia PS, estado, animación, temporizadores y avisos de los dos. Ninguno queda en `sleep` o `hurt` con la vida completa.
- **Sí:** los píxeles totalmente transparentes se copian sin cambios. El recoloreado no altera zonas invisibles de la hoja.
- **Sí:** banner abajo en el centro y `max-width` en los HUD. Es la forma más simple de que no se superpongan en ventanas estrechas.
- **No:** rediseñar el HUD, reducir la fuente o añadir pantallas para ventanas estrechas. Por debajo de 480 px de ancho no se garantiza la separación.
- **Sí:** siete pasos independientes, uno por responsabilidad.
- **Valores iniciales no consultados, ajustables en el código:** `RIVAL_POS`, `BATTLE_OFFSET = 320`, el estilo del resaltado y la posición exacta del banner.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Un `dt` grande (pestaña en segundo plano) salta el impacto o el fin de la animación. | Umbrales por tiempo; en cada `update` se comprueba primero el impacto y después el fin (V21). |
| Los HUD muestran PS obsoletos. | `hpSource()` es la única lectura y los combatientes de exploración solo cambian al salir (B9, V13). |
| Ataque doble por pulsaciones rápidas o tecla mantenida. | `event.repeat` ignorado, `action` única, Espacio solo en `awaitInput` y rechazo en la lógica (B5, V9). |
| El recoloreado afecta al Charizard del jugador. | Canvas auxiliares separados; las imágenes originales no se tocan (V1). |
| `getImageData` falla con `file://`. | El juego ya requiere HTTP y está documentado en `CLAUDE.md`. |
| Generalizar el dibujo a entidades rompe la SPEC 01 o el MVP. | El paso 2 verifica V17 y V18 antes de su commit. |
| En los pasos 3 a 5 no se puede salir del combate. | Comportamiento temporal documentado en cada paso: se recarga la página. El paso 6 lo resuelve. |
| `src/main.js` crece demasiado. | La lógica pura vive en `battle.js` y `recolor.js`; `main.js` solo orquesta. |
| El `max-width` de los HUD altera la barra de la SPEC 01. | Solo actúa en ventanas estrechas; con la ventana ancha la barra mide 200 px como antes (V17, V22). |
| R deja restos de un estado anterior (avisos, `hurt`, `sleep`). | La restauración reinicia todos los campos de las dos entidades (V23). |

## Lo que **no** entra en esta spec

- Otros Pokémon, sprites nuevos o cambios en el generador.
- Varios rivales o combates múltiples.
- IA con decisiones, menú de ataques, PP, tipos, críticos o daño aleatorio.
- Huida, pausa y recuperación automática.
- Escenario de combate aparte y colisiones.
- Experiencia, niveles, objetos, captura, multijugador y guardado.
- Fondo 2 y sonido.
- Cambios en la SPEC 01.

Cada una, si llega, va en su propia spec.
