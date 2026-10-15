// Lógica de combate: pura, sin imports, sin DOM ni canvas.
// Ninguna función modifica el combatiente recibido: siempre devuelve uno nuevo.

export const MAX_HP = 100;
export const TEST_ATTACK = { name: "Placaje de prueba", power: 15 }; // power = potencia nominal

// Combatiente: { name, hp, maxHp }, con 0 <= hp <= maxHp
export function createCombatant({ name, maxHp = MAX_HP }) {
  return { name, hp: maxHp, maxHp };
}

// Daño efectivo = min(potencia, PS actuales): los PS nunca bajan de 0
export function applyAttack(combatant, attack) {
  const damage = Math.min(attack.power, combatant.hp);
  return { combatant: { ...combatant, hp: combatant.hp - damage }, damage };
}

export function isFainted(combatant) {
  return combatant.hp === 0;
}

export function restore(combatant) {
  return { ...combatant, hp: combatant.maxHp };
}

// Nivel de la barra: > 50 % high, > 20 % medium, el resto low
export function hpLevel(hp, maxHp) {
  const ratio = hp / maxHp;
  if (ratio > 0.5) return "high";
  if (ratio > 0.2) return "medium";
  return "low";
}
