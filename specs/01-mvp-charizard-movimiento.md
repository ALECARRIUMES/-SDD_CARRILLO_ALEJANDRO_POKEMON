# SPEC 01 — MVP: Charizard se mueve por el fondo 1

> **Estado:** aprobado
> **Depende de:** ninguna
> **Fecha:** 2026-10-08
> **Objetivo:** Mostrar el fondo 1 en un canvas y mover a Charizard por él con el teclado en 8 direcciones, animado con `idle` y `walk`.

## Alcance

**Dentro:**

- Página `index.html` con un único `<canvas>` que muestra el fondo 1 entero, escalado a la ventana sin deformarse.
- Módulo `src/main.js` con todo el código del juego, que importa `../spritesheet.js`.
- Movimiento con flechas y WASD a la vez, en 8 direcciones.
- Animación `walk` al moverse e `idle` al estar quieto, en la dirección actual.
- Límite de movimiento en los bordes del fondo.
- Sombra elíptica bajo Charizard.
- Mensaje en pantalla si falla la carga de una imagen.
- Actualización de `CLAUDE.md` con el comando para arrancar el juego.

**Fuera de alcance (para specs futuras):**

- Fondo 2 y la transición bosque → volcán.
- Colisiones con el escenario (río, árboles, puente, plataformas).
- Cámara que sigue al personaje.
- Ataques, Lanzallamas, vuelo (`hover`) y el resto de animaciones.
- Control por ratón, táctil o mando.
- Sonido, HUD, menús, pausa.
- Enemigos, vida, puntuación, guardado de partida.
- Node, `package.json`, bundler o tests automáticos.

## Modelo de datos

Todo vive en `src/main.js`. No se guarda nada entre sesiones.

```js
// Constantes ajustables
const PLAYER_SCALE = 4; // multiplicador del sprite, en píxeles del fondo
const PLAYER_SPEED = 600; // píxeles del fondo por segundo
const MARGIN = { x: 100, top: 260, bottom: 20 }; // margen de los pies respecto a cada borde

// Mundo: se lee de BACKGROUNDS.fondo1, no se escribe a mano
const WORLD = { w: BACKGROUNDS.fondo1.sw, h: BACKGROUNDS.fondo1.sh }; // 2752 × 1536

// Estado del jugador
const player = {
  x: WORLD.w / 2, // posición de los PIES (punto shadow), en píxeles del fondo
  y: WORLD.h / 2,
  dir: "down", // una de DIRECTIONS
  anim: "idle", // 'idle' | 'walk'
  animMs: 0, // tiempo transcurrido en la animación actual
};

// Teclas pulsadas, por event.code ('ArrowUp', 'KeyW', ...)
const keys = new Set();

// Imágenes cargadas
const images = { fondo1: null, idle: null, walk: null };
```

Convenciones:

- Origen arriba a la izquierda. Las coordenadas del juego son píxeles del fondo 1.
- El canvas tiene resolución interna `WORLD.w × WORLD.h`. El escalado a la ventana lo hace CSS.
- `player.x` y `player.y` son los pies. El sprite se dibuja en `dx = x - frame.shadow.x * PLAYER_SCALE`, `dy = y - frame.shadow.y * PLAYER_SCALE`.
- El tiempo se mide en milisegundos con el `timestamp` de `requestAnimationFrame`.
- Los frames salen siempre de `getFrame` y `frameIndexAt`. No se calcula ninguna coordenada de sprite.

Mapa de teclas:

| Sentido   | Teclas               |
| --------- | -------------------- |
| Arriba    | `ArrowUp`, `KeyW`    |
| Abajo     | `ArrowDown`, `KeyS`  |
| Izquierda | `ArrowLeft`, `KeyA`  |
| Derecha   | `ArrowRight`, `KeyD` |

## Plan de implementación

1. Crear `index.html` con un `<canvas id="game">` y el CSS que lo centra y lo ajusta a la ventana manteniendo la proporción. Crear `src/main.js`, cargado con `<script type="module">`, que fija la resolución interna del canvas y lo pinta de un color liso. Prueba manual: `python -m http.server 8000`, abrir `http://localhost:8000` y ver el rectángulo ajustarse al redimensionar la ventana.
2. Cargar la imagen de `BACKGROUNDS.fondo1` y dibujarla ocupando todo el canvas. Prueba manual: se ve el bosque completo.
3. Cargar las hojas `CHARIZARD.idle.src.anim` y `CHARIZARD.walk.src.anim`. Dibujar el primer frame de `idle` mirando hacia `down` en el centro, alineado por `shadow`, con `PLAYER_SCALE` y el suavizado de imagen desactivado. Prueba manual: Charizard aparece nítido y quieto en el centro.
4. Añadir el bucle con `requestAnimationFrame` y delta de tiempo. Animar `idle` con `frameIndexAt`. Prueba manual: Charizard respira.
5. Añadir la entrada por teclado: `keydown` y `keyup` mantienen `keys`, y `blur` de la ventana lo vacía. Calcular el vector de movimiento, normalizarlo en diagonal y mover a `PLAYER_SPEED`. Limitar la posición con `MARGIN`. Prueba manual: Charizard se desliza por el fondo y se detiene en los bordes.
6. Derivar `player.dir` del vector de movimiento y alternar `player.anim` entre `walk` e `idle`, reiniciando `animMs` al cambiar. Prueba manual: camina mirando hacia donde se mueve y al soltar se queda en `idle` con la última dirección.
7. Dibujar la sombra: una elipse negra semitransparente centrada en `(player.x, player.y)`, pintada antes que el sprite. Prueba manual: la sombra queda bajo los pies en las dos animaciones.
8. Esperar a que carguen las tres imágenes antes de iniciar el bucle. Si alguna falla, escribir en el canvas `No se pudo cargar: <ruta>` y registrar el error en la consola.
9. Actualizar `CLAUDE.md`: el juego ya existe, se arranca con `python -m http.server 8000` y el código vive en `src/main.js`.

