# SPEC 01 — Barra de vida de Charizard

> **Estado:** Aprobado
> **Depende de:** SPEC 00 (`00-mvp-charizard-movimiento.md`)
> **Fecha:** 2026-10-14
> **Objetivo:** Dar a Charizard 100 PS visibles en una barra que baja con un placaje de prueba (H), lo debilita al llegar a 0 y se restaura con R.

## Por qué existe esta spec

Es la base del combate de la Feature 02. La lógica de PS se separa en un módulo puro, sin DOM ni canvas, para poder probarla con Node y reutilizarla después sin arrastrar el render. Esta spec no adelanta nada de la Feature 02: ni rivales, ni IA, ni turnos.

## Alcance

**Dentro:**

- Módulo `src/combat.js`, puro y sin imports, con combatiente identificado por nombre, PS, ataque, debilitamiento, restauración y nivel de color.
- Pruebas de lógica en `tests/combat.test.js` con `node:test` y `node:assert/strict`, ejecutables con `node --test tests/`.
- Barra de PS en el DOM, fija arriba a la izquierda del juego, con texto exacto `PS N/100` y color verde, amarillo o rojo.
- Tecla H: "Placaje de prueba" de potencia nominal 15. Aplica el daño efectivo.
- Aviso flotante en el canvas sobre Charizard con el nombre del ataque y el daño efectivo.
- Reacción `hurt` de 500 ms con el movimiento bloqueado.
- Estado debilitado a 0 PS: animación `sleep`, sin movimiento y sin daño adicional.
- Tecla R: restaura 100 PS y vuelve a `idle` con la misma dirección, desde cualquier estado.
- Línea discreta de controles bajo la barra: `H: placaje de prueba · R: restaurar`.
- Actualización de `CLAUDE.md` con la nueva estructura, el comando de pruebas y los controles.

**Fuera de alcance (para specs futuras):**

- Rivales, enemigos, IA, turnos y cualquier sistema de combate entre varios combatientes (Feature 02).
- Ataques de Charizard, Lanzallamas y el resto de animaciones de ataque.
- Barra animada (vaciado progresivo).
- Daño aleatorio, críticos, tipos o defensa.
- Invulnerabilidad temporal tras un golpe.
- Lista de combatientes para el HUD.
- Recuperación automática de PS.
- Fondo 2, sonido, menús y persistencia de PS entre sesiones.
- `package.json`, frameworks de pruebas y pruebas automáticas del navegador.

## Modelo de datos

### `src/combat.js`

Funciones puras: nunca modifican el objeto recibido, devuelven uno nuevo. Todas conservan `name` y `maxHp`.

```js
export const MAX_HP = 100;
export const TEST_ATTACK = { name: "Placaje de prueba", power: 15 }; // power = potencia nominal

// Combatiente
// { name: string, hp: number, maxHp: number }   0 <= hp <= maxHp

createCombatant({ name, maxHp = MAX_HP })  // → { name, hp: maxHp, maxHp }
applyAttack(combatant, attack)             // → { combatant, damage }   damage = min(attack.power, hp)
isFainted(combatant)                       // → hp === 0
restore(combatant)                         // → { name, hp: maxHp, maxHp }
hpLevel(hp, maxHp)                         // → "high" | "medium" | "low"
```

- **Nombre** (`name`): identifica al Pokémon. Lo fija `createCombatant` y ninguna operación lo cambia.
- **Potencia nominal** (`attack.power`): valor fijo del ataque.
- **Daño efectivo** (`damage`): lo que se resta de verdad, `min(power, hp)`. Con 0 PS es 0 y el combatiente devuelto tiene los mismos valores.
- `hpLevel`: `"high"` si `hp / maxHp > 0.5`; `"medium"` si `> 0.2` y `<= 0.5`; `"low"` si `<= 0.2`.

### `src/main.js` (añadidos)

