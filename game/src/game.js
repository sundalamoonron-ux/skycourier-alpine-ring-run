// The game itself: screens (title, flying, paused, landed, crashed), the
// mission loop, score popups, the off-screen ring beacon, and the title and
// debrief panels. The flight model lives in plane.js, the world in
// terrain.js, the drawing in render.js and hud.js.
import { MISSIONS, SCREEN, STEP } from './config.js';
import { makePlane, stepPlane } from './plane.js';
import { currentObjective, finishBonus, makeMission, objectiveLabel, stepMission } from './objectives.js';
import { makeBalloons, makeClouds, makePeaks, makeTrees } from './terrain.js';
import { chaseCamera, drawBalloons, drawClouds, drawGround, drawPeaks, drawPlane, drawRing, drawSky, drawTrees } from './render.js';
import { drawHud, roundRect } from './hud.js';
import { playChime, playClick, playFanfare, playThud, updateAudio } from './audio.js';
import { angleDifference, clamp } from './math3d.js';
import { project } from './math3d.js';

export function makeGame() {
  return {
    screen: SCREEN.title,
    missionIndex: 0,
    mission: makeMission(0),
    plane: makePlane(),
    trees: makeTrees(777),
    peaks: makePeaks(1234),
    clouds: makeClouds(999),
    balloons: makeBalloons(4242),
    time: 0,
    popups: [],
    beacon: null,
    flash: '',
    flashUntil: 0,
    bestScore: 0,
    endReason: '',
    endScore: 0,
    endBonus: 0,
    pausedFrom: null,
  };
}

export function startMission(game, missionIndex, audio) {
  game.missionIndex = missionIndex;
  game.mission = makeMission(missionIndex);
  game.plane = makePlane();
  game.plane.fuel = MISSIONS[missionIndex].fuel;
  game.screen = SCREEN.flying;
  game.popups = [];
  game.flash = MISSIONS[missionIndex].name + ' — ' + MISSIONS[missionIndex].tagline;
  game.flashUntil = game.time + 4;
  if (audio) playClick(audio);
}

function endFlight(game, reason, audio) {
  game.endReason = reason;
  const mission = game.mission;
  const bonus = reason === 'landed' ? finishBonus(mission) : 0;
  game.endBonus = bonus;
  game.endScore = mission.score + bonus;
  game.bestScore = Math.max(game.bestScore, game.endScore);
  game.screen = reason === 'landed' ? SCREEN.landed : SCREEN.crashed;
  if (audio) {
    if (reason === 'landed') playFanfare(audio);
    else playThud(audio);
  }
}

// One fixed step of the simulation. `controls` is the pilot's input for
// this frame; `actions` carries one-shot keys (gear, pause, restart...).
export function stepGame(game, controls, actions, audio, dt) {
  game.time += dt;
  if (game.screen === SCREEN.title) {
    // The title screen idles on the runway, engine off, scenery drifting.
    return;
  }
  if (game.screen === SCREEN.paused) return;
  if (game.screen !== SCREEN.flying) return;

  const plane = game.plane;
  const previous = { ...plane };

  if (actions.gear) {
    plane.gearDown = !plane.gearDown;
    if (audio) playClick(audio);
  }

  stepPlane(plane, controls, dt);
  if (audio) updateAudio(audio, plane);

  if (plane.crashed) {
    endFlight(game, 'crashed', audio);
    return;
  }
  if (plane.fuel <= 0 && !plane.onGround) {
    // Out of fuel in the air: the plane glides down and the ground decides.
    if (plane.y <= 4) {
      plane.crashed = true;
      plane.crashReason = 'Out of fuel — the engine quit over the valley.';
      endFlight(game, 'crashed', audio);
      return;
    }
  }

  const event = stepMission(game.mission, plane, dt, previous);
  if (event === 'ring' || event === 'waypoint') {
    if (audio) playChime(audio);
    game.popups.push({ text: event === 'ring' ? '+100 RING' : '+150 DELIVERY', life: 1.6, max: 1.6 });
    game.flash = event === 'ring' ? 'Ring flown — +100' : 'Delivery made — +150';
    game.flashUntil = game.time + 2;
  } else if (event === 'takeoff') {
    game.flash = 'Airborne — fly the mission';
    game.flashUntil = game.time + 2.5;
  } else if (event === 'altitude') {
    if (audio) playChime(audio);
    game.flash = 'Above 300 m — +120';
    game.flashUntil = game.time + 2;
  } else if (event === 'land') {
    endFlight(game, 'landed', audio);
    return;
  } else if (event === 'timeout') {
    game.endReason = 'Time ran out — the mission window closed.';
    game.endScore = game.mission.score;
    game.endBonus = 0;
    game.screen = SCREEN.failed;
    if (audio) playThud(audio);
    return;
  }

  for (const popup of game.popups) popup.life -= dt;
  game.popups = game.popups.filter((popup) => popup.life > 0);

  // Beacon: where is the next ring or waypoint, relative to the nose?
  const objective = currentObjective(game.mission);
  if (objective && (objective.type === 'ring' || objective.type === 'waypoint')) {
    const target = game.mission.def.rings[objective.index];
    const dx = target.x - plane.x;
    const dz = target.z - plane.z;
    const distance = Math.hypot(dx, target.y - plane.y, dz);
    const bearing = Math.atan2(dx, dz);
    const relative = angleDifference(plane.heading, bearing);
    game.beacon = { distance, relative, target };
  } else {
    game.beacon = null;
  }
}

