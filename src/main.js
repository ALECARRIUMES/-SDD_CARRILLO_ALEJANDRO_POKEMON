import { BACKGROUNDS } from "../spritesheet.js";

// Mundo: se lee de BACKGROUNDS.fondo1, no se escribe a mano
const WORLD = { w: BACKGROUNDS.fondo1.sw, h: BACKGROUNDS.fondo1.sh }; // 2752 × 1536

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Resolución interna igual al fondo; el escalado a la ventana lo hace CSS.
canvas.width = WORLD.w;
canvas.height = WORLD.h;

// Imágenes cargadas
const images = { fondo1: null };

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

// Color liso mientras carga el fondo
ctx.fillStyle = "#2e7d32";
ctx.fillRect(0, 0, WORLD.w, WORLD.h);

images.fondo1 = await loadImage(BACKGROUNDS.fondo1.src);
drawBackground();
