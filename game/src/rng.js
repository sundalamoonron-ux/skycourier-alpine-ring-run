// A small deterministic random generator (mulberry32) so the terrain,
// clouds and screenshot scenes are the same on every load for one seed.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise in one dimension: a cheap hash-based curve used for
// hills and the river's meander. Deterministic for a fixed seed.
export function makeNoise1D(seed) {
  const rng = makeRng(seed);
  const knots = [];
  for (let i = 0; i < 64; i += 1) knots.push(rng() * 2 - 1);
  function knotAt(i) {
    return knots[((i % 64) + 64) % 64];
  }
  return function noise(x) {
    const xi = Math.floor(x);
    const frac = x - xi;
    const a = knotAt(xi);
    const b = knotAt(xi + 1);
    const smooth = frac * frac * (3 - 2 * frac);
    return a + (b - a) * smooth;
  };
}
