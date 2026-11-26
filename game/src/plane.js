// The aircraft: its state and the flight model. The model is arcade-simple
// on purpose — throttle sets target speed, bank turns, pitch climbs or
// descends, and the pilot trades speed for height — but it still stalls,
// sinks, runs out of fuel and can be landed or wrecked.
import { PLANE, WORLD } from './config.js';
import { clamp } from './math3d.js';
import { groundHeight, isOnRunway } from './terrain.js';

export function makePlane() {
  return {
    x: 0,
    y: 2, // parked on the runway
    z: 220,
    heading: 0, // 0 = north, up the runway
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    gearDown: true,
    onGround: true,
    verticalSpeed: 0,
    crashed: false,
    landed: false,
    crashReason: '',
    distanceFlown: 0,
  };
}

// One physics step. `input` is { bank: -1..1, pitch: -1..1, throttle: -1..1 }
// where bank +1 rolls right, pitch +1 pulls the nose up.
export function stepPlane(plane, input, dt) {
  if (plane.crashed || plane.landed) return;

  // Throttle: W/S (or mouse wheel) nudge it; it stays where you leave it.
  plane.throttle = clamp(plane.throttle + input.throttle * dt * 0.9, 0, 1);

  // Banking: the stick banks the wings; the bank turns the heading.
  const targetBank = input.bank * PLANE.maxBank;
  plane.bank += (targetBank - plane.bank) * Math.min(1, dt * 4.5);
  plane.heading += Math.sin(plane.bank) * PLANE.turnRate * dt * (0.4 + plane.speed / PLANE.maxSpeed);
  plane.heading = (plane.heading + Math.PI * 2) % (Math.PI * 2);

  // Pitch: the stick pitches the nose; it eases back toward level.
  const targetPitch = input.pitch * PLANE.maxPitch;
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 3.2);
  if (Math.abs(input.pitch) < 0.05) plane.pitch *= 1 - Math.min(1, dt * 0.9);

  // Speed chases the throttle's target, slower when climbing or dirty.
  const gearPenalty = plane.gearDown ? PLANE.gearDrag : 0;
  const climbDrag = Math.max(0, plane.pitch) * PLANE.maxSpeed * PLANE.climbPenalty;
  const targetSpeed = plane.throttle * (PLANE.maxSpeed - gearPenalty) - climbDrag;
  const accel = plane.speed < targetSpeed ? PLANE.accel : PLANE.accel * 0.55;
  plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);
  plane.speed = Math.max(0, plane.speed);

  // Fuel: thirsty at full throttle, sipping at idle.
  const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurn - PLANE.fuelBurnIdle) * plane.throttle;
  plane.fuel = Math.max(0, plane.fuel - burn * dt);

  // Vertical speed from pitch and speed; a stall sinks the nose.
  const stalled = plane.speed < PLANE.stallSpeed && !plane.onGround;
  let verticalSpeed = Math.sin(plane.pitch) * plane.speed;
  if (stalled) verticalSpeed -= PLANE.sinkRate;
  if (plane.onGround) verticalSpeed = Math.max(0, verticalSpeed);
  plane.verticalSpeed = verticalSpeed;

  // Move.
  const forwardX = Math.sin(plane.heading);
  const forwardZ = Math.cos(plane.heading);
  const stepX = forwardX * plane.speed * Math.cos(plane.pitch) * dt;
  const stepZ = forwardZ * plane.speed * Math.cos(plane.pitch) * dt;
  plane.x += stepX;
  plane.z += stepZ;
  plane.y += verticalSpeed * dt;
  plane.distanceFlown += Math.hypot(stepX, stepZ);

  // Takeoff: fast enough and pulling up lifts off the strip.
  if (plane.onGround && plane.speed > PLANE.takeoffSpeed && plane.pitch > 0.06) {
    plane.onGround = false;
  }

  // Soft ceiling: the air thins out and the nose drops.
  if (plane.y > WORLD.ceiling) {
    plane.y = WORLD.ceiling;
    plane.pitch = Math.min(plane.pitch, 0);
  }

  // World bounds: turn back with a gentle push, never a wall.
  if (Math.abs(plane.x) > WORLD.boundX) plane.heading += anglePush(plane.x, plane.heading) * dt;
  if (plane.z > WORLD.boundZMax) plane.heading = turnToward(plane.heading, Math.PI, dt);
  if (plane.z < WORLD.boundZMin) plane.heading = turnToward(plane.heading, 0, dt);

  // Ground contact.
  const ground = groundHeight(plane.x, plane.z);
  if (plane.y <= ground + 1.5) {
    plane.y = ground + 1.5;
    const onStrip = isOnRunway(plane.x, plane.z);
    const gentle = Math.abs(verticalSpeed) <= PLANE.landingMaxSink;
    const slow = plane.speed <= PLANE.landingMaxSpeed;
    if (onStrip && gentle && slow && plane.gearDown && !plane.onGround) {
      plane.landed = true;
      plane.onGround = true;
      plane.speed = Math.max(0, plane.speed - 22 * dt);
    } else if (onStrip && plane.onGround) {
      // Rolling along the runway: scrub speed, stay put.
      plane.speed = Math.max(0, plane.speed - 18 * dt);
      plane.verticalSpeed = 0;
    } else {
      plane.crashed = true;
      if (plane.fuel <= 0) plane.crashReason = 'Out of fuel — the engine quit over the valley.';
      else if (!onStrip && plane.speed < 8) plane.crashReason = 'Stalled into the hillside.';
      else if (!gentle) plane.crashReason = 'Hit the ground too hard — ' + Math.abs(verticalSpeed).toFixed(0) + ' m/s down.';
      else plane.crashReason = 'Crashed into the terrain.';
    }
  }

  if (plane.fuel <= 0 && plane.throttle > 0) plane.throttle = 0;
}

function anglePush(x, heading) {
  // Push the nose back toward the valley when the pilot flies out sideways.
  const want = x > 0 ? Math.PI * 1.5 : Math.PI * 0.5;
  let diff = (want - heading) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff * 2;
}

function turnToward(heading, want, dt) {
  let diff = (want - heading) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return heading + clamp(diff, -1.2 * dt, 1.2 * dt);
}
