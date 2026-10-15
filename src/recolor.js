// Recoloreado del rival: puro, sin imports, sin DOM ni canvas.
// Intercambia los canales rojo y azul de cada píxel RGBA visible.

// Devuelve un array nuevo; el recibido queda intacto.
// A no cambia nunca y los píxeles totalmente transparentes se copian tal cual.
export function recolorPixels(data) {
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    out[i] = data[i + 2];
    out[i + 2] = data[i];
  }
  return out;
}
