import { BACKGROUNDS } from "../spritesheet.js";

// Mundo: se lee de BACKGROUNDS.fondo1, no se escribe a mano
const WORLD = { w: BACKGROUNDS.fondo1.sw, h: BACKGROUNDS.fondo1.sh }; // 2752 × 1536

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Resolución interna igual al fondo; el escalado a la ventana lo hace CSS.
canvas.width = WORLD.w;
canvas.height = WORLD.h;

ctx.fillStyle = "#2e7d32";
ctx.fillRect(0, 0, WORLD.w, WORLD.h);