```js
// Constantes ajustables
const HURT_MS = 500;   // duración de la reacción; hurt (166,7 ms) se repite en bucle
const POPUP_MS = 1000; // vida del aviso flotante
const HP_COLORS = { high: "#4caf50", medium: "#fbc02d", low: "#e53935" };

// Estado de combate de Charizard
let charizard = createCombatant({ name: "Charizard" });

// Añadidos a player
player.state = "normal"; // 'normal' | 'hurt' | 'fainted'
player.hurtMs = 0;       // tiempo restante de hurt
// player.anim pasa a admitir: 'idle' | 'walk' | 'hurt' | 'sleep'

// Aviso flotante (uno a la vez; uno nuevo reemplaza al anterior)
let popup = null; // { text: "Placaje de prueba −15 PS", ms: 0 }

// Imágenes cargadas
const images = { fondo1: null, idle: null, walk: null, hurt: null, sleep: null };
```

### Estados de Charizard (producto final)

| Estado    | Animación                         | Movimiento | H                                    | R                |
| --------- | --------------------------------- | ---------- | ------------------------------------ | ---------------- |
| `normal`  | `idle` / `walk` según el teclado  | Sí         | Daño + `hurt`                        | Restaura, `idle` |
| `hurt`    | `hurt` en bucle durante `HURT_MS` | No         | Si PS > 0: daño y reinicia `HURT_MS` | Restaura, `idle` |
| `fainted` | `sleep` en bucle                  | No         | Sin efecto (sin daño ni aviso)       | Restaura, `idle` |

Transiciones:

- Al terminar `HURT_MS`: si quedan PS, pasa a `normal` y en ese frame se aplica la regla del MVP (`walk` si hay teclas de movimiento pulsadas, `idle` si no); si los PS son 0, pasa a `fainted`.
- El golpe letal pasa por `hurt` y después por `sleep`. Durante esa transición la lógica ya marca 0 PS, así que H no hace daño.
- R borra el aviso y el temporizador de `hurt`, pone `animMs = 0` y conserva `player.dir`.

### Teclado

| Tecla  | Acción            |
| ------ | ----------------- |
| `KeyH` | Placaje de prueba |
| `KeyR` | Restaurar PS      |

- `keys` sigue registrando `keydown` y `keyup` en todos los estados, así que siempre refleja el teclado real.
- H y R ignoran los eventos con `event.repeat`: mantener H da un solo golpe.
- H y R no forman parte del mapa de movimiento.

### Interfaz

- Un `<div id="stage">` con `position: relative` envuelve al canvas. El HUD es `position: absolute; top: 12px; left: 12px` dentro de él, con tamaños en px fijos (barra de unos 200 × 16 px, texto de 16 px) y `pointer-events: none`.
- Nombre: `charizard.name` (`Charizard`) sobre la barra.
- Texto: `PS N/100`, con los PS actuales y máximos. En `fainted` se añade `Debilitado`.
- Ancho del relleno: `hp / maxHp`, sin animación.
- El aviso flotante se dibuja en el canvas sobre la cabeza de Charizard, sube y se desvanece durante `POPUP_MS`. Muestra el daño efectivo con signo menos tipográfico: `−15 PS`, `−10 PS`.

## Plan de implementación

Cada paso deja el juego funcionando y se verifica antes de su commit. Los criterios de aceptación describen el producto final; la línea **Verificación** de cada paso indica qué se comprueba al cerrarlo.

1. Crear `src/combat.js` con la API del modelo de datos y `tests/combat.test.js` con los casos L1–L10. `src/main.js` no cambia.
   **Verificación:** `node --test tests/` pasa (L1–L10 y el criterio de módulo puro). El juego se comporta igual que el MVP (V14).

2. Añadir el HUD: `#stage` en `index.html`, `createCombatant({ name: "Charizard" })` en `main.js` y el render de barra, color y texto con `hpLevel` y `HP_COLORS`. Todavía sin línea de controles.
   **Verificación:** se ven el nombre `Charizard` y `PS 100/100` con la barra llena y verde, sin línea de controles. V13 y V14.

