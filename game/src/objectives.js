// Missions: the objectives the pilot flies in order, ring-pass detection,
// and the score. A mission is a script of objectives; this file walks it.
import { MISSIONS, RING_RADIUS, SCORE } from './config.js';
import { makePlane } from './plane.js';

export function makeMission(missionIndex) {
  const def = MISSIONS[missionIndex];
  return {
    def,
    index: missionIndex,
    objectiveIndex: 0,
    score: 0,
    ringsHit: 0,
    waypointsHit: 0,
    timeLeft: def.timeLimit,
    elapsed: 0,
    tookOff: false,
    altitudeBest: 0,
    landingQuality: null, // { sink, centreOffset, speed } once landed
    log: [], // short lines for the debrief screen
    done: false,
  };
}

export function currentObjective(mission) {
  return mission.def.objectives[mission.objectiveIndex] ?? null;
}

export function objectiveLabel(mission) {
  const objective = currentObjective(mission);
  if (!objective) return 'Mission complete';
  if (objective.type === 'takeoff') return 'TAKE OFF — full throttle, pull up past 38 m/s';
  if (objective.type === 'ring') {
    const ring = mission.def.rings[objective.index];
    return 'RING ' + (objective.index + 1) + ' / ' + mission.def.rings.length + ' — ' + ring.y.toFixed(0) + ' m up';
  }
  if (objective.type === 'waypoint') return objective.label;
  if (objective.type === 'altitude') return objective.label;
  if (objective.type === 'land') return 'LAND — gear down, gentle on the strip';
  return '';
}

// Distance from the plane to a ring centre, and whether the plane just
// crossed the ring's plane inside its radius.
export function ringState(plane, ring) {
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  return { dx, dy, dz, distance: Math.hypot(dx, dy, dz) };
}

// Step the mission one frame. Returns an event string when something
// happened ('ring', 'waypoint', 'takeoff', 'altitude', 'land', 'timeout').
export function stepMission(mission, plane, dt, previousPlane) {
  if (mission.done) return null;
  mission.elapsed += dt;
  mission.timeLeft = Math.max(0, mission.def.timeLimit - mission.elapsed);
  mission.altitudeBest = Math.max(mission.altitudeBest, plane.y);

  if (mission.timeLeft <= 0) {
    mission.done = true;
    return 'timeout';
  }

  const objective = currentObjective(mission);
  if (!objective) {
    mission.done = true;
    return null;
  }

  if (objective.type === 'takeoff') {
    if (!plane.onGround && plane.y > 12) {
      mission.tookOff = true;
      mission.log.push('Took off cleanly.');
      mission.objectiveIndex += 1;
      return 'takeoff';
    }
    return null;
  }

  if (objective.type === 'ring' || objective.type === 'waypoint') {
    const target = mission.def.rings[objective.index];
    const now = ringState(plane, target);
    const was = ringState(previousPlane, target);
    // The plane crossed the ring when its distance to the centre stopped
    // shrinking and it is close, or it passed through the ring's disc:
    // within the radius and having moved from one side to the other.
    const crossed = was.distance > now.distance && now.distance < RING_RADIUS + 14;
    const throughDisc = Math.abs(now.dz) < 6 && Math.hypot(now.dx, now.dy) < RING_RADIUS;
    if (crossed || throughDisc) {
      if (objective.type === 'ring') {
        mission.ringsHit += 1;
        mission.score += SCORE.ring;
        mission.log.push('Ring ' + (objective.index + 1) + ' — +' + SCORE.ring);
      } else {
        mission.waypointsHit += 1;
        mission.score += SCORE.waypoint;
        mission.log.push(objective.label + ' — +' + SCORE.waypoint);
      }
      mission.objectiveIndex += 1;
      return objective.type;
    }
    return null;
  }

  if (objective.type === 'altitude') {
    if (plane.y >= objective.height) {
      mission.score += SCORE.altitudeBonus;
      mission.log.push('Above ' + objective.height + ' m — +' + SCORE.altitudeBonus);
      mission.objectiveIndex += 1;
      return 'altitude';
    }
    return null;
  }

  if (objective.type === 'land') {
    if (plane.landed) {
      const sink = Math.abs(plane.verticalSpeed);
      const centreOffset = Math.abs(plane.x);
      const softness = Math.max(0, 1 - sink / 5.5);
      const centre = Math.max(0, 1 - centreOffset / 23);
      const speedOk = plane.speed <= 52 ? 1 : 0.4;
      const landingScore = Math.round(
        SCORE.landingBase + SCORE.landingSoftBonus * softness + SCORE.landingCentreBonus * centre,
      ) * speedOk;
      mission.landingQuality = { sink, centreOffset, speed: plane.speed };
      mission.score += Math.round(landingScore);
      mission.log.push('Landed — sink ' + sink.toFixed(1) + ' m/s, ' + centreOffset.toFixed(0) + ' m off centre — +' + Math.round(landingScore));
      mission.objectiveIndex += 1;
      mission.done = true;
      return 'land';
    }
    return null;
  }

  return null;
}

// Time bonus for finishing with time to spare.
export function finishBonus(mission) {
  if (!mission.done || mission.timeLeft <= 0) return 0;
  return Math.round(mission.timeLeft * SCORE.timeBonusPerSecond);
}

export { makePlane };
