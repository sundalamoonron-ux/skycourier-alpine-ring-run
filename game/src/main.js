// SkyCourier: Alpine Ring Run — entry point. Boots the canvas, runs the
// fixed-step loop, wires the keys and the mouse, and stages the screenshot
// scenes when the page is opened with ?shot=<name>.
import { SCREEN, STEP } from './config.js';
import { attachInput, endFrame, makeInput, readFlightControls, wasPressed } from './input.js';
import { makeAudio, setMuted, startAudio } from './audio.js';
import { makeGame, renderGame, startMission, stepGame, togglePause } from './game.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

let game;
if (shotName) {
  // A screenshot scene: simulate it now, then draw one frame and stop.
  game = stageShot(shotName, Number(params.get('seed') ?? 1));
  game.screen = SCREEN.flying;
} else {
  game = makeGame();
}

const input = makeInput();
const audio = makeAudio();
let width = 0;
let height = 0;
let lastStatus = '';

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setStatus(text) {
  if (text !== lastStatus) {
    lastStatus = text;
    statusLine.textContent = text;
  }
}

function announceScreen() {
  if (game.screen === SCREEN.title) setStatus('SkyCourier title screen. Choose a mission with keys 1, 2 or 3, then press Enter to fly.');
  else if (game.screen === SCREEN.flying) setStatus('Flying ' + game.mission.def.name + '. Altitude ' + Math.round(game.plane.y) + ' metres, speed ' + Math.round(game.plane.speed * 1.944) + ' knots.');
  else if (game.screen === SCREEN.paused) setStatus('Paused.');
  else if (game.screen === SCREEN.landed) setStatus('Mission complete. Score ' + game.endScore + '.');
  else if (game.screen === SCREEN.crashed) setStatus('Crashed. ' + (game.plane.crashReason || ''));
  else setStatus('Out of time.');
}

attachInput(input, canvas, (key) => {
  startAudio(audio);
  if (key === 'enter') {
    if (game.screen === SCREEN.title || game.screen === SCREEN.landed || game.screen === SCREEN.crashed || game.screen === SCREEN.failed) {
      startMission(game, game.missionIndex, audio);
    }
  } else if (key === '1' || key === '2' || key === '3') {
    const index = Number(key) - 1;
    if (game.screen === SCREEN.title) {
      game.missionIndex = index;
    } else if (game.screen === SCREEN.landed || game.screen === SCREEN.crashed || game.screen === SCREEN.failed) {
      startMission(game, index, audio);
    }
  } else if (key === 'p') {
    togglePause(game, audio);
  } else if (key === 'm') {
    setMuted(audio, !audio.muted);
  } else if (key === 'r') {
    if (game.screen !== SCREEN.title) startMission(game, game.missionIndex, audio);
  }
});

canvas.addEventListener('pointerdown', () => {
  startAudio(audio);
  if (game.screen === SCREEN.title) startMission(game, game.missionIndex, audio);
});

window.addEventListener('resize', resize);
resize();

let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  const actions = { gear: wasPressed(input, 'g') };
  if (game.screen === SCREEN.flying) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepGame(game, readFlightControls(input), actions, audio, STEP);
      actions.gear = false;
      accumulator -= STEP;
      if (game.screen !== SCREEN.flying) break;
    }
  }
  endFrame(input);
  renderGame(ctx, game, width, height);
  announceScreen();
  if (!shotName) requestAnimationFrame(frame);
  else window.__shotReady = true;
}

if (shotName) {
  // Draw the staged frame once, synchronously, for the screenshot.
  renderGame(ctx, game, width, height);
  announceScreen();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