export function togglePause(game, audio) {
  if (game.screen === SCREEN.flying) {
    game.screen = SCREEN.paused;
  } else if (game.screen === SCREEN.paused) {
    game.screen = SCREEN.flying;
  }
  if (audio) playClick(audio);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderGame(ctx, game, width, height) {
  const camera = chaseCamera(game.plane, width, height);
  drawSky(ctx, camera, width, height, game.time);
  drawPeaks(ctx, camera, game.peaks);
  drawClouds(ctx, camera, game.clouds, game.time);
  drawGround(ctx, camera, game.plane);
  drawTrees(ctx, camera, game.trees);
  drawBalloons(ctx, camera, game.balloons, game.time);

  // Rings: the next one glows, the rest are dim beacons.
  const objective = currentObjective(game.mission);
  const nextIndex = objective && (objective.type === 'ring' || objective.type === 'waypoint') ? objective.index : -1;
  game.mission.def.rings.forEach((ring, index) => {
    if (index < nextIndex) return; // flown rings vanish
    drawRing(ctx, camera, ring, index === nextIndex, game.time);
  });

  drawPlane(ctx, game.plane, width, height);

  if (game.screen === SCREEN.flying || game.screen === SCREEN.paused) {
    drawHud(ctx, game.plane, game.mission, width, height, game.time);
    drawBeacon(ctx, game, camera, width, height);
    drawPopups(ctx, game, width, height);
    if (game.time < game.flashUntil) drawFlash(ctx, game.flash, width, height);
    if (game.screen === SCREEN.paused) drawPaused(ctx, width, height);
  } else if (game.screen === SCREEN.title) {
    drawTitle(ctx, game, width, height);
  } else {
    drawDebrief(ctx, game, width, height);
  }
}

function drawBeacon(ctx, game, camera, width, height) {
  const beacon = game.beacon;
  if (!beacon) return;
  const target = beacon.target;
  const projected = project(target, camera, camera.focal, camera.halfWidth, camera.halfHeight);
  const scale = Math.min(width, height) / 720;
  const onScreen = projected && projected.x > 60 && projected.x < width - 60 && projected.y > 60 && projected.y < height - 200;
  ctx.font = `700 ${Math.round(15 * scale)}px system-ui, sans-serif`;
  if (onScreen) {
    // A small diamond marker hugging the ring, with the distance.
    ctx.strokeStyle = 'rgba(255, 210, 90, 0.95)';
    ctx.lineWidth = 2;
    const r = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(projected.x, projected.y - 26 * scale - r);
    ctx.lineTo(projected.x + r, projected.y - 26 * scale);
    ctx.lineTo(projected.x, projected.y - 26 * scale + r);
    ctx.lineTo(projected.x - r, projected.y - 26 * scale);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#ffd25e';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(beacon.distance) + ' m', projected.x, projected.y - 26 * scale - r - 6 * scale);
    ctx.textAlign = 'left';
    return;
  }
  // Off-screen: an arrow at the top edge pointing toward the target.
  const arrowX = clamp(width / 2 + beacon.relative * width * 0.9, 40, width - 40);
  const arrowY = 170 * scale;
  ctx.fillStyle = 'rgba(255, 210, 90, 0.95)';
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY - 12 * scale);
  ctx.lineTo(arrowX + 16 * scale, arrowY + 8 * scale);
  ctx.lineTo(arrowX - 16 * scale, arrowY + 8 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(beacon.distance) + ' m', arrowX, arrowY + 30 * scale);
  ctx.textAlign = 'left';
}