3. Añadir la tecla H: `applyAttack(charizard, TEST_ATTACK)`, actualización del HUD, aviso flotante con el daño efectivo, `event.repeat` ignorado y línea de controles con solo `H: placaje de prueba`. Al llegar a 0 PS, el movimiento queda bloqueado de inmediato: `update` no mueve a Charizard si `isFainted(charizard)` y lo deja en `idle` con su dirección.
   **Verificación:** la línea de controles muestra solo `H: placaje de prueba`. V2, V3, V8, V9 (sin `sleep`: Charizard sigue en `idle`) y V12.
   **Comportamiento temporal (hasta el paso 5):** a 0 PS Charizard queda quieto en `idle`, sin `sleep` ni texto `Debilitado`, y no hay R. Para repetir la prueba se recarga la página.

4. Añadir el estado `hurt`: cargar `CHARIZARD.hurt.src.anim`, temporizador `HURT_MS`, bloqueo del movimiento y vuelta a `normal` según el teclado. Tras el golpe letal, `hurt` termina en el bloqueo del paso 3.
   **Verificación:** V4, V5, V6, V16 (entre `idle`, `walk` y `hurt`) y V15 para `Hurt-Anim.png`.
   **Comportamiento temporal (hasta el paso 5):** el mismo del paso 3. Se repite la prueba recargando la página.

5. Añadir el estado `fainted` y la tecla R: cargar `CHARIZARD.sleep.src.anim`, golpe letal `hurt` → `sleep`, texto `Debilitado`, `restore` con R y línea de controles completa `H: placaje de prueba · R: restaurar`.
   **Verificación:** V1, V7, V8, V9, V10, V11, V15 para `Sleep-Anim.png` y V16 completo. Ya no hace falta recargar para repetir la prueba.

6. Actualizar `CLAUDE.md`: estructura con `src/combat.js` y `tests/`, el comando `node --test tests/` (Node ≥ 22) y los controles H y R.
   **Verificación:** la lista completa de criterios de aceptación.

## Criterios de aceptación

Describen el producto final, al terminar el paso 6.

### Lógica (`node --test tests/`)

- [ ] L1. `createCombatant({ name: "Charizard" })` devuelve `{ name: "Charizard", hp: 100, maxHp: 100 }`.
- [ ] L2. Siete `applyAttack(c, TEST_ATTACK)` seguidos dejan los PS en 85, 70, 55, 40, 25, 10 y 0, con daños 15, 15, 15, 15, 15, 15 y 10.
- [ ] L3. Un octavo ataque con 0 PS devuelve `damage === 0` y `hp === 0`.
- [ ] L4. Un ataque de potencia 50 sobre 10 PS devuelve `damage === 10` y `hp === 0`.
- [ ] L5. `isFainted` es `false` con 1 PS y `true` con 0.
- [ ] L6. `restore` devuelve `hp === 100` desde 0 PS y desde 40 PS.
- [ ] L7. Con `maxHp = 100`, `hpLevel` da: 100 → `high`, 51 → `high`, 50 → `medium`, 21 → `medium`, 20 → `low`, 0 → `low`.
- [ ] L8. Con `maxHp = 200`, `hpLevel(100, 200)` es `medium` y `hpLevel(40, 200)` es `low`.
- [ ] L9. `applyAttack` y `restore` no modifican el objeto recibido.
- [ ] L10. El combatiente devuelto por `applyAttack` y por `restore` conserva `name` y `maxHp`. `createCombatant({ name: "Prueba", maxHp: 200 })` devuelve `{ name: "Prueba", hp: 200, maxHp: 200 }`.
- [ ] `src/combat.js` no importa nada ni usa `window`, `document` o el canvas.

### Navegador (`python -m http.server 8000`)

