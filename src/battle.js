// Lógica del combate por turnos: pura, solo importa combat.js, sin DOM ni canvas.
// Ninguna función modifica el combate recibido: siempre devuelve uno nuevo.
import { applyAttack, isFainted } from "./combat.js";

export const PLAYER_ATTACK = { name: "Arañazo", power: 25 };
export const RIVAL_ATTACK = { name: "Placaje", power: 20 };

export function canStartBattle(player, rival) {
  return !isFainted(player) && !isFainted(rival);
}

// Combate: { phase, player, rival }. Los PS se reciben tal cual, sin restaurar.
// phase: "playerTurn" | "rivalTurn" | "victory" | "defeat"
export function createBattle(player, rival) {
  return { phase: "playerTurn", player, rival };
}

// Acción rechazada: el mismo combate, sin daño
function rejected(battle) {
  return { battle, damage: 0, accepted: false };
}

// Arañazo de Charizard: solo en su turno. Rival a 0 PS → victory; si no, rivalTurn
export function playerAttack(battle) {
  if (battle.phase !== "playerTurn") return rejected(battle);
  const { combatant: rival, damage } = applyAttack(battle.rival, PLAYER_ATTACK);
  const phase = isFainted(rival) ? "victory" : "rivalTurn";
  return { battle: { ...battle, phase, rival }, damage, accepted: true };
}

// Placaje del rival: solo en su turno. Charizard a 0 PS → defeat; si no, playerTurn
export function rivalAttack(battle) {
  if (battle.phase !== "rivalTurn") return rejected(battle);
  const { combatant: player, damage } = applyAttack(battle.player, RIVAL_ATTACK);
  const phase = isFainted(player) ? "defeat" : "playerTurn";
  return { battle: { ...battle, phase, player }, damage, accepted: true };
}

export function isOver(battle) {
  return battle.phase === "victory" || battle.phase === "defeat";
}

// PS finales para volver a exploración; null mientras el combate sigue
export function finishBattle(battle) {
  if (!isOver(battle)) return null;
  return { player: battle.player, rival: battle.rival };
}
