// Procedural sound: no audio files, just the Web Audio API. A low engine
// drone whose pitch follows the throttle, wind that rises with speed, a
// chime when a ring is flown through, a thud for a crash and a little
// fanfare for a landing. Everything starts on the first user gesture.
export function makeAudio() {
  return {
    context: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

function ensureContext(audio) {
  if (audio.context) return true;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    audio.context = new Context();
    audio.master = audio.context.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.context.destination);
  } catch {
    return false;
  }
  return true;
}

export function startAudio(audio) {
  if (audio.started || !ensureContext(audio)) return;
  const ctx = audio.context;
  try {
    // Engine: two detuned saws through a low-pass filter.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineOsc2 = ctx.createOscillator();
    audio.engineOsc2.type = 'sawtooth';
    audio.engineOsc2.frequency.value = 55 * 1.5;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(engineFilter);
    audio.engineOsc2.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.engineOsc2.start();

    // Wind: looped noise through a band-pass filter.
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    audio.windSource = ctx.createBufferSource();
    audio.windSource.buffer = buffer;
    audio.windSource.loop = true;
    audio.windFilter = ctx.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 500;
    audio.windFilter.Q.value = 0.6;
    audio.windGain = ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSource.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSource.start();
    audio.started = true;
  } catch {
    audio.started = false;
  }
}

// Call every frame while flying: engine pitch follows throttle, wind
// follows speed, and both fade on the ground at idle.
export function updateAudio(audio, plane) {
  if (!audio.started || !audio.context) return;
  const t = audio.context.currentTime;
  const throttle = plane.throttle;
  const speed01 = Math.min(1, plane.speed / 92);
  const on = plane.onGround && plane.speed < 5 && throttle < 0.05 ? 0 : 1;
  audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speed01 * 22, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime((48 + throttle * 70 + speed01 * 22) * 1.5, t, 0.1);
  audio.engineGain.gain.setTargetAtTime(on * (0.03 + throttle * 0.075), t, 0.15);
  audio.windGain.gain.setTargetAtTime(speed01 * speed01 * 0.11, t, 0.2);
  audio.windFilter.frequency.setTargetAtTime(350 + speed01 * 900, t, 0.2);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master && audio.context) {
    audio.master.gain.setTargetAtTime(muted ? 0 : 0.5, audio.context.currentTime, 0.05);
  }
}

function blip(audio, frequency, startAt, duration, type, volume) {
  if (!audio.started || !audio.context) return;
  const ctx = audio.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  const t0 = ctx.currentTime + startAt;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playChime(audio) {
  blip(audio, 660, 0, 0.35, 'sine', 0.22);
  blip(audio, 880, 0.09, 0.35, 'sine', 0.22);
  blip(audio, 1320, 0.18, 0.5, 'sine', 0.16);
}

export function playThud(audio) {
  if (!audio.started || !audio.context) return;
  const ctx = audio.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + 0.55);
  blip(audio, 90, 0, 0.3, 'square', 0.12);
}

export function playFanfare(audio) {
  const notes = [523, 659, 784, 1046];
  notes.forEach((note, i) => blip(audio, note, i * 0.13, 0.4, 'triangle', 0.2));
}

export function playClick(audio) {
  blip(audio, 1200, 0, 0.07, 'square', 0.08);
}
