// Keyboard and mouse input. The pilot flies with arrows (or WASD for
// pitch/roll is not used — arrows steer, W/S work the throttle), G for the
// gear, P to pause, M to mute, R to restart. The mouse steers too: where the
// pointer sits relative to the centre banks and pitches the plane, and the
// wheel works the throttle.
export function makeInput() {
  return {
    keys: new Set(),
    mouseX: 0, // -1..1 across the screen
    mouseY: 0, // -1..1 down the screen
    mouseActive: false,
    wheelDelta: 0,
    pressed: new Set(), // keys pressed since last read, for one-shot actions
  };
}

export function attachInput(input, canvas, onKey) {
  const keyName = (event) => event.key.toLowerCase();
  window.addEventListener('keydown', (event) => {
    const key = keyName(event);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      input.pressed.add(key);
      if (onKey) onKey(key);
    }
    input.keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(keyName(event));
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseActive = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    input.mouseActive = true;
  });
  canvas.addEventListener('pointerleave', () => {
    input.mouseActive = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    input.wheelDelta += event.deltaY;
  }, { passive: false });
  canvas.addEventListener('pointerdown', () => {
    input.mouseActive = true;
  });
}

export function wasPressed(input, key) {
  if (input.pressed.has(key)) {
    input.pressed.delete(key);
    return true;
  }
  return false;
}

export function endFrame(input) {
  input.pressed.clear();
  input.wheelDelta = 0;
}

// Read the flight controls for this frame: bank -1..1, pitch -1..1,
// throttle -1..1 (a nudge, applied over time). Keyboard wins over mouse
// when the pilot is holding a key; the mouse steers only when moved.
export function readFlightControls(input) {
  const keys = input.keys;
  let bank = 0;
  let pitch = 0;
  if (keys.has('arrowleft') || keys.has('a')) bank -= 1;
  if (keys.has('arrowright') || keys.has('d')) bank += 1;
  if (keys.has('arrowup')) pitch += 1;
  if (keys.has('arrowdown')) pitch -= 1;

  if (bank === 0 && pitch === 0 && input.mouseActive) {
    const dead = 0.12;
    const mx = Math.abs(input.mouseX) > dead ? input.mouseX : 0;
    const my = Math.abs(input.mouseY) > dead ? input.mouseY : 0;
    bank = Math.max(-1, Math.min(1, mx * 1.4));
    pitch = Math.max(-1, Math.min(1, -my * 1.4));
  }

  let throttle = 0;
  if (keys.has('w')) throttle += 1;
  if (keys.has('s')) throttle -= 1;
  if (input.wheelDelta !== 0) throttle += input.wheelDelta < 0 ? 0.5 : -0.5;

  return { bank, pitch, throttle };
}
