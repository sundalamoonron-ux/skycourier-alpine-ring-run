// The HUD and the instrument panel: altitude, speed and heading on top,
// the objective and score beside them, and a lit panel of dials along the
// bottom — artificial horizon, altimeter, airspeed, compass, fuel and
// throttle — plus the warning lights a pilot actually watches.
import { PLANE } from './config.js';
import { clamp } from './math3d.js';

function headingName(headingDeg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(headingDeg / 45) % 8];
}

export function drawHud(ctx, plane, mission, width, height, time) {
  const scale = Math.min(width, height) / 720;
  ctx.textBaseline = 'alphabetic';

  // Top-left: altitude, speed, heading in big readable figures.
  const alt = Math.max(0, plane.y);
  const speedKnots = Math.round(plane.speed * 1.944);
  const headingDeg = Math.round(((plane.heading * 180) / Math.PI) % 360);
  ctx.fillStyle = 'rgba(8, 18, 34, 0.55)';
  roundRect(ctx, 14, 12, 300 * scale + 40, 108 * scale, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(26 * scale)}px system-ui, sans-serif`;
  ctx.fillText('ALT ' + alt.toFixed(0) + ' m', 28, 44 * scale + 6);
  ctx.fillText('SPD ' + speedKnots + ' kt', 28, 76 * scale + 6);
  ctx.fillText(
    'HDG ' + String(headingDeg).padStart(3, '0') + '° ' + headingName(headingDeg),
    28, 108 * scale + 6,
  );

  // Top-right: score, rings and the clock.
  const mins = Math.floor(mission.timeLeft / 60);
  const secs = Math.floor(mission.timeLeft % 60);
  const clock = mins + ':' + String(secs).padStart(2, '0');
  ctx.fillStyle = 'rgba(8, 18, 34, 0.55)';
  roundRect(ctx, width - 244 * scale - 14, 12, 244 * scale, 108 * scale, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd25e';
  ctx.font = `700 ${Math.round(26 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('SCORE ' + mission.score, width - 28, 44 * scale + 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('RINGS ' + mission.ringsHit + '/' + mission.def.rings.length, width - 28, 76 * scale + 6);
  ctx.fillStyle = mission.timeLeft < 30 ? '#ff6b5e' : '#ffffff';
  ctx.fillText('TIME ' + clock, width - 28, 108 * scale + 6);
  ctx.textAlign = 'left';

  // Objective banner under the top-left block.
  const label = objectiveText(mission);
  ctx.font = `700 ${Math.round(17 * scale)}px system-ui, sans-serif`;
  const labelWidth = ctx.measureText(label).width + 28;
  ctx.fillStyle = 'rgba(255, 190, 60, 0.92)';
  roundRect(ctx, 14, 128 * scale + 8, labelWidth, 34 * scale, 8);
  ctx.fill();
  ctx.fillStyle = '#23180a';
  ctx.fillText(label, 28, 128 * scale + 8 + 23 * scale);

  drawWarnings(ctx, plane, mission, width, height, scale, time);
  drawCompassStrip(ctx, plane, width, height, scale);
  drawInstrumentPanel(ctx, plane, width, height, scale);
}

export function objectiveText(mission) {
  const objective = mission.def.objectives[mission.objectiveIndex];
  if (!objective) return 'MISSION COMPLETE — LAND';
  if (objective.type === 'takeoff') return '▶ TAKE OFF — full throttle, pull up';
  if (objective.type === 'ring') return '▶ RING ' + (objective.index + 1) + ' / ' + mission.def.rings.length;
  if (objective.type === 'waypoint') return '▶ ' + objective.label;
  if (objective.type === 'altitude') return '▶ ' + objective.label;
  if (objective.type === 'land') return '▶ LAND ON THE RUNWAY';
  return '';
}

function drawWarnings(ctx, plane, mission, width, height, scale, time) {
  const warnings = [];
  if (plane.speed < PLANE.stallSpeed && !plane.onGround) warnings.push({ text: 'STALL', color: '#ff5148' });
  if (plane.fuel < 20) warnings.push({ text: 'LOW FUEL', color: '#ffb02e' });
  if (!plane.gearDown && plane.y < 60 && plane.speed < 70) warnings.push({ text: 'GEAR UP', color: '#ffb02e' });
  if (mission.timeLeft < 30 && mission.timeLeft > 0) warnings.push({ text: 'TIME LOW', color: '#ff5148' });
  if (warnings.length === 0) return;
  const blink = Math.sin(time * 6) > 0 ? 1 : 0.45;
  ctx.globalAlpha = blink;
  ctx.font = `800 ${Math.round(18 * scale)}px system-ui, sans-serif`;
  let x = width / 2 - (warnings.length * 110 * scale) / 2;
  for (const warning of warnings) {
    ctx.fillStyle = warning.color;
    roundRect(ctx, x, 14, 100 * scale, 32 * scale, 7);
    ctx.fill();
    ctx.fillStyle = '#1c0d08';
    ctx.textAlign = 'center';
    ctx.fillText(warning.text, x + 50 * scale, 14 + 22 * scale);
    ctx.textAlign = 'left';
    x += 110 * scale;
  }
  ctx.globalAlpha = 1;
}

function drawCompassStrip(ctx, plane, width, height, scale) {
  const stripWidth = 360 * scale;
  const stripX = width / 2 - stripWidth / 2;
  const stripY = 14;
  ctx.fillStyle = 'rgba(8, 18, 34, 0.55)';
  roundRect(ctx, stripX, stripY, stripWidth, 34 * scale, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, stripX, stripY, stripWidth, 34 * scale, 8);
  ctx.clip();
  const headingDeg = ((plane.heading * 180) / Math.PI) % 360;
  const pxPerDeg = (stripWidth / 120);
  ctx.font = `700 ${Math.round(14 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (let deg = -120; deg <= 120; deg += 15) {
    const absolute = Math.round((headingDeg + deg + 360) % 360);
    const x = stripX + stripWidth / 2 + deg * pxPerDeg;
    const cardinal = absolute % 90 === 0 ? ['N', 'E', 'S', 'W'][Math.floor(absolute / 90) % 4] : null;
    ctx.fillStyle = cardinal ? '#ffd25e' : '#cfe0ee';
    ctx.fillText(cardinal ?? String(absolute).padStart(3, '0'), x, stripY + 22 * scale);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x - 0.5, stripY + 26 * scale, 1, 6 * scale);
  }
  ctx.restore();
  // Centre lubber line.
  ctx.fillStyle = '#ffd25e';
  ctx.beginPath();
  ctx.moveTo(width / 2 - 6 * scale, stripY);
  ctx.lineTo(width / 2 + 6 * scale, stripY);
  ctx.lineTo(width / 2, stripY + 8 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'left';
}

function drawInstrumentPanel(ctx, plane, width, height, scale) {
  const panelHeight = 118 * scale;
  const panelY = height - panelHeight - 10;
  const panelWidth = Math.min(760 * scale, width - 20);
  const panelX = (width - panelWidth) / 2;
  ctx.fillStyle = 'rgba(10, 16, 28, 0.78)';
  roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
  ctx.stroke();

  const dialR = 44 * scale;
  const gap = panelWidth / 5;
  const cy = panelY + panelHeight / 2;

  drawAttitude(ctx, plane, panelX + gap * 0.5, cy, dialR);
  drawAltimeter(ctx, plane, panelX + gap * 1.5, cy, dialR);
  drawAirspeed(ctx, plane, panelX + gap * 2.5, cy, dialR);
  drawFuelAndThrottle(ctx, plane, panelX + gap * 3.5, cy, dialR, scale);
  drawGearAndFlaps(ctx, plane, panelX + gap * 4.5, cy, dialR, scale);
}

function dialFace(ctx, x, y, radius, label) {
  ctx.fillStyle = '#101c2e';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8fb4d8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#9fc3e2';
  ctx.font = `700 ${Math.round(11 * (radius / 44))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + radius + 14 * (radius / 44));
  ctx.textAlign = 'left';
}

function drawAttitude(ctx, plane, x, y, radius) {
  dialFace(ctx, x, y, radius, 'ATTITUDE');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.bank);
  const pitchOffset = clamp(plane.pitch, -0.45, 0.45) * radius * 1.6;
  // Sky half and ground half, split by the horizon line.
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-radius, -radius + pitchOffset, radius * 2, radius - pitchOffset);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-radius, pitchOffset, radius * 2, radius);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, pitchOffset);
  ctx.lineTo(radius, pitchOffset);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker.
  ctx.strokeStyle = '#ffd25e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.55, y);
  ctx.lineTo(x - radius * 0.15, y);
  ctx.moveTo(x + radius * 0.15, y);
  ctx.lineTo(x + radius * 0.55, y);
  ctx.stroke();
  ctx.fillStyle = '#ffd25e';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawAltimeter(ctx, plane, x, y, radius) {
  dialFace(ctx, x, y, radius, 'ALT m');
  const alt = Math.max(0, plane.y);
  drawNeedle(ctx, x, y, radius, (alt % 1000) / 1000);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(15 * (radius / 44))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(alt.toFixed(0), x, y + 5 * (radius / 44));
  ctx.textAlign = 'left';
}