function drawPopups(ctx, game, width, height) {
  const scale = Math.min(width, height) / 720;
  ctx.font = `800 ${Math.round(24 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  game.popups.forEach((popup, index) => {
    const alpha = clamp(popup.life / popup.max, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffd25e';
    ctx.fillText(popup.text, width / 2, height * 0.3 + index * 30 * scale - (1 - alpha) * 30);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawFlash(ctx, text, width, height) {
  const scale = Math.min(width, height) / 720;
  ctx.font = `700 ${Math.round(20 * scale)}px system-ui, sans-serif`;
  const textWidth = ctx.measureText(text).width + 32;
  ctx.fillStyle = 'rgba(8, 18, 34, 0.65)';
  roundRect(ctx, width / 2 - textWidth / 2, height - 190 * scale, textWidth, 38 * scale, 9);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(text, width / 2, height - 190 * scale + 25 * scale);
  ctx.textAlign = 'left';
}

function drawPaused(ctx, width, height) {
  ctx.fillStyle = 'rgba(8, 14, 26, 0.55)';
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width, height) / 720;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(44 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', width / 2, height / 2 - 10);
  ctx.font = `400 ${Math.round(18 * scale)}px system-ui, sans-serif`;
  ctx.fillText('Press P to keep flying — R to restart', width / 2, height / 2 + 30 * scale);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, game, width, height) {
  const scale = Math.min(width, height) / 720;
  // Dim the scene a touch so the panel reads.
  ctx.fillStyle = 'rgba(8, 14, 26, 0.35)';
  ctx.fillRect(0, 0, width, height);

  const panelW = Math.min(620 * scale, width - 32);
  const panelH = 470 * scale;
  const panelX = (width - panelW) / 2;
  const panelY = (height - panelH) / 2;
  ctx.fillStyle = 'rgba(8, 18, 34, 0.82)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 210, 90, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.stroke();

  let y = panelY + 58 * scale;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd25e';
  ctx.font = `800 ${Math.round(46 * scale)}px system-ui, sans-serif`;
  ctx.fillText('SKYCOURIER', width / 2, y);
  y += 30 * scale;
  ctx.fillStyle = '#cfe0ee';
  ctx.font = `400 ${Math.round(19 * scale)}px system-ui, sans-serif`;
  ctx.fillText('Alpine Ring Run — a little bush plane, a big valley', width / 2, y);

  y += 52 * scale;
  ctx.font = `700 ${Math.round(17 * scale)}px system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PICK A MISSION — press 1, 2 or 3, or click', width / 2, y);

  y += 16 * scale;
  MISSIONS.forEach((mission, index) => {
    y += 44 * scale;
    const selected = index === game.missionIndex;
    ctx.fillStyle = selected ? 'rgba(255, 210, 90, 0.22)' : 'rgba(255, 255, 255, 0.06)';
    roundRect(ctx, panelX + 24 * scale, y - 24 * scale, panelW - 48 * scale, 38 * scale, 9);
    ctx.fill();
    ctx.fillStyle = selected ? '#ffd25e' : '#ffffff';
    ctx.font = `700 ${Math.round(18 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText((index + 1) + '  ' + mission.name, panelX + 40 * scale, y + 1 * scale);
    ctx.fillStyle = '#cfe0ee';
    ctx.font = `400 ${Math.round(14 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(mission.tagline, panelX + panelW - 40 * scale, y + 1 * scale);
    ctx.textAlign = 'center';
  });

  y += 62 * scale;
  ctx.fillStyle = '#cfe0ee';
  ctx.font = `400 ${Math.round(15 * scale)}px system-ui, sans-serif`;
  ctx.fillText('Fly: ← → bank · ↑ ↓ pitch · W / S throttle · G gear · mouse steers', width / 2, y);
  y += 24 * scale;
  ctx.fillText('P pause · M mute · R restart · Enter start', width / 2, y);
  y += 30 * scale;
  ctx.fillStyle = '#ffd25e';
  ctx.font = `700 ${Math.round(17 * scale)}px system-ui, sans-serif`;
  ctx.fillText('Press ENTER or click to fly mission ' + (game.missionIndex + 1), width / 2, y);
  if (game.bestScore > 0) {
    y += 26 * scale;
    ctx.fillStyle = '#9fc3e2';
    ctx.font = `400 ${Math.round(14 * scale)}px system-ui, sans-serif`;
    ctx.fillText('Best score this session: ' + game.bestScore, width / 2, y);
  }
  ctx.textAlign = 'left';
}

function drawDebrief(ctx, game, width, height) {
  const scale = Math.min(width, height) / 720;
  const landed = game.screen === SCREEN.landed;
  const failed = game.screen === SCREEN.failed;
  ctx.fillStyle = 'rgba(8, 14, 26, 0.5)';
  ctx.fillRect(0, 0, width, height);

  const panelW = Math.min(560 * scale, width - 32);
  const panelH = 400 * scale;
  const panelX = (width - panelW) / 2;
  const panelY = (height - panelH) / 2;
  ctx.fillStyle = 'rgba(8, 18, 34, 0.88)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = landed ? 'rgba(79, 201, 79, 0.6)' : 'rgba(255, 81, 72, 0.6)';
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.stroke();

  let y = panelY + 62 * scale;
  ctx.textAlign = 'center';
  ctx.fillStyle = landed ? '#4fc94f' : failed ? '#ffb02e' : '#ff5148';
  ctx.font = `800 ${Math.round(40 * scale)}px system-ui, sans-serif`;
  ctx.fillText(landed ? 'MISSION COMPLETE' : failed ? 'OUT OF TIME' : 'CRASHED', width / 2, y);

  y += 34 * scale;
  ctx.fillStyle = '#cfe0ee';
  ctx.font = `400 ${Math.round(17 * scale)}px system-ui, sans-serif`;
  const reason = landed
    ? game.mission.def.name + ' flown and landed.'
    : game.screen === SCREEN.crashed
      ? game.plane.crashReason || game.endReason
      : game.endReason;
  ctx.fillText(reason, width / 2, y);

  y += 46 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(19 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  const mission = game.mission;
  const lines = [
    ['Rings flown', mission.ringsHit + ' / ' + mission.def.rings.length],
    ['Deliveries', String(mission.waypointsHit)],
    ['Best altitude', Math.round(mission.altitudeBest) + ' m'],
    ['Distance flown', (mission.def ? (game.plane.distanceFlown / 1000).toFixed(1) : '0') + ' km'],
    ['Fuel left', Math.round(game.plane.fuel) + '%'],
  ];
  for (const [label, value] of lines) {
    ctx.fillStyle = '#9fc3e2';
    ctx.fillText(label, panelX + 48 * scale, y);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(value, panelX + panelW - 48 * scale, y);
    ctx.textAlign = 'left';
    y += 26 * scale;
  }

  y += 12 * scale;
  ctx.fillStyle = '#ffd25e';
  ctx.font = `800 ${Math.round(26 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('SCORE ' + game.endScore + (game.endBonus > 0 ? '  (incl. +' + game.endBonus + ' time bonus)' : ''), width / 2, y);

  y += 44 * scale;
  ctx.fillStyle = '#cfe0ee';
  ctx.font = `400 ${Math.round(16 * scale)}px system-ui, sans-serif`;
  ctx.fillText('Press R to fly again · 1 / 2 / 3 to switch mission · Enter to retry', width / 2, y);
  ctx.textAlign = 'left';
}

export { STEP };
