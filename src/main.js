import { BACKGROUNDS, CHARIZARD, getFrame, frameIndexAt } from "../spritesheet.js";
import { TEST_ATTACK, createCombatant, applyAttack, isFainted, restore, hpLevel } from "./combat.js";
import {
  PLAYER_ATTACK,
  RIVAL_ATTACK,
  canStartBattle,
  createBattle,
  playerAttack,
  rivalAttack,
} from "./battle.js";
import { recolorPixels } from "./recolor.js";

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

const RIVAL_POS = { x: WORLD.w * 0.75, y: WORLD.h / 2 }; // pies del rival
const BATTLE_RANGE = 400; // distancia máxima entre pies para combatir
const BATTLE_OFFSET = 320; // en combate, Charizard se coloca en (RIVAL_POS.x − BATTLE_OFFSET, RIVAL_POS.y)
const RIVAL_DELAY_MS = 800; // espera del rival antes de responder

// Estado del jugador
const player = {
  x: WORLD.w / 2, // posición de los PIES (punto shadow), en píxeles del fondo
  y: WORLD.h / 2,
  dir: "down", // una de DIRECTIONS
  anim: "idle", // 'idle' | 'walk' | 'hurt' | 'sleep'
  animMs: 0, // tiempo transcurrido en la animación actual
  state: "normal", // 'normal' | 'hurt' | 'fainted'
  hurtMs: 0, // tiempo restante de hurt
};

// Rival: entidad dibujable con el mismo modelo que player, fija en RIVAL_POS
const rivalEntity = {
  x: RIVAL_POS.x,
  y: RIVAL_POS.y,
  dir: "left",
  anim: "idle",
  animMs: 0,
  state: "normal",
  hurtMs: 0,
};

// Combatientes de exploración
let charizard = createCombatant({ name: "Charizard" });
let rival = createCombatant({ name: "Charizard rival" });

// Combate
let mode = "explore"; // 'explore' | 'battle'
let battle = null; // estado de battle.js mientras mode === 'battle'
let stage = null; // 'awaitInput' | 'playerAttacking' | 'rivalWaiting' | 'rivalAttacking' | 'resolving' | 'result'
let explorePose = null; // { x, y, dir } de Charizard antes del combate
let rivalDelay = 0; // ms restantes de rivalWaiting

// Única lectura de los PS: en combate manda battle; en exploración, los combatientes de exploración
function hpSource() {
  return battle ? { player: battle.player, rival: battle.rival } : { player: charizard, rival };
}

