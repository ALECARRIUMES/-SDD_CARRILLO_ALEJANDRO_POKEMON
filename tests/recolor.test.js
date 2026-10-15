// Pruebas del recoloreado del rival (SPEC 02). Ejecutar con: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recolorPixels } from "../src/recolor.js";

const pixels = (...values) => new Uint8ClampedArray(values);

test("R1. intercambia rojo y azul en un píxel opaco", () => {
  assert.deepEqual([...recolorPixels(pixels(240, 128, 48, 255))], [48, 128, 240, 255]);
});

test("R2. el canal A no cambia", () => {
  assert.deepEqual([...recolorPixels(pixels(240, 128, 48, 100))], [48, 128, 240, 100]);
  const mixed = pixels(10, 20, 30, 1, 40, 50, 60, 128, 70, 80, 90, 255);
  const out = recolorPixels(mixed);
  for (let i = 3; i < out.length; i += 4) assert.equal(out[i], mixed[i]);
});

test("R3. los píxeles totalmente transparentes no cambian", () => {
  assert.deepEqual([...recolorPixels(pixels(0, 0, 0, 0))], [0, 0, 0, 0]);
  assert.deepEqual([...recolorPixels(pixels(240, 128, 48, 0))], [240, 128, 48, 0]);
});

test("R4. devuelve un array nuevo de la misma longitud y no toca el recibido", () => {
  const input = pixels(240, 128, 48, 255, 240, 128, 48, 0);
  const copy = [...input];
  const out = recolorPixels(input);
  assert.notEqual(out, input);
  assert.ok(out instanceof Uint8ClampedArray);
  assert.equal(out.length, input.length);
  assert.deepEqual([...input], copy);
});

test("Módulo puro: recolor.js no importa nada ni usa window, document o canvas", () => {
  // Se quitan los comentarios: pueden nombrar el canvas sin usarlo
  const source = readFileSync(new URL("../src/recolor.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, /^\s*import\b/m);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(source, /\b(window|document|canvas|getContext)\b/);
});
