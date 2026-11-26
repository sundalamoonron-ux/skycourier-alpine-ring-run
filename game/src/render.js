// The chase-view renderer: sky, sun, clouds, distant peaks, the patchwork
// valley floor, the river, the runway, the rings, and the aircraft itself,
// all projected from world space with the pinhole camera in math3d.js.
// No images, no assets — every pixel is drawn from code.
import { RING_RADIUS, WORLD } from './config.js';
import { cameraBasis, clamp, horizonScreenY, project } from './math3d.js';
import { fieldColor, groundHeight, isOverRiver, riverX } from './terrain.js';

const FOV_DEG = 68;

// Where the camera sits and looks, from the plane's state.
export function chaseCamera(plane, width, height) {
  const ch = Math.cos(plane.heading);
  const sh = Math.sin(plane.heading);
  const cp = Math.cos(plane.pitch);
  const sp = Math.sin(plane.pitch);
  const forward = { x: sh * cp, y: sp, z: ch * cp };
  const back = 17;
  const lift = 5.2;
  const position = {
    x: plane.x - forward.x * back,
    y: Math.max(plane.y - forward.y * back + lift, groundHeight(plane.x, plane.z) + 3),
    z: plane.z - forward.z * back,
  };
  const lookAt = {
    x: plane.x + forward.x * 34,
    y: plane.y + forward.y * 34 + 2,
    z: plane.z + forward.z * 34,
  };
  // The camera pitches and rolls with the plane, but only part-way, so the
  // horizon stays readable while the bank still reads.
  const cameraPitch = plane.pitch * 0.85 + 0.03;
  const cameraRoll = plane.bank * 0.45;
  const basis = cameraBasis(plane.heading, cameraPitch, cameraRoll);
  const focal = (height / 2) / Math.tan((FOV_DEG / 2) * Math.PI / 180);
  return { position, lookAt, basis, focal, pitch: cameraPitch, halfWidth: width / 2, halfHeight: height / 2 };
}

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
}

function projectGroundQuad(ctx, camera, corners, fill) {
  const projected = corners.map((corner) => project(corner, camera, camera.focal, camera.halfWidth, camera.halfHeight));
  if (projected.some((p) => p === null)) return;
  if (projected.some((p) => p.x < -400 || p.x > camera.halfWidth * 2 + 400 || p.y < -400 || p.y > camera.halfHeight * 2 + 400)) {
    // Still draw: a quad can straddle the screen edge.
  }
  ctx.fillStyle = fill;
  polygon(ctx, projected);
}

export function drawSky(ctx, camera, width, height, time) {
  const horizonY = horizonScreenY(camera.pitch, camera.focal, camera.halfHeight);
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
  sky.addColorStop(0, '#1f5fa8');
  sky.addColorStop(0.55, '#5ea3d8');
  sky.addColorStop(1, '#cfe6f5');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, Math.max(horizonY, 0));
  // Haze below the horizon.
  if (horizonY < height) {
    const haze = ctx.createLinearGradient(0, horizonY, 0, height);
    haze.addColorStop(0, '#d8e4ee');
    haze.addColorStop(0.25, '#b9c9a4');
    haze.addColorStop(1, '#7d9b58');
    ctx.fillStyle = haze;
    ctx.fillRect(0, Math.max(horizonY, 0), width, height - Math.max(horizonY, 0));
  }
  // The sun: fixed in the sky at azimuth ~200 deg, elevation ~28 deg.
  const sunDir = {
    x: Math.sin(200 * Math.PI / 180) * Math.cos(28 * Math.PI / 180),
    y: Math.sin(28 * Math.PI / 180),
    z: Math.cos(200 * Math.PI / 180) * Math.cos(28 * Math.PI / 180),
  };
  const sunPoint = {
    x: camera.position.x + sunDir.x * 4000,
    y: camera.position.y + sunDir.y * 4000,
    z: camera.position.z + sunDir.z * 4000,
  };
  const sun = project(sunPoint, camera, camera.focal, camera.halfWidth, camera.halfHeight);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
    glow.addColorStop(0, 'rgba(255, 246, 200, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 232, 150, 0.55)');
    glow.addColorStop(1, 'rgba(255, 232, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 140, sun.y - 140, 280, 280);
    ctx.fillStyle = '#fff8d8';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  void time;
}