## Criterios de aceptación

- [ ] Con `python -m http.server 8000` en la raíz, `http://localhost:8000` carga sin errores en la consola.
- [ ] El fondo 1 se ve entero, sin deformarse, y se reajusta al redimensionar la ventana.
- [ ] Charizard aparece en el centro del fondo, mirando hacia abajo y con la animación `idle`.
- [ ] Cada flecha mueve a Charizard en su sentido y la tecla WASD equivalente hace lo mismo.
- [ ] Pulsar dos teclas perpendiculares lo mueve en diagonal con el sprite diagonal correspondiente (`upRight`, `upLeft`, `downRight`, `downLeft`).
- [ ] Cruzar el fondo en diagonal tarda lo mismo por píxel que en horizontal: la velocidad diagonal no es mayor.
- [ ] Pulsar dos teclas opuestas a la vez deja a Charizard quieto en `idle`.
- [ ] Al moverse se reproduce `walk` y al soltar todas las teclas se reproduce `idle` mirando hacia la última dirección.
- [ ] Charizard no sale del fondo por ninguno de los cuatro bordes.
- [ ] Al pasar de `idle` a `walk` y viceversa, los pies no cambian de posición en pantalla.
- [ ] La sombra se ve bajo los pies y se dibuja por detrás del sprite.
- [ ] El sprite se ve con píxeles nítidos, sin difuminado.
- [ ] Las flechas no desplazan la página.
- [ ] Si se cambia la ventana de foco con una tecla pulsada, Charizard no sigue caminando solo al volver.
- [ ] Si se renombra temporalmente `assets/FondoSprite/image1.png`, el canvas muestra `No se pudo cargar: assets/FondoSprite/image1.png`.
- [ ] `spritesheet.js` no tiene cambios.

## Decisiones

- **Sí:** flechas y WASD a la vez, en 8 direcciones. `spritesheet.js` ya trae los sprites diagonales.
- **No:** solo 4 direcciones. Desperdicia la mitad de los sprites.
- **No:** clic para ir al punto. Queda para otra spec si se quiere.
- **Sí:** fondo entero escalado a la ventana, sin cámara. Es lo más simple y el fondo ya tiene un encuadre pensado para verse completo.
- **No:** cámara que sigue al personaje. Añade código y decisiones que el MVP no necesita.
- **Sí:** movimiento libre limitado solo por los bordes.
- **No:** zonas caminables. Hay que definirlas a mano sobre el fondo y merece su propia spec.
- **Sí:** solo `idle` y `walk`.
- **No:** `hover` ni ataques en esta spec.
- **Sí:** `index.html` más un único `src/main.js`. Se dividirá en módulos cuando el archivo lo pida.
- **No:** varios módulos desde el inicio, ni todo dentro de `index.html`.
- **Sí:** `python -m http.server`. No añade dependencias y Python ya es necesario para el generador.
- **No:** Vite ni `package.json`. No hay nada que compilar todavía.
- **Sí:** `PLAYER_SCALE = 4` como constante ajustable, con suavizado desactivado.
- **Sí:** sombra como elipse dibujada con canvas en el punto `shadow`.
- **No:** cargar las hojas `*-Shadow.png`. Triplicaría las imágenes por una sombra que una elipse resuelve.
- **Sí:** resolución interna del canvas igual al fondo (2752 × 1536) y escalado por CSS. Las coordenadas del juego coinciden con los píxeles del fondo y no hay que convertir nada.
- **Sí:** `event.code` en vez de `event.key`. WASD funciona igual en cualquier distribución de teclado.
- **Valores iniciales no consultados, ajustables en el código:** `PLAYER_SPEED = 600`, los tres valores de `MARGIN`, posición inicial en el centro, dirección inicial `down`, y tamaño y opacidad de la sombra.

## Riesgos

| Riesgo                                                                                       | Mitigación                                                                                          |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Un frame no trae el anclaje `shadow`: el generador lo omite si no encuentra el píxel.        | Si falta, usar el centro inferior del frame (`sw / 2`, `sh`) como pies.                             |
| Abrir `index.html` con doble clic (`file://`) bloquea el módulo ES y no se ve nada.          | El comando del servidor queda documentado en `CLAUDE.md`.                                           |
| Un canvas de 2752 × 1536 redibujado entero en cada frame puede ir lento en equipos modestos. | Si baja de 60 fps, reducir la resolución interna y escalar las coordenadas; se decide en otra spec. |
| El centro del fondo puede caer sobre el río o un árbol y verse raro como punto de partida.   | La posición inicial es una constante; se ajusta a ojo al probar el paso 3.                          |

## Lo que **no** entra en esta spec

- Fondo 2 y la transición entre fondos.
- Colisiones con el escenario.
- Cámara.
- Ataques, Lanzallamas, vuelo y cualquier animación distinta de `idle` y `walk`.
- Ratón, táctil o mando.
- Sonido, HUD, menús.
- Node, bundler o tests automáticos.

Cada una, si llega, va en su propia spec.
