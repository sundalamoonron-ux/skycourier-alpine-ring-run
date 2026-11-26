// Screenshot scenes behind ?shot=cover|takeoff|rings|landing. Each scene
// plays the real game forward from a fresh start (or, for the landing, from
// a real final-approach state) with a simple autopilot, so the frame is
// what a short flight really looks like and the same seed always gives the
// same frame. Nothing here is a mock render: the game steps its own physics
// and mission rules, and the frame is drawn by the normal renderer.
import { SCREEN, STEP } from './config.js';
import { currentObjective } from './objectives.js';
import { makeGame, startMission, stepGame } from './game.js';
import { angleDifference, clamp } from './math3d.js';

const SIM_LIMIT_SECONDS = 240;

// Steer toward the current objective: bank onto the bearing, pitch onto
// the target height, throttle toward a sensible speed for the phase.
export function autopilotControls(game) {
  const plane = game.plane;
  const objective = currentObjective(game.mission);
  let target = { x: 0, y: 80, z: 1200 };
  let desiredSpeed = 60;

  if (!objective || objective.type === 'land') {
    // A glide slope home. The runway is flown from either end: the plane
    // aims at a touchdown point just past the near threshold and steers
    // toward a far point on the extended centreline, so it never has to
    // turn around at the touchdown point itself. The side is picked once,
    // when the landing starts — flipping it mid-approach would send the
    // plane in circles over the numbers.
    if (game._landSide === undefined) game._landSide = plane.z < 700 ? 'south' : 'north';
    const fromSouth = game._landSide === 'south';
    const touchdownZ = fromSouth ? 300 : 1100;
    const farZ = fromSouth ? 2000 : -800;
    const distanceHome = Math.hypot(plane.x, plane.z - touchdownZ);
    const approachY = clamp(distanceHome * 0.07, 2, 70);
    // Steer at the far point, climb/descend on the slope to the touchdown.
    const steering = { x: 0, y: approachY, z: farZ };
    const desiredHeading = Math.atan2(steering.x - plane.x, steering.z - plane.z);
    const headingError = angleDifference(plane.heading, desiredHeading);
    const bank = clamp(headingError * 2.2, -1, 1);
    const altitudeError = approachY - plane.y;
    const pitch = clamp(altitudeError * 0.02, -0.5, 0.3);
    const throttle = plane.speed < (distanceHome > 1500 ? 62 : 46) ? 1 : -1;
    return { bank, pitch, throttle, wantGearDown: true };
  }
  if (objective.type === 'takeoff') {
    target = { x: 0, y: 70, z: 1300 };
    desiredSpeed = 70;
  } else if (objective.type === 'ring' || objective.type === 'waypoint') {
    const ring = game.mission.def.rings[objective.index];
    target = ring;
    desiredSpeed = 68;
  } else if (objective.type === 'altitude') {
    target = { x: 0, y: objective.height + 20, z: plane.z + 900 };
    desiredSpeed = 66;
  }

  const desiredHeading = Math.atan2(target.x - plane.x, target.z - plane.z);
  const headingError = angleDifference(plane.heading, desiredHeading);
  const bank = clamp(headingError * 2.2, -1, 1);

  // Gear: down on the ground, down for landing, up once cleanly airborne.
  const wantGearDown = plane.onGround
    || (!objective || objective.type === 'land')
    || (plane.y < 55 && plane.speed < 55);

  const altitudeError = target.y - plane.y;
  let pitch = clamp(altitudeError * 0.014, -0.8, 0.9);
  // Never dive into the ground while slow: pull up when close to terrain.
  if (plane.y < 45 && plane.speed < 50) pitch = Math.max(pitch, 0.4);
  // On final approach, hold a gentle descent.
  if (wantGearDown) pitch = clamp(altitudeError * 0.02, -0.5, 0.3);

  const throttle = plane.speed < desiredSpeed ? 1 : -1;
  return { bank, pitch, throttle, wantGearDown };
}

function simulate(game, seconds, stopWhen, audio) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const controls = autopilotControls(game);
    const actions = { gear: controls.wantGearDown !== game.plane.gearDown };
    stepGame(game, controls, actions, audio, STEP);
    if (game.screen !== SCREEN.flying) break;
    if (stopWhen && stopWhen(game)) break;
  }
  return game;
}

// Set `game` to the named scene and return the screen to draw.
export function stageShot(name, seed) {
  const game = makeGame();
  if (name === 'takeoff') {
    startMission(game, 0, null);
    game.plane.throttle = 1;
    simulate(game, 5.5, null, null);
    return game;
  }
  if (name === 'rings') {
    startMission(game, 0, null);
    simulate(game, SIM_LIMIT_SECONDS, (g) => {
      const objective = currentObjective(g.mission);
      if (!objective || objective.type !== 'ring' || objective.index !== 1) return false;
      const ring = g.mission.def.rings[1];
      const distance = Math.hypot(ring.x - g.plane.x, ring.y - g.plane.y, ring.z - g.plane.z);
      return distance < 260;
    }, null);
    return game;
  }
  if (name === 'landing') {
    startMission(game, 0, null);
    // A real final approach: past the rings, gear down, lined up on the
    // strip from the south, 350 m out. The autopilot flies it from here.
    const mission = game.mission;
    mission.objectiveIndex = mission.def.objectives.length - 1;
    mission.ringsHit = mission.def.rings.length;
    mission.score = mission.def.rings.length * 100;
    const plane = game.plane;
    plane.x = 34;
    plane.y = 78;
    plane.z = -380;
    plane.heading = 0;
    plane.pitch = -0.06;
    plane.bank = 0;
    plane.speed = 48;
    plane.throttle = 0.42;
    plane.fuel = 62;
    plane.gearDown = true;
    plane.onGround = false;
    simulate(game, 14, null, null);
    return game;
  }
  // Default: the cover — mid-flight, closing on ring 3 with the valley,
  // the runway and the full HUD in frame.
  startMission(game, 0, null);
  simulate(game, SIM_LIMIT_SECONDS, (g) => {
    const objective = currentObjective(g.mission);
    if (!objective || objective.type !== 'ring' || objective.index !== 2) return false;
    const ring = g.mission.def.rings[2];
    const distance = Math.hypot(ring.x - g.plane.x, ring.y - g.plane.y, ring.z - g.plane.z);
    return distance < 620;
  }, null);
  return game;
}

export { makeGame };
