// SkyCourier: Alpine Ring Run — tuning constants and mission definitions.
// All distances in metres, speeds in metres per second, angles in radians.
export const WORLD = {
  // The valley floor is flat inside this corridor; mountains rise beyond it.
  corridorHalfWidth: 900,
  mountainStart: 1100,
  mountainPeak: 3200,
  // Runway: a strip along the valley, heading north (+z).
  runway: { x: 0, zStart: 0, zEnd: 1400, width: 46 },
  // Soft ceiling and world bounds for the playable area.
  ceiling: 620,
  boundX: 2600,
  boundZMin: -800,
  boundZMax: 5200,
};

export const PLANE = {
  maxSpeed: 92, // m/s at full throttle
  cruiseSpeed: 58,
  stallSpeed: 24, // below this the nose drops
  accel: 14, // m/s^2 toward target speed
  drag: 0.35,
  turnRate: 0.55, // rad/s at full bank
  maxBank: 1.05, // rad (~60 deg)
  pitchRate: 0.6,
  maxPitch: 0.45,
  climbPenalty: 0.25, // speed lost per rad of pitch up
  sinkRate: 9, // m/s extra sink when stalled
  fuelCapacity: 100,
  fuelBurn: 0.4, // per second at full throttle
  fuelBurnIdle: 0.1,
  gearDrag: 4, // m/s top-speed penalty with gear down
  landingMaxSink: 5.5, // m/s vertical speed allowed for a good landing
  landingMaxSpeed: 52,
  takeoffSpeed: 38,
};

// Scoring values, shown on the debrief screen.
export const SCORE = {
  ring: 100,
  waypoint: 150,
  altitudeBonus: 120,
  landingBase: 150,
  landingSoftBonus: 100,
  landingCentreBonus: 50,
  timeBonusPerSecond: 2,
};

export const RING_RADIUS = 26;

// The three missions. Each is a list of objectives the pilot flies in order.
// A ring objective is flown through; a waypoint is a beacon to reach;
// an altitude objective asks the pilot to climb above a height;
// a land objective ends the sortie on the runway.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tagline: 'Fly all 8 rings, then land on the strip.',
    fuel: 100,
    timeLimit: 300,
    rings: [
      { x: -120, y: 90, z: 900 },
      { x: 260, y: 130, z: 1500 },
      { x: -320, y: 170, z: 2100 },
      { x: 120, y: 120, z: 2650 },
      { x: -260, y: 200, z: 3200 },
      { x: 320, y: 150, z: 3750 },
      { x: -80, y: 110, z: 4300 },
      { x: 40, y: 90, z: 4800 },
    ],
    objectives: [
      { type: 'takeoff' },
      { type: 'ring', index: 0 }, { type: 'ring', index: 1 },
      { type: 'ring', index: 2 }, { type: 'ring', index: 3 },
      { type: 'ring', index: 4 }, { type: 'ring', index: 5 },
      { type: 'ring', index: 6 }, { type: 'ring', index: 7 },
      { type: 'land' },
    ],
  },
  {
    id: 'courier',
    name: 'Courier Dash',
    tagline: 'Pick up the parcel, drop it at two villages, land.',
    fuel: 85,
    timeLimit: 300,
    rings: [
      { x: -420, y: 100, z: 1200 },
      { x: 480, y: 140, z: 2300 },
      { x: -180, y: 110, z: 3400 },
    ],
    objectives: [
      { type: 'takeoff' },
      { type: 'waypoint', index: 0, label: 'PICK UP — Pine Village' },
      { type: 'waypoint', index: 1, label: 'DROP 1 — Lake Lodge' },
      { type: 'waypoint', index: 2, label: 'DROP 2 — North Farm' },
      { type: 'land' },
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset Landing',
    tagline: 'Climb above 300 m, then grease the landing.',
    fuel: 100,
    timeLimit: 240,
    rings: [
      { x: 0, y: 320, z: 1600 },
    ],
    objectives: [
      { type: 'takeoff' },
      { type: 'altitude', height: 300, label: 'CLIMB ABOVE 300 m' },
      { type: 'ring', index: 0 },
      { type: 'land' },
    ],
  },
];

export const SCREEN = {
  title: 'title',
  flying: 'flying',
  paused: 'paused',
  landed: 'landed',
  crashed: 'crashed',
  failed: 'failed',
};

export const STEP = 1 / 60;