// Avisos flotantes: uno por combatiente; uno nuevo reemplaza al anterior del mismo combatiente
const popups = { player: null, rival: null }; // { text: "Placaje de prueba −15 PS", ms: 0 }

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
  // H y R: una vez por pulsación, solo en exploración
  if (event.code === "KeyH") {
    if (!event.repeat && mode === "explore") testAttack();
    return;
  }
  if (event.code === "KeyR") {
    if (!event.repeat && mode === "explore") restoreCharizard();
    return;
  }
  // Espacio: Arañazo, solo en combate; nunca desplaza la página
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat && mode === "battle") playerAction();
    return;
  }
  // Enter: inicia el combate si se cumplen las condiciones
  if (event.code === "Enter" || event.code === "NumpadEnter") {
    if (!event.repeat && mode === "explore" && canEnterBattle()) startBattle();
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
const images = { fondo1: null, idle: null, walk: null, hurt: null, sleep: null };

// Hojas recoloreadas del rival: canvas auxiliares del mismo tamaño que la original
const rivalImages = { idle: null, hurt: null, sleep: null, attack: null };

// Copia la hoja en un canvas auxiliar y la recolorea una sola vez; la imagen original no se toca
function recolorSheet(img) {
  const sheet = document.createElement("canvas");
  sheet.width = img.width;
  sheet.height = img.height;
  const sheetCtx = sheet.getContext("2d");
  sheetCtx.drawImage(img, 0, 0);
  const { data } = sheetCtx.getImageData(0, 0, img.width, img.height);
  sheetCtx.putImageData(new ImageData(recolorPixels(data), img.width, img.height), 0, 0);
  return sheet;
}

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

function drawShadow(entity) {
  ctx.save();
  ctx.globalAlpha = SHADOW_ELLIPSE.alpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(entity.x, entity.y, SHADOW_ELLIPSE.rx, SHADOW_ELLIPSE.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function entityFrame(entity) {
  return getFrame(entity.anim, entity.dir, frameIndexAt(entity.anim, entity.animMs));
}

// sheets: images (Charizard) o rivalImages; los frames y anclajes son los mismos
function drawEntity(entity, sheets) {
  const frame = entityFrame(entity);
  const feet = feetOf(frame);
  const dx = entity.x - feet.x * PLAYER_SCALE;
  const dy = entity.y - feet.y * PLAYER_SCALE;
  ctx.drawImage(
    sheets[entity.anim],
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
function hudElements(id) {
  return {
    root: document.getElementById(id),
    name: document.getElementById(`${id}-name`),
    fill: document.getElementById(`${id}-fill`),
    text: document.getElementById(`${id}-text`),
  };
}
const hud = hudElements("hud");
const rivalHud = hudElements("hud-rival");

function renderHudFor(els, combatant, entity) {
  els.name.textContent = combatant.name;
  els.fill.style.width = `${(combatant.hp / combatant.maxHp) * 100}%`;
  els.fill.style.backgroundColor = HP_COLORS[hpLevel(combatant.hp, combatant.maxHp)];
  const fainted = entity.state === "fainted" ? " · Debilitado" : "";
  els.text.textContent = `PS ${combatant.hp}/${combatant.maxHp}${fainted}`;
}

function renderHud() {
  const hp = hpSource();
  renderHudFor(hud, hp.player, player);
  renderHudFor(rivalHud, hp.rival, rivalEntity);
}

// Banner, resaltado de turno y línea de controles. Se evalúa cada frame,
// pero solo toca el DOM cuando algo cambia.
const banner = document.getElementById("banner");
const hudControls = document.getElementById("hud-controls");

function setBanner(text) {
  if (banner.textContent !== text) banner.textContent = text;
  banner.hidden = text === "";
}

function bannerText() {
  if (mode === "explore") {
    if (!inBattleRange()) return "";
    if (!canStartBattle(charizard, rival)) return "R: restaurar para combatir";
    return player.state === "hurt" ? "" : "Enter: combatir";
  }
  if (stage === "awaitInput" || stage === "playerAttacking") return "Turno de Charizard — Espacio: Arañazo";
  if (stage === "rivalWaiting" || stage === "rivalAttacking") return "Turno de Charizard rival…";
  return "";
}

function renderUi() {
  setBanner(bannerText());
  const playerTurn = mode === "battle" && (stage === "awaitInput" || stage === "playerAttacking");
  const rivalTurn = mode === "battle" && (stage === "rivalWaiting" || stage === "rivalAttacking");
  hud.root.classList.toggle("active", playerTurn);
  rivalHud.root.classList.toggle("active", rivalTurn);
  hudControls.hidden = mode === "battle";
}

// Distancia entre pies
function inBattleRange() {
  return Math.hypot(player.x - RIVAL_POS.x, player.y - RIVAL_POS.y) < BATTLE_RANGE;
}

function canEnterBattle() {
  return inBattleRange() && canStartBattle(charizard, rival) && player.state !== "hurt";
}

// Guarda la pose de exploración y coloca a Charizard frente al rival.
// El combate recibe los PS actuales, sin restaurarlos.
function startBattle() {
  explorePose = { x: player.x, y: player.y, dir: player.dir };
  player.x = RIVAL_POS.x - BATTLE_OFFSET;
  player.y = RIVAL_POS.y;
  player.dir = "right";
  setAnim(player, "idle");
  player.animMs = 0;
  battle = createBattle(charizard, rival);
  mode = "battle";
  stage = "awaitInput";
  renderHud();
}

// Golpe recibido: aviso con el daño efectivo sobre el defensor y reacción hurt
function receiveHit(entity, popupKey, attack, damage) {
  popups[popupKey] = { text: `${attack.name} −${damage} PS`, ms: 0 };
  entity.state = "hurt";
  entity.hurtMs = HURT_MS;
  setAnim(entity, "hurt");
  renderHud();
}

// Espacio: Arañazo solo en awaitInput y con Charizard fuera de hurt.
// Paso 4: el daño es inmediato y el retraso del rival empieza aquí.
function playerAction() {
  if (stage !== "awaitInput" || player.state === "hurt") return;
  const result = playerAttack(battle);
  if (!result.accepted) return;
  battle = result.battle;
  receiveHit(rivalEntity, "rival", PLAYER_ATTACK, result.damage);
  if (battle.phase === "victory") {
    stage = "resolving";
  } else {
    stage = "rivalWaiting";
    rivalDelay = RIVAL_DELAY_MS; // único punto donde se asigna
  }
}

// Respuesta del rival: una sola vez, al agotarse rivalDelay
function rivalAction() {
  const result = rivalAttack(battle);
  if (!result.accepted) return;
  battle = result.battle;
  receiveHit(player, "player", RIVAL_ATTACK, result.damage);
  stage = battle.phase === "defeat" ? "resolving" : "awaitInput";
}

function updateBattle(dtMs) {
  if (stage !== "rivalWaiting") return;
  rivalDelay -= dtMs;
  if (rivalDelay <= 0) rivalAction();
}

// Placaje de prueba: con 0 PS no hay daño ni aviso.
// Cada golpe (re)inicia la reacción hurt; no hay invulnerabilidad.
function testAttack() {
  if (isFainted(charizard)) return;
  const { combatant, damage } = applyAttack(charizard, TEST_ATTACK);
  charizard = combatant;
  receiveHit(player, "player", TEST_ATTACK, damage);
}

// R: PS completos y vuelta a idle con la misma dirección, desde cualquier estado.
// keys no se toca: si hay una flecha pulsada, el siguiente frame camina.
function restoreCharizard() {
  charizard = restore(charizard);
  popups.player = null;
  player.state = "normal";
  player.hurtMs = 0;
  setAnim(player, "idle");
  player.animMs = 0;
  renderHud();
}

// Aviso sobre la cabeza de la entidad: sube y se desvanece durante POPUP_MS
function drawPopup(entity, popup) {
  if (!popup) return;
  const frame = entityFrame(entity);
  const feet = feetOf(frame);
  const head = frame.head ?? { x: feet.x, y: 0 };
  const t = popup.ms / POPUP_MS;
  const x = entity.x + (head.x - feet.x) * PLAYER_SCALE;
  const y = entity.y + (head.y - feet.y) * PLAYER_SCALE - 40 - t * POPUP_RISE;
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

function setAnim(entity, anim) {
  if (entity.anim === anim) return;
  entity.anim = anim;
  entity.animMs = 0;
}

// Reacción común a Charizard y al rival. Devuelve true mientras dure hurt.
// Al terminar: debilitado (sleep) si sus PS son 0; si no, vuelve a normal.
// Los PS se leen de hpSource(), así que en combate valen los de battle.
function updateReaction(entity, combatant, dtMs) {
  if (entity.state !== "hurt") return false;
  entity.hurtMs -= dtMs;
  if (entity.hurtMs > 0) {
    entity.animMs += dtMs;
    return true;
  }
  if (isFainted(combatant)) {
    entity.state = "fainted";
    setAnim(entity, "sleep");
    renderHud();
  } else {
    entity.state = "normal";
  }
  return false;
}

function updatePopups(dtMs) {
  for (const key of Object.keys(popups)) {
    const popup = popups[key];
    if (!popup) continue;
    popup.ms += dtMs;
    if (popup.ms >= POPUP_MS) popups[key] = null;
  }
}

function update(dtMs) {
  // Durante hurt no se mueve. Al terminar, este mismo frame sigue abajo:
  // walk o idle según el teclado, o el bloqueo si se quedó sin PS
  if (updateReaction(player, hpSource().player, dtMs)) return;

  // Debilitado: duerme sin moverse hasta que R lo restaure
  if (player.state === "fainted") {
    player.animMs += dtMs;
    return;
  }

  // En combate no se mueve: queda en idle en su sitio frente al rival
  if (mode === "battle") {
    setAnim(player, "idle");
    player.animMs += dtMs;
    return;
  }

  // Vector de movimiento; teclas opuestas se anulan
  let vx = (isPressed("right") ? 1 : 0) - (isPressed("left") ? 1 : 0);
  let vy = (isPressed("down") ? 1 : 0) - (isPressed("up") ? 1 : 0);

  // Moviéndose: walk hacia el vector. Quieto: idle con la última dirección
  const moving = vx !== 0 || vy !== 0;
  if (moving) player.dir = DIR_BY_VECTOR[vy + 1][vx + 1];
  setAnim(player, moving ? "walk" : "idle");

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

// El rival no se mueve: solo reacciona a los golpes y vuelve a idle
function updateRival(dtMs) {
  if (updateReaction(rivalEntity, hpSource().rival, dtMs)) return;
  if (rivalEntity.state === "normal") setAnim(rivalEntity, "idle");
  rivalEntity.animMs += dtMs;
}

function render() {
  drawBackground();
  // Sombras antes que los sprites: quedan en el suelo, por detrás de los dos
  drawShadow(rivalEntity);
  drawShadow(player);
  // Orden por y: se dibuja delante quien tiene los pies más abajo (empate: Charizard delante)
  const drawables = [
    { entity: rivalEntity, sheets: rivalImages },
    { entity: player, sheets: images },
  ].sort((a, b) => a.entity.y - b.entity.y);
  drawables.forEach(({ entity, sheets }) => drawEntity(entity, sheets));
  // Avisos encima de los sprites
  drawPopup(rivalEntity, popups.rival);
  drawPopup(player, popups.player);
}

// Bucle principal: el delta sale del timestamp de requestAnimationFrame
let lastTime = null;

function loop(timestamp) {
  const dtMs = lastTime === null ? 0 : timestamp - lastTime;
  lastTime = timestamp;
  updatePopups(dtMs);
  if (mode === "battle") updateBattle(dtMs);
  update(dtMs);
  updateRival(dtMs);
  render();
  renderUi();
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
  sleep: CHARIZARD.sleep.src.anim,
};
const results = await Promise.allSettled(Object.values(sources).map(loadImage));
const errors = results.filter((r) => r.status === "rejected").map((r) => r.reason);

if (errors.length > 0) {
  errors.forEach((error) => console.error(error));
  drawLoadErrors(errors.map((error) => error.message));
} else {
  Object.keys(sources).forEach((name, i) => (images[name] = results[i].value));
  rivalImages.idle = recolorSheet(images.idle);
  rivalImages.hurt = recolorSheet(images.hurt);
  rivalImages.sleep = recolorSheet(images.sleep);
  renderHud();
  // Los HUD aparecen junto con el juego, no sobre el mensaje de error
  hud.root.hidden = false;
  rivalHud.root.hidden = false;
  requestAnimationFrame(loop);
}