- [ ] V1. Al cargar, el HUD muestra el nombre `Charizard`, la barra llena y verde, el texto `PS 100/100` y se ve la línea `H: placaje de prueba · R: restaurar`.
- [ ] V2. Siete pulsaciones de H muestran `PS 85/100`, `70/100`, `55/100`, `40/100`, `25/100`, `10/100` y `0/100`. La barra es verde en 85, 70 y 55, amarilla en 40 y 25, y roja en 10. En 0 está vacía.
- [ ] V3. Los avisos muestran `Placaje de prueba −15 PS` en los golpes 1 a 6 y `Placaje de prueba −10 PS` en el séptimo.
- [ ] V4. Un golpe con PS > 0 cambia la animación a `hurt` durante unos 0,5 s, y las flechas no mueven a Charizard mientras dura.
- [ ] V5. Si una flecha está pulsada durante `hurt` y se mantiene, Charizard camina al terminar `hurt` sin soltarla ni volver a pulsarla.
- [ ] V6. Si no hay teclas pulsadas al terminar `hurt`, Charizard vuelve a `idle` mirando hacia la misma dirección.
- [ ] V7. El séptimo golpe muestra `hurt` y después `sleep`, y el HUD indica `Debilitado`.
- [ ] V8. Con 0 PS, las flechas y WASD no cambian la posición de Charizard ni su animación.
- [ ] V9. Con 0 PS, tres pulsaciones de H dejan `PS 0/100`, sin aviso ni cambio de animación.
- [ ] V10. R desde debilitado muestra `PS 100/100` en verde, Charizard en `idle` con la dirección previa, sin aviso residual, y se mueve con normalidad.
- [ ] V11. R durante `hurt` cancela la reacción: Charizard queda en `idle` con `PS 100/100`.
- [ ] V12. Mantener H pulsada aplica un solo golpe (−15).
- [ ] V13. Con la ventana ancha, estrecha y baja, la barra sigue arriba a la izquierda del juego con el mismo tamaño legible.
- [ ] V14. No hay regresiones del MVP: 8 direcciones, diagonal normalizada, límites del fondo, sombra, `blur` que detiene el movimiento y flechas que no desplazan la página.
- [ ] V15. Si se renombra temporalmente `assets/spriteChatizard/Hurt-Anim.png` o `Sleep-Anim.png`, el canvas muestra `No se pudo cargar: <ruta>`.
- [ ] V16. Los pies de Charizard no cambian de posición en pantalla al pasar entre `idle`, `walk`, `hurt` y `sleep`.
- [ ] La consola no muestra errores durante el funcionamiento normal (V1–V14 y V16). En V15 el 404 de la imagen renombrada y el error de carga registrado son esperados.
- [ ] `spritesheet.js` no tiene cambios.

## Decisiones

