// The valley the game flies over: flat farmland in the middle, forested
// hills, a winding river, and snow-capped ridges closing the horizon.
// Everything here is pure function of position, so the ground never moves
// under the pilot and the screenshots always match the game.
import { WORLD } from './config.js';
import { makeNoise1D, makeRng } from './rng.js';

const hillNoise = makeNoise1D(4107);
const ridgeNoise = makeNoise1D(9021);
const riverNoise = makeNoise1D(5150);

// Ground height at (x, z): 0 on the valley floor, gentle hills inside the
// corridor, steep mountains outside it.
export function groundHeight(x, z) {
  const ax = Math.abs(x);
  let height = 0;
  // Rolling farmland hills, at most ~18 m, fading out near the runway.
  const nearRunway = Math.abs(x) < 90 && z > -100 && z < 1500 ? 0 : 1;
  height += nearRunway * 14 * (0.5 + 0.5 * hillNoise(x * 0.004 + z * 0.0016));
  // A long ridge along the east side of the valley.
  height += 26 * Math.max(0, hillNoise(z * 0.002 + 40)) * smoothstep(500, 900, ax);
  // Mountains beyond the corridor: rise fast, with noisy peaks.
  const outside = smoothstep(WORLD.mountainStart, WORLD.mountainPeak, ax);
  const peak = 420 + 260 * (0.5 + 0.5 * ridgeNoise(z * 0.0012 + x * 0.0004));
  height += outside * peak;
  // The far north end of the valley closes with a high wall, beyond the
  // last ring, so the pilot always has room to fly the course.
  height += smoothstep(5000, 6000, z) * 500;
  // The south end behind the runway falls away gently.
  height += smoothstep(-400, -900, -z + 0) * 0;
  return height;
}

export function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// The river meanders down the west side of the valley.
export function riverX(z) {
  return -420 + 130 * riverNoise(z * 0.0011);
}

export function isOnRunway(x, z) {
  const r = WORLD.runway;
  return Math.abs(x - r.x) <= r.width / 2 && z >= r.zStart && z <= r.zEnd;
}

export function isOverRiver(x, z) {
  return Math.abs(x - riverX(z)) < 26;
}

// Field colours for the patchwork farmland: a checker of greens and tans.
const FIELD_COLORS = ['#6da24a', '#7fae56', '#5d9242', '#a8a05e', '#8fae4e', '#b5a468'];
export function fieldColor(cellX, cellZ) {
  const hash = Math.abs((cellX * 73856093) ^ (cellZ * 19349663)) % FIELD_COLORS.length;
  return FIELD_COLORS[hash];
}

// Scattered pine trees on the hillsides (never on the runway or river).
export function makeTrees(seed) {
  const rng = makeRng(seed);
  const trees = [];
  for (let i = 0; i < 260; i += 1) {
    const x = (rng() * 2 - 1) * 1050;
    const z = rng() * 5600 - 400;
    if (isOnRunway(x, z) || isOverRiver(x, z)) continue;
    const h = groundHeight(x, z);
    if (h > 60) continue;
    trees.push({ x, y: h, z, size: 7 + rng() * 9, shade: rng() });
  }
  return trees;
}

// Distant peaks drawn as big triangles beyond the corridor.
export function makePeaks(seed) {
  const rng = makeRng(seed);
  const peaks = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 26; i += 1) {
      const z = -600 + i * 230 + rng() * 90;
      const x = side * (1500 + rng() * 1600);
      const height = 520 + rng() * 620;
      const width = 420 + rng() * 420;
      peaks.push({ x, z, height, width, snow: 0.45 + rng() * 0.3 });
    }
  }
  // The wall at the far north end.
  for (let i = 0; i < 10; i += 1) {
    const x = -2200 + i * 480 + rng() * 120;
    peaks.push({ x, z: 5200 + rng() * 300, height: 700 + rng() * 500, width: 520 + rng() * 300, snow: 0.5 });
  }
  return peaks;
}

// Puffy clouds drifting high above the valley.
export function makeClouds(seed) {
  const rng = makeRng(seed);
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: (rng() * 2 - 1) * 2400,
      y: 330 + rng() * 180,
      z: rng() * 5600 - 600,
      size: 90 + rng() * 160,
      puffs: 3 + Math.floor(rng() * 3),
      seed: rng() * 100,
    });
  }
  return clouds;
}

// A few hot-air balloons and a windsock for life near the airfield.
export function makeBalloons(seed) {
  const rng = makeRng(seed);
  return [
    { x: 620, y: 260, z: 1900, color: '#e05252', drift: rng() * 6 },
    { x: -700, y: 300, z: 3100, color: '#4a7fd4', drift: rng() * 6 },
    { x: 540, y: 210, z: 4200, color: '#e0a53c', drift: rng() * 6 },
  ];
}
