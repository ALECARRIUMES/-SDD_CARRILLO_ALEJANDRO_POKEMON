import { BACKGROUNDS, CHARIZARD, getFrame, frameIndexAt } from "../spritesheet.js";
import { TEST_ATTACK, createCombatant, applyAttack, isFainted, hpLevel } from "./combat.js";

// Constantes ajustables
const PLAYER_SCALE = 4; // multiplicador del sprite, en píxeles del fondo
const PLAYER_SPEED = 600; // píxeles del fondo por segundo
const MARGIN = { x: 100, top: 260, bottom: 20 }; // margen de los pies respecto a cada borde
const SHADOW_ELLIPSE = { rx: 64, ry: 20, alpha: 0.35 }; // sombra bajo los pies, en píxeles del fondo
const HP_COLORS = { high: "#4caf50", medium: "#fbc02d", low: "#e53935" }; // relleno de la barra por nivel
const HURT_MS = 500; // duración de la reacción; hurt (166,7 ms) se repite en bucle
const POPUP_MS = 1000; // vida del aviso flotante
const POPUP_RISE = 120; // cuánto sube el aviso durante su vida, en píxeles del fondo

// Mundo: se lee de BACKGROUNDS.fondo1, no se escribe a mano
const WORLD = { w: BACKGROUNDS.fondo1.sw, h: BACKGROUNDS.fondo1.sh }; // 2752 × 1536

// Estado del jugador
const player = {
  x: WORLD.w / 2, // posición de los PIES (punto shadow), en píxeles del fondo
  y: WORLD.h / 2,
  dir: "down", // una de DIRECTIONS
  anim: "idle", // 'idle' | 'walk' | 'hurt'
  animMs: 0, // tiempo transcurrido en la animación actual
  state: "normal", // 'normal' | 'hurt'
  hurtMs: 0, // tiempo restante de hurt
};

// Estado de combate de Charizard
let charizard = createCombatant({ name: "Charizard" });

// Aviso flotante (uno a la vez; uno nuevo reemplaza al anterior)
let popup = null; // { text: "Placaje de prueba −15 PS", ms: 0 }

// Teclas pulsadas, por event.code ('ArrowUp', 'KeyW', ...)
const keys = new Set();

// Mapa de teclas por sentido
const KEYMAP = {
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
};
const GAME_KEYS = new Set(Object.values(KEYMAP).flat());

function isPressed(sense) {
  return KEYMAP[sense].some((code) => keys.has(code));
}

window.addEventListener("keydown", (event) => {
  // H: un golpe por pulsación; mantenerla no repite el ataque
  if (event.code === "KeyH") {
    if (!event.repeat) testAttack();
    return;
  }
  if (!GAME_KEYS.has(event.code)) return;
  event.preventDefault(); // las flechas no desplazan la página
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

// Al perder el foco no llega el keyup: se vacía para que no siga caminando solo
window.addEventListener("blur", () => {
  keys.clear();
});

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Resolución interna igual al fondo; el escalado a la ventana lo hace CSS.
canvas.width = WORLD.w;
canvas.height = WORLD.h;

// Pixel art nítido al escalar
ctx.imageSmoothingEnabled = false;

// Imágenes cargadas
const images = { fondo1: null, idle: null, walk: null, hurt: null };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    img.src = src;
  });
}

function drawLoadErrors(messages) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = "#fff";
  ctx.font = "64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineHeight = 96;
  const top = WORLD.h / 2 - ((messages.length - 1) * lineHeight) / 2;
  messages.forEach((message, i) => ctx.fillText(message, WORLD.w / 2, top + i * lineHeight));
}

function drawBackground() {
  const bg = BACKGROUNDS.fondo1;
  ctx.drawImage(images.fondo1, bg.sx, bg.sy, bg.sw, bg.sh, 0, 0, WORLD.w, WORLD.h);
}

// Pies del frame; si el generador no encontró el anclaje shadow, centro inferior
function feetOf(frame) {
  return frame.shadow ?? { x: frame.sw / 2, y: frame.sh };
}

