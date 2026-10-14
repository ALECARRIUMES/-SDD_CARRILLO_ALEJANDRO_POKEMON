import { BACKGROUNDS, CHARIZARD, getFrame, frameIndexAt } from "../spritesheet.js";

// Constantes ajustables
const PLAYER_SCALE = 4; // multiplicador del sprite, en píxeles del fondo

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

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Resolución interna igual al fondo; el escalado a la ventana lo hace CSS.
canvas.width = WORLD.w;
canvas.height = WORLD.h;

// Pixel art nítido al escalar
ctx.imageSmoothingEnabled = false;

// Imágenes cargadas
const images = { fondo1: null, idle: null, walk: null };

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

function drawBackground() {
  const bg = BACKGROUNDS.fondo1;
  ctx.drawImage(images.fondo1, bg.sx, bg.sy, bg.sw, bg.sh, 0, 0, WORLD.w, WORLD.h);
}

// Pies del frame; si el generador no encontró el anclaje shadow, centro inferior
function feetOf(frame) {
  return frame.shadow ?? { x: frame.sw / 2, y: frame.sh };
}

function drawPlayer() {
  const frame = getFrame(player.anim, player.dir, frameIndexAt(player.anim, player.animMs));
  const feet = feetOf(frame);
  const dx = player.x - feet.x * PLAYER_SCALE;
  const dy = player.y - feet.y * PLAYER_SCALE;
  ctx.drawImage(
    images[player.anim],
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    dx,
    dy,
    frame.sw * PLAYER_SCALE,
    frame.sh * PLAYER_SCALE,
  );
}

// Color liso mientras cargan las imágenes
ctx.fillStyle = "#2e7d32";
ctx.fillRect(0, 0, WORLD.w, WORLD.h);

[images.fondo1, images.idle, images.walk] = await Promise.all([
  loadImage(BACKGROUNDS.fondo1.src),
  loadImage(CHARIZARD.idle.src.anim),
  loadImage(CHARIZARD.walk.src.anim),
]);
function update(dtMs) {
  player.animMs += dtMs;
}

function render() {
  drawBackground();
  drawPlayer();
}

// Bucle principal: el delta sale del timestamp de requestAnimationFrame
let lastTime = null;

function loop(timestamp) {
  const dtMs = lastTime === null ? 0 : timestamp - lastTime;
  lastTime = timestamp;
  update(dtMs);
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
