// 3D projection helpers for the chase camera: a point in world space is
// rotated into camera space (right / up / forward) and projected with a
// pinhole camera onto the 2D canvas.
export const DEG = Math.PI / 180;

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// Build the camera basis from heading (0 = north, +z), pitch and roll.
// Forward points where the camera looks; right and up complete the frame.
export function cameraBasis(heading, pitch, roll) {
  const ch = Math.cos(heading);
  const sh = Math.sin(heading);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // Forward, before roll: (sin h * cos p, sin p, cos h * cos p)
  const forward = { x: sh * cp, y: sp, z: ch * cp };
  // World-up based right vector, then roll both right and up.
  let right = { x: ch, y: 0, z: -sh };
  let up = {
    x: -sh * sp,
    y: cp,
    z: -ch * sp,
  };
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const rolledRight = {
    x: right.x * cr + up.x * sr,
    y: right.y * cr + up.y * sr,
    z: right.z * cr + up.z * sr,
  };
  const rolledUp = {
    x: up.x * cr - right.x * sr,
    y: up.y * cr - right.y * sr,
    z: up.z * cr - right.z * sr,
  };
  return { forward, right: rolledRight, up: rolledUp };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// Project a world point. Returns null when behind the camera.
// focal is in pixels: (canvasHeight / 2) / tan(fov / 2).
export function project(point, camera, focal, halfWidth, halfHeight) {
  const rel = {
    x: point.x - camera.position.x,
    y: point.y - camera.position.y,
    z: point.z - camera.position.z,
  };
  const cx = dot(rel, camera.basis.right);
  const cy = dot(rel, camera.basis.up);
  const cz = dot(rel, camera.basis.forward);
  if (cz < 2) return null;
  const scale = focal / cz;
  return {
    x: halfWidth + cx * scale,
    y: halfHeight - cy * scale,
    depth: cz,
    scale,
  };
}

// Where the horizon sits on screen for a given camera pitch: the horizon
// is the line cy = 0 at infinite distance, which lands at this y.
export function horizonScreenY(cameraPitch, focal, halfHeight) {
  return halfHeight + Math.tan(cameraPitch) * focal;
}
