// Pruebas de la lógica de combate (SPEC 01). Ejecutar con: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_HP,
  TEST_ATTACK,
  createCombatant,
  applyAttack,
  isFainted,
  restore,
  hpLevel,
} from "../src/combat.js";

const withHp = (hp, maxHp = MAX_HP) => ({ name: "Charizard", hp, maxHp });

test("L1. createCombatant crea a Charizard con 100/100 PS", () => {
  assert.deepEqual(createCombatant({ name: "Charizard" }), { name: "Charizard", hp: 100, maxHp: 100 });
});

test("L2. siete placajes de prueba: 85, 70, 55, 40, 25, 10, 0", () => {
  let c = createCombatant({ name: "Charizard" });
  const hps = [];
  const damages = [];
  for (let i = 0; i < 7; i++) {
    const result = applyAttack(c, TEST_ATTACK);
    c = result.combatant;
    hps.push(c.hp);
    damages.push(result.damage);
  }
  assert.deepEqual(hps, [85, 70, 55, 40, 25, 10, 0]);
  assert.deepEqual(damages, [15, 15, 15, 15, 15, 15, 10]);
});

test("L3. un octavo ataque con 0 PS no hace daño", () => {
  const { combatant, damage } = applyAttack(withHp(0), TEST_ATTACK);
  assert.equal(damage, 0);
  assert.equal(combatant.hp, 0);
});

test("L4. potencia 50 sobre 10 PS: daño efectivo 10, PS 0", () => {
  const { combatant, damage } = applyAttack(withHp(10), { name: "Golpe fuerte", power: 50 });
  assert.equal(damage, 10);
  assert.equal(combatant.hp, 0);
});

test("L5. isFainted: false con 1 PS, true con 0", () => {
  assert.equal(isFainted(withHp(1)), false);
  assert.equal(isFainted(withHp(0)), true);
});

test("L6. restore devuelve 100 PS desde 0 y desde 40", () => {
  assert.equal(restore(withHp(0)).hp, 100);
  assert.equal(restore(withHp(40)).hp, 100);
});

test("L7. límites de hpLevel con maxHp 100", () => {
  assert.equal(hpLevel(100, 100), "high");
  assert.equal(hpLevel(51, 100), "high");
  assert.equal(hpLevel(50, 100), "medium");
  assert.equal(hpLevel(21, 100), "medium");
  assert.equal(hpLevel(20, 100), "low");
  assert.equal(hpLevel(0, 100), "low");
});

test("L8. hpLevel es proporcional a maxHp", () => {
  assert.equal(hpLevel(100, 200), "medium");
  assert.equal(hpLevel(40, 200), "low");
});

test("L9. applyAttack y restore no modifican el objeto recibido", () => {
  const original = withHp(40);
  const snapshot = { ...original };
  const attacked = applyAttack(original, TEST_ATTACK).combatant;
  const restored = restore(original);
  assert.deepEqual(original, snapshot);
  assert.notEqual(attacked, original);
  assert.notEqual(restored, original);
});

test("L10. se conservan name y maxHp; maxHp configurable", () => {
  const c = createCombatant({ name: "Prueba", maxHp: 200 });
  assert.deepEqual(c, { name: "Prueba", hp: 200, maxHp: 200 });
  const attacked = applyAttack(c, TEST_ATTACK).combatant;
  assert.equal(attacked.name, "Prueba");
  assert.equal(attacked.maxHp, 200);
  const restored = restore(attacked);
  assert.equal(restored.name, "Prueba");
  assert.equal(restored.maxHp, 200);
});

test("Módulo puro: combat.js no importa nada ni usa window, document o canvas", () => {
  // Se quitan los comentarios: pueden nombrar el canvas sin usarlo
  const source = readFileSync(new URL("../src/combat.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, /^\s*import\b/m);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(source, /\b(window|document|canvas|getContext)\b/);
});