export function drawPeaks(ctx, camera, peaks) {
  for (const peak of peaks) {
    const base = project({ x: peak.x, y: 0, z: peak.z }, camera, camera.focal, camera.halfWidth, camera.halfHeight);
    const apex = project({ x: peak.x, y: peak.height, z: peak.z }, camera, camera.focal, camera.halfWidth, camera.halfHeight);
    if (!base || !apex) continue;
    const halfBase = (peak.width / 2) * apex.scale;
    const left = { x: base.x - halfBase, y: base.y };
    const right = { x: base.x + halfBase, y: base.y };
    ctx.fillStyle = '#5d6f8e';
    polygon(ctx, [left, right, apex]);
    // Snow cap.
    const snowY = apex.y + (base.y - apex.y) * (1 - peak.snow);
    const snowHalf = halfBase * peak.snow;
    ctx.fillStyle = '#f2f6fb';
    polygon(ctx, [
      { x: apex.x - snowHalf, y: snowY },
      { x: apex.x + snowHalf, y: snowY },
      apex,
    ]);
  }
}

export function drawClouds(ctx, camera, clouds, time) {
  for (const cloud of clouds) {
    const drift = Math.sin(time * 0.02 + cloud.seed) * 12;
    const centre = project(
      { x: cloud.x + drift, y: cloud.y, z: cloud.z },
      camera, camera.focal, camera.halfWidth, camera.halfHeight,
    );
    if (!centre || centre.depth > 4200) continue;
    const radius = cloud.size * centre.scale;
    if (radius < 3) continue;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < cloud.puffs; i += 1) {
      const offsetX = (i - cloud.puffs / 2) * radius * 0.55;
      const offsetY = Math.sin(i * 2.1 + cloud.seed) * radius * 0.18;
      ctx.beginPath();
      ctx.ellipse(centre.x + offsetX, centre.y + offsetY, radius * 0.55, radius * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The valley floor: a checker of farm fields, fading into haze with
// distance, plus the river, a road and the runway strip.
export function drawGround(ctx, camera, plane) {
  const cell = 150;
  const camX = camera.position.x;
  const camZ = camera.position.z;
  const xStart = Math.floor((camX - 1350) / cell) * cell;
  const xEnd = camX + 1350;
  const zStart = Math.floor((camZ - 350) / cell) * cell;
  const zEnd = camZ + 3400;
  for (let z = zStart; z < zEnd; z += cell) {
    for (let x = xStart; x < xEnd; x += cell) {
      const corners = [
        { x, y: groundHeight(x, z), z },
        { x: x + cell, y: groundHeight(x + cell, z), z },
        { x: x + cell, y: groundHeight(x + cell, z + cell), z: z + cell },
        { x, y: groundHeight(x, z + cell), z: z + cell },
      ];
      // Skip cells swallowed by the mountains or the river.
      const midX = x + cell / 2;
      const midZ = z + cell / 2;
      if (Math.abs(midX) > WORLD.mountainStart + 250) continue;
      if (isOverRiver(midX, midZ)) continue;
      const fade = clamp(1 - (midZ - camZ - 1800) / 1600, 0.15, 1);
      ctx.globalAlpha = fade;
      projectGroundQuad(ctx, camera, corners, fieldColor(Math.round(x / cell), Math.round(z / cell)));
    }
  }
  ctx.globalAlpha = 1;
  drawRiver(ctx, camera);
  drawRoad(ctx, camera);
  drawRunway(ctx, camera);
}

function drawRiver(ctx, camera) {
  const camZ = camera.position.z;
  for (let z = Math.floor((camZ - 300) / 100) * 100; z < camZ + 3200; z += 100) {
    const centre = riverX(z);
    const corners = [
      { x: centre - 26, y: 0.6, z },
      { x: centre + 26, y: 0.6, z },
      { x: riverX(z + 100) + 26, y: 0.6, z: z + 100 },
      { x: riverX(z + 100) - 26, y: 0.6, z: z + 100 },
    ];
    projectGroundQuad(ctx, camera, corners, '#4f8fc4');
  }
}

function drawRoad(ctx, camera) {
  const camZ = camera.position.z;
  const roadX = 380;
  for (let z = Math.floor((camZ - 300) / 100) * 100; z < camZ + 3200; z += 100) {
    const corners = [
      { x: roadX - 7, y: 0.5, z },
      { x: roadX + 7, y: 0.5, z },
      { x: roadX + 7, y: 0.5, z: z + 100 },
      { x: roadX - 7, y: 0.5, z: z + 100 },
    ];
    projectGroundQuad(ctx, camera, corners, '#8a8a86');
    if (Math.floor(z / 100) % 2 === 0) {
      const dash = [
        { x: roadX - 1, y: 0.7, z: z + 20 },
        { x: roadX + 1, y: 0.7, z: z + 20 },
        { x: roadX + 1, y: 0.7, z: z + 60 },
        { x: roadX - 1, y: 0.7, z: z + 60 },
      ];
      projectGroundQuad(ctx, camera, dash, '#f5f2e8');
    }
  }
}

function drawRunway(ctx, camera) {
  const r = WORLD.runway;
  const camZ = camera.position.z;
  for (let z = Math.max(r.zStart, Math.floor((camZ - 300) / 100) * 100); z < Math.min(r.zEnd, camZ + 3200); z += 100) {
    const corners = [
      { x: r.x - r.width / 2, y: 0.4, z },
      { x: r.x + r.width / 2, y: 0.4, z },
      { x: r.x + r.width / 2, y: 0.4, z: z + 100 },
      { x: r.x - r.width / 2, y: 0.4, z: z + 100 },
    ];
    projectGroundQuad(ctx, camera, corners, '#3c4148');
    if (Math.floor(z / 100) % 2 === 0) {
      const dash = [
        { x: -1.2, y: 0.6, z: z + 25 },
        { x: 1.2, y: 0.6, z: z + 25 },
        { x: 1.2, y: 0.6, z: z + 75 },
        { x: -1.2, y: 0.6, z: z + 75 },
      ];
      projectGroundQuad(ctx, camera, dash, '#f2f0e6');
    }
  }
  // Threshold bars at both ends.
  for (const endZ of [r.zStart + 12, r.zEnd - 12]) {
    const bar = [
      { x: r.x - r.width / 2 + 3, y: 0.6, z: endZ },
      { x: r.x + r.width / 2 - 3, y: 0.6, z: endZ },
      { x: r.x + r.width / 2 - 3, y: 0.6, z: endZ + 8 },
      { x: r.x - r.width / 2 + 3, y: 0.6, z: endZ + 8 },
    ];
    projectGroundQuad(ctx, camera, bar, '#f2f0e6');
  }
}

export function drawTrees(ctx, camera, trees) {
  const sorted = trees
    .map((tree) => ({ tree, depth: Math.hypot(tree.x - camera.position.x, tree.z - camera.position.z) }))
    .filter((item) => item.depth < 1600)
    .sort((a, b) => b.depth - a.depth);
  for (const { tree } of sorted) {
    const base = project(tree, camera, camera.focal, camera.halfWidth, camera.halfHeight);
    if (!base) continue;
    const height = tree.size * base.scale;
    if (height < 2) continue;
    const shade = tree.shade > 0.5 ? '#2f5d2a' : '#3a6b32';
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y - height);
    ctx.lineTo(base.x - height * 0.42, base.y);
    ctx.lineTo(base.x + height * 0.42, base.y);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawBalloons(ctx, camera, balloons, time) {
  for (const balloon of balloons) {
    const driftX = Math.sin(time * 0.05 + balloon.drift) * 30;
    const centre = project(
      { x: balloon.x + driftX, y: balloon.y, z: balloon.z },
      camera, camera.focal, camera.halfWidth, camera.halfHeight,
    );
    if (!centre) continue;
    const radius = 16 * centre.scale;
    if (radius < 2) continue;
    ctx.fillStyle = balloon.color;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y - radius, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(centre.x - radius * 0.25, centre.y - radius * 0.1, radius * 0.5, radius * 0.4);
  }
}

// A target ring: a glowing hoop floating in the air, with a faint beam down
// to the ground so the pilot can judge where it sits.
export function drawRing(ctx, camera, ring, isNext, time) {
  const centre = project(ring, camera, camera.focal, camera.halfWidth, camera.halfHeight);
  if (!centre) return;
  const radius = RING_RADIUS * centre.scale;
  if (radius < 1.5) return;
  const pulse = isNext ? 0.75 + 0.25 * Math.sin(time * 4) : 0.9;
  const groundPoint = project(
    { x: ring.x, y: groundHeight(ring.x, ring.z) + 1, z: ring.z },
    camera, camera.focal, camera.halfWidth, camera.halfHeight,
  );
  if (groundPoint) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centre.x, centre.y + radius);
    ctx.lineTo(groundPoint.x, groundPoint.y);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = isNext ? `rgba(255, 190, 60, ${0.35 * pulse})` : 'rgba(120, 220, 255, 0.3)';
  ctx.lineWidth = Math.max(3, radius * 0.22);
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = isNext ? `rgba(255, 210, 90, ${pulse})` : 'rgba(150, 230, 255, 0.9)';
  ctx.lineWidth = Math.max(2, radius * 0.09);
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  if (isNext) {
    // Chevron ticks around the hoop, pointing inward.
    ctx.strokeStyle = 'rgba(255, 220, 120, 0.95)';
    ctx.lineWidth = Math.max(2, radius * 0.06);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + time * 0.6;
      const ox = Math.cos(angle) * radius * 0.82;
      const oy = Math.sin(angle) * radius * 0.82;
      ctx.beginPath();
      ctx.moveTo(centre.x + ox - Math.cos(angle) * radius * 0.14, centre.y + oy - Math.sin(angle) * radius * 0.14);
      ctx.lineTo(centre.x + ox, centre.y + oy);
      ctx.lineTo(centre.x + ox - Math.cos(angle + 0.5) * radius * 0.14, centre.y + oy - Math.sin(angle + 0.5) * radius * 0.14);
      ctx.stroke();
    }
  }
}

// The aircraft from behind and above: wings, tail, fuselage and the prop
// disc, banked with the plane. Drawn in screen space at the chase point.
export function drawPlane(ctx, plane, width, height) {
  const cx = width / 2;
  const cy = height * 0.58;
  const scale = Math.min(width, height) / 720;
  const size = 150 * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.55);
  // Soft shadow blob under the aircraft for depth.
  ctx.fillStyle = 'rgba(20, 30, 50, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.42, size * 0.5, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main wings.
  ctx.fillStyle = '#d8433c';
  ctx.beginPath();
  ctx.moveTo(-size * 0.52, size * 0.05);
  ctx.lineTo(-size * 0.08, -size * 0.02);
  ctx.lineTo(size * 0.08, -size * 0.02);
  ctx.lineTo(size * 0.52, size * 0.05);
  ctx.lineTo(size * 0.46, size * 0.12);
  ctx.lineTo(-size * 0.46, size * 0.12);
  ctx.closePath();
  ctx.fill();
  // Wing tips: navigation lights.
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(-size * 0.5, size * 0.08, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#40ff70';
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.08, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
  // Fuselage, seen from behind: a tapering body with a stripe.
  ctx.fillStyle = '#f2f0e8';
  ctx.beginPath();
  ctx.moveTo(-size * 0.09, -size * 0.3);
  ctx.quadraticCurveTo(0, -size * 0.38, size * 0.09, -size * 0.3);
  ctx.lineTo(size * 0.11, size * 0.22);
  ctx.quadraticCurveTo(0, size * 0.3, -size * 0.11, size * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8433c';
  ctx.fillRect(-size * 0.09, -size * 0.1, size * 0.18, size * 0.05);
  // Tail fin.
  ctx.fillStyle = '#d8433c';
  ctx.beginPath();
  ctx.moveTo(-size * 0.06, -size * 0.28);
  ctx.lineTo(0, -size * 0.52);
  ctx.lineTo(size * 0.06, -size * 0.28);
  ctx.closePath();
  ctx.fill();
  // Horizontal stabiliser.
  ctx.fillStyle = '#b8352f';
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.2);
  ctx.lineTo(size * 0.3, -size * 0.2);
  ctx.lineTo(size * 0.26, -size * 0.12);
  ctx.lineTo(-size * 0.26, -size * 0.12);
  ctx.closePath();
  ctx.fill();
  // Propeller disc shimmer at the nose (seen edge-on from behind as a glow).
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.26, size * 0.05, size * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();
  // Landing gear legs when down.
  if (plane.gearDown) {
    ctx.strokeStyle = '#33302a';
    ctx.lineWidth = Math.max(2, size * 0.02);
    ctx.beginPath();
    ctx.moveTo(-size * 0.08, size * 0.2);
    ctx.lineTo(-size * 0.1, size * 0.34);
    ctx.moveTo(size * 0.08, size * 0.2);
    ctx.lineTo(size * 0.1, size * 0.34);
    ctx.stroke();
    ctx.fillStyle = '#22201c';
    ctx.beginPath();
    ctx.arc(-size * 0.1, size * 0.36, size * 0.035, 0, Math.PI * 2);
    ctx.arc(size * 0.1, size * 0.36, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