function drawAirspeed(ctx, plane, x, y, radius) {
  dialFace(ctx, x, y, radius, 'KT');
  const knots = plane.speed * 1.944;
  drawNeedle(ctx, x, y, radius, clamp(knots / 200, 0, 1));
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(15 * (radius / 44))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(knots.toFixed(0), x, y + 5 * (radius / 44));
  ctx.textAlign = 'left';
}

function drawNeedle(ctx, x, y, radius, fraction) {
  const angle = -Math.PI * 0.75 + fraction * Math.PI * 1.5;
  ctx.strokeStyle = '#ff5b4d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * (radius - 6), y + Math.sin(angle) * (radius - 6));
  ctx.stroke();
  // Tick marks.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const tick = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(tick) * (radius - 4), y + Math.sin(tick) * (radius - 4));
    ctx.lineTo(x + Math.cos(tick) * (radius - 9), y + Math.sin(tick) * (radius - 9));
    ctx.stroke();
  }
}

function drawFuelAndThrottle(ctx, plane, x, y, radius, scale) {
  dialFace(ctx, x, y, radius, 'FUEL / THR');
  // Fuel bar.
  const barW = radius * 1.5;
  const barH = 9 * scale;
  const barX = x - barW / 2;
  const barY = y - radius * 0.45;
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = plane.fuel < 20 ? '#ff5148' : '#4fc94f';
  ctx.fillRect(barX, barY, barW * clamp(plane.fuel / 100, 0, 1), barH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(12 * (radius / 44))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(plane.fuel) + '%', x, barY + barH + 14 * (radius / 44));
  // Throttle bar.
  const thrY = y + radius * 0.3;
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(barX, thrY, barW, barH);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(barX, thrY, barW * clamp(plane.throttle, 0, 1), barH);
  ctx.fillText(Math.round(plane.throttle * 100) + '%', x, thrY + barH + 14 * (radius / 44));
  ctx.textAlign = 'left';
}

function drawGearAndFlaps(ctx, plane, x, y, radius, scale) {
  dialFace(ctx, x, y, radius, 'GEAR');
  ctx.font = `800 ${Math.round(16 * (radius / 44))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = plane.gearDown ? '#4fc94f' : '#ffb02e';
  ctx.fillText(plane.gearDown ? 'DOWN' : 'UP', x, y - 2 * scale);
  ctx.fillStyle = plane.onGround ? '#9fc3e2' : '#ffd25e';
  ctx.font = `700 ${Math.round(11 * (radius / 44))}px system-ui, sans-serif`;
  ctx.fillText(plane.onGround ? 'ON GROUND' : 'AIRBORNE', x, y + 16 * scale);
  ctx.textAlign = 'left';
}

export function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}