function drawShadow() {
  ctx.save();
  ctx.globalAlpha = SHADOW_ELLIPSE.alpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(player.x, player.y, SHADOW_ELLIPSE.rx, SHADOW_ELLIPSE.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function playerFrame() {
  return getFrame(player.anim, player.dir, frameIndexAt(player.anim, player.animMs));
}

function drawPlayer() {
  const frame = playerFrame();
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

// HUD en el DOM: se actualiza solo cuando cambian los PS, no en cada frame
const hud = {
  root: document.getElementById("hud"),
  name: document.getElementById("hud-name"),
  fill: document.getElementById("hud-fill"),
  text: document.getElementById("hud-text"),
};

function renderHud() {
  hud.name.textContent = charizard.name;
  hud.fill.style.width = `${(charizard.hp / charizard.maxHp) * 100}%`;
  hud.fill.style.backgroundColor = HP_COLORS[hpLevel(charizard.hp, charizard.maxHp)];
  hud.text.textContent = `PS ${charizard.hp}/${charizard.maxHp}`;
}

// Placaje de prueba: con 0 PS no hay daño ni aviso.
// Cada golpe (re)inicia la reacción hurt; no hay invulnerabilidad.
function testAttack() {
  if (isFainted(charizard)) return;
  const { combatant, damage } = applyAttack(charizard, TEST_ATTACK);
  charizard = combatant;
  popup = { text: `${TEST_ATTACK.name} −${damage} PS`, ms: 0 };
  renderHud();
  player.state = "hurt";
  player.hurtMs = HURT_MS;
  setAnim("hurt");
}

// Aviso sobre la cabeza: sube y se desvanece durante POPUP_MS
function drawPopup() {
  if (!popup) return;
  const frame = playerFrame();
  const feet = feetOf(frame);
  const head = frame.head ?? { x: feet.x, y: 0 };
  const t = popup.ms / POPUP_MS;
  const x = player.x + (head.x - feet.x) * PLAYER_SCALE;
  const y = player.y + (head.y - feet.y) * PLAYER_SCALE - 40 - t * POPUP_RISE;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#000";
  ctx.strokeText(popup.text, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(popup.text, x, y);
  ctx.restore();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Dirección del sprite según el signo del vector: DIR_BY_VECTOR[vy + 1][vx + 1]
const DIR_BY_VECTOR = [
  ["upLeft", "up", "upRight"],
  ["left", null, "right"],
  ["downLeft", "down", "downRight"],
];

function setAnim(anim) {
  if (player.anim === anim) return;
  player.anim = anim;
  player.animMs = 0;
}

function update(dtMs) {
  if (popup) {
    popup.ms += dtMs;
    if (popup.ms >= POPUP_MS) popup = null;
  }

  // Durante hurt no se mueve. Al terminar, este mismo frame sigue abajo:
  // walk o idle según el teclado, o el bloqueo si se quedó sin PS
  if (player.state === "hurt") {
    player.hurtMs -= dtMs;
    if (player.hurtMs > 0) {
      player.animMs += dtMs;
      return;
    }
    player.state = "normal";
  }

  // Con 0 PS no se mueve: queda en idle con su dirección (sleep llega en el paso 5)
  if (isFainted(charizard)) {
    setAnim("idle");
    player.animMs += dtMs;
    return;
  }

  // Vector de movimiento; teclas opuestas se anulan
  let vx = (isPressed("right") ? 1 : 0) - (isPressed("left") ? 1 : 0);
  let vy = (isPressed("down") ? 1 : 0) - (isPressed("up") ? 1 : 0);

  // Moviéndose: walk hacia el vector. Quieto: idle con la última dirección
  const moving = vx !== 0 || vy !== 0;
  if (moving) player.dir = DIR_BY_VECTOR[vy + 1][vx + 1];
  setAnim(moving ? "walk" : "idle");

  // Normalizado: en diagonal no se va más rápido
  const length = Math.hypot(vx, vy);
  if (length > 0) {
    vx /= length;
    vy /= length;
  }

  const step = (PLAYER_SPEED * dtMs) / 1000;
  player.x = clamp(player.x + vx * step, MARGIN.x, WORLD.w - MARGIN.x);
  player.y = clamp(player.y + vy * step, MARGIN.top, WORLD.h - MARGIN.bottom);

  player.animMs += dtMs;
}

function render() {
  drawBackground();
  drawShadow(); // antes que el sprite: queda por detrás
  drawPlayer();
  drawPopup(); // encima del sprite
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

// Arranque: el bucle empieza solo cuando todas las imágenes han cargado
ctx.fillStyle = "#2e7d32"; // color liso mientras cargan
ctx.fillRect(0, 0, WORLD.w, WORLD.h);

const sources = {
  fondo1: BACKGROUNDS.fondo1.src,
  idle: CHARIZARD.idle.src.anim,
  walk: CHARIZARD.walk.src.anim,
  hurt: CHARIZARD.hurt.src.anim,
};
const results = await Promise.allSettled(Object.values(sources).map(loadImage));
const errors = results.filter((r) => r.status === "rejected").map((r) => r.reason);

if (errors.length > 0) {
  errors.forEach((error) => console.error(error));
  drawLoadErrors(errors.map((error) => error.message));
} else {
  Object.keys(sources).forEach((name, i) => (images[name] = results[i].value));
  renderHud();
  hud.root.hidden = false; // el HUD aparece junto con el juego, no sobre el mensaje de error
  requestAnimationFrame(loop);
}