- **Sí:** lógica de combate en `src/combat.js`, pura y sin imports. Se prueba con Node y la Feature 02 la reutiliza.
- **Sí:** `main.js` se encarga de la interacción, las animaciones, el HUD y el render.
- **No:** rivales, IA, turnos o sistemas de combate avanzados. Son la Feature 02.
- **Sí:** el combatiente lleva `name` además de `hp` y `maxHp`, y se crea con `createCombatant({ name, maxHp })`. La Feature 02 podrá distinguir combatientes sin cambiar la API.
- **Sí:** funciones que devuelven un combatiente nuevo y conservan `name` y `maxHp`. Las pruebas son simples y no hay efectos ocultos.
- **Sí:** ataque "Placaje de prueba" con potencia nominal fija (15) y daño efectivo `min(potencia, PS)`. La secuencia 100 → 0 es reproducible y los PS nunca son negativos.
- **No:** daño aleatorio. Rompe la secuencia exacta de los criterios.
- **Sí:** `hpLevel` devuelve un nivel y `main.js` lo traduce a color. Los colores son del render.
- **Sí:** umbrales > 50 % verde, > 20 % y ≤ 50 % amarillo, ≤ 20 % rojo. Los límites exactos se prueban en la lógica (L7, L8) porque la secuencia de 15 PS no los alcanza.
- **Sí:** barra con ancho instantáneo.
- **No:** barra animada. Hace que los valores intermedios dependan del tiempo y no aporta a esta feature.
- **Sí:** HUD en el DOM con tamaños en px fijos.
- **No:** HUD dibujado en el canvas. Se escalaría con la ventana y perdería legibilidad.
- **No:** lista de combatientes para el HUD. Hoy solo existe Charizard; `createCombatant` ya permite crear más.
- **Sí:** aviso flotante en el canvas, uno a la vez. No es DOM, así que no captura el foco ni el teclado.
- **Sí:** `hurt` como reacción, repetido en bucle durante `HURT_MS = 500`. Una sola pasada (166,7 ms) es imperceptible.
- **No:** invulnerabilidad temporal. Añade temporizadores y frenaría la prueba de la secuencia; H durante `hurt` aplica daño.
- **Sí:** golpe letal `hurt` → `sleep`. Se ve el impacto antes del debilitamiento.
- **Sí:** `sleep` como estado debilitado, sin movimiento ni daño adicional.
- **Sí:** movimiento bloqueado a 0 PS desde el paso 3, antes de que existan `sleep` y R. Ningún paso intermedio contradice la regla de que un Charizard debilitado no se mueve.
- **Sí:** R restaura desde cualquier estado y vuelve a `idle` conservando la dirección. Se añade en el paso 5; hasta entonces se recarga la página.
- **No:** recuperación automática. El reinicio es explícito.
- **Sí:** la línea de controles crece con cada paso: solo H en los pasos 3 y 4, H y R desde el paso 5. Nunca anuncia una tecla que todavía no funciona.
- **Sí:** `keys` sigue el teclado real en todos los estados y H/R ignoran `event.repeat`. Al salir de `hurt` o pulsar R no quedan teclas fantasma ni golpes repetidos.
- **Sí:** pruebas con `node:test` y `node:assert/strict`, incluidos en Node ≥ 22. Cambia la decisión de SPEC 00 de no usar Node: ahora existe lógica independiente del navegador que conviene probar.
- **No:** Jest, Vitest o `package.json`. Añaden dependencias que `node:test` no necesita.
- **Sí:** separar pruebas de lógica (automáticas) y pruebas visuales (manuales).
- **Sí:** la barra aparece en el paso 2, antes de que exista H, para observar los efectos del ataque desde el paso 3.
- **Valores iniciales no consultados, ajustables en el código:** `HURT_MS = 500`, `POPUP_MS = 1000` y los tres colores de `HP_COLORS`.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Node trata `src/combat.js` como CommonJS al no haber `package.json`. | Node ≥ 22 detecta la sintaxis ES de forma automática. El requisito queda documentado en `CLAUDE.md`. |
| `combat.js` acaba importando `spritesheet.js` o tocando el DOM y deja de cargar en Node. | Criterio explícito: `combat.js` no importa nada. `node --test` falla si se rompe. |
| En los pasos 3 y 4 no hay forma de recuperar PS dentro del juego. | Comportamiento temporal documentado en esos pasos: se recarga la página. El paso 5 añade R. |
| `sleep` (56 × 40) tiene un tamaño distinto al de `idle` y `walk`. | Se dibuja alineado por `frame.shadow`, igual que el resto (criterio V16). |
| El HUD en el DOM se desalinea del canvas al cambiar el tamaño de la ventana. | `#stage` envuelve al canvas y el HUD se posiciona respecto a él (criterio V13). |

## Lo que **no** entra en esta spec

- Rivales, enemigos, IA y turnos.
- Ataques de Charizard y Lanzallamas.
- Barra animada, daño aleatorio e invulnerabilidad temporal.
- Lista de combatientes en el HUD.
- Recuperación automática de PS.
- Fondo 2, sonido, menús y guardado.
- `package.json` y frameworks de pruebas.

Cada una, si llega, va en su propia spec.
