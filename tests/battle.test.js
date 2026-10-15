// Pruebas de la lógica del combate por turnos (SPEC 02). Ejecutar con: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCombatant } from "../src/combat.js";
import {
  PLAYER_ATTACK,
  RIVAL_ATTACK,
  canStartBattle,
  createBattle,
  playerAttack,
  rivalAttack,
  isOver,
  finishBattle,
} from "../src/battle.js";

const charizardWith = (hp) => ({ ...createCombatant({ name: "Charizard" }), hp });
const rivalWith = (hp) => ({ ...createCombatant({ name: "Charizard rival" }), hp });

// Alterna ataques hasta el final y registra los PS tras cada uno
function playOut(battle) {
  const log = [];
  while (!isOver(battle)) {
    const result = battle.phase === "playerTurn" ? playerAttack(battle) : rivalAttack(battle);
    battle = result.battle;
    log.push(result.battle.phase === "rivalTurn" || result.battle.phase === "victory"
      ? ["rival", battle.rival.hp]
      : ["charizard", battle.player.hp]);
  }
  return { battle, log };
}

test("Ataques: Arañazo 25 y Placaje 20", () => {
  assert.deepEqual(PLAYER_ATTACK, { name: "Arañazo", power: 25 });
  assert.deepEqual(RIVAL_ATTACK, { name: "Placaje", power: 20 });
});

test("B1. createBattle empieza en playerTurn y conserva los PS recibidos", () => {
  const battle = createBattle(charizardWith(40), rivalWith(100));
  assert.equal(battle.phase, "playerTurn");
  assert.equal(battle.player.hp, 40);
  assert.equal(battle.rival.hp, 100);
});

test("B2. los turnos alternan: jugador → rival → jugador", () => {
  let battle = createBattle(charizardWith(100), rivalWith(100));
  battle = playerAttack(battle).battle;
  assert.equal(battle.phase, "rivalTurn");
  battle = rivalAttack(battle).battle;
  assert.equal(battle.phase, "playerTurn");
});

test("B3. victoria desde 100/100 con la secuencia exacta", () => {
  const { battle, log } = playOut(createBattle(charizardWith(100), rivalWith(100)));
  assert.deepEqual(log, [
    ["rival", 75],
    ["charizard", 80],
    ["rival", 50],
    ["charizard", 60],
    ["rival", 25],
    ["charizard", 40],
    ["rival", 0],
  ]);
  assert.equal(battle.phase, "victory");
});

test("B4. derrota desde Charizard 40 con la secuencia exacta", () => {
  const { battle, log } = playOut(createBattle(charizardWith(40), rivalWith(100)));
  assert.deepEqual(log, [
    ["rival", 75],
    ["charizard", 20],
    ["rival", 50],
    ["charizard", 0],
  ]);
  assert.equal(battle.phase, "defeat");
});

test("B5. las acciones fuera de turno se rechazan sin cambios", () => {
  const playerTurn = createBattle(charizardWith(100), rivalWith(100));
  const early = rivalAttack(playerTurn);
  assert.equal(early.accepted, false);
  assert.equal(early.damage, 0);
  assert.equal(early.battle, playerTurn);

  const rivalTurn = playerAttack(playerTurn).battle;
  const twice = playerAttack(rivalTurn);
  assert.equal(twice.accepted, false);
  assert.equal(twice.damage, 0);
  assert.equal(twice.battle, rivalTurn);
});

test("B6. después del final ninguna acción tiene efecto", () => {
  for (const start of [charizardWith(100), charizardWith(40)]) {
    const { battle } = playOut(createBattle(start, rivalWith(100)));
    for (const action of [playerAttack, rivalAttack]) {
      const result = action(battle);
      assert.equal(result.accepted, false);
      assert.equal(result.damage, 0);
      assert.equal(result.battle, battle);
    }
  }
});

test("B7. tras el golpe letal de Charizard el rival no responde", () => {
  const battle = playerAttack(createBattle(charizardWith(60), rivalWith(25))).battle;
  assert.equal(battle.phase, "victory");
  const response = rivalAttack(battle);
  assert.equal(response.accepted, false);
  assert.equal(response.battle.player.hp, 60);
});

test("B8. ninguna función modifica el combate ni los combatientes recibidos", () => {
  const player = Object.freeze(charizardWith(100));
  const rival = Object.freeze(rivalWith(100));
  const battle = Object.freeze(createBattle(player, rival));
  const afterPlayer = playerAttack(battle).battle;
  Object.freeze(afterPlayer);
  rivalAttack(afterPlayer);
  assert.equal(player.hp, 100);
  assert.equal(rival.hp, 100);
  assert.equal(battle.phase, "playerTurn");
  assert.equal(afterPlayer.phase, "rivalTurn");
  assert.notEqual(afterPlayer, battle);
});

test("B9. finishBattle: null en curso; PS finales sin restaurar al terminar", () => {
  const start = createBattle(charizardWith(100), rivalWith(100));
  assert.equal(finishBattle(start), null);
  assert.equal(finishBattle(playerAttack(start).battle), null);

  const { battle } = playOut(start);
  assert.deepEqual(finishBattle(battle), {
    player: { name: "Charizard", hp: 40, maxHp: 100 },
    rival: { name: "Charizard rival", hp: 0, maxHp: 100 },
  });
});

test("B10. canStartBattle es falso si alguno tiene 0 PS", () => {
  assert.equal(canStartBattle(charizardWith(100), rivalWith(100)), true);
  assert.equal(canStartBattle(charizardWith(1), rivalWith(1)), true);
  assert.equal(canStartBattle(charizardWith(0), rivalWith(100)), false);
  assert.equal(canStartBattle(charizardWith(100), rivalWith(0)), false);
});

test("B11. battle.js solo importa ./combat.js y no usa window, document o canvas", () => {
  // Se quitan los comentarios: pueden nombrar el canvas sin usarlo
  const source = readFileSync(new URL("../src/battle.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const imports = [...source.matchAll(/^\s*import\b.*?from\s*["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./combat.js"]);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(source, /\b(window|document|canvas|getContext)\b/);
});
