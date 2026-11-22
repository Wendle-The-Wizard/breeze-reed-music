// Breeze Reed Music - step 5: the wind strength changes the tune.
// Wendle's notes: browsers keep quiet until a touch, so ANY tap, click or key wakes the sound.
// I also try to start the sound right away; if the browser refuses, it starts on the first touch.

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const soundBtn = document.getElementById('sound');

let reeds = [];

// ---- the wind ----
function windAt(t) {
  const a = Math.sin(t * 0.35);
  const b = Math.sin(t * 0.83 + 1.7);
  const c = Math.sin(t * 1.9 + 4.2);
  let v = 0.5 + 0.32 * a + 0.2 * b + 0.08 * c;
  v = Math.min(1, Math.max(0, v));
  return v * v * (3 - 2 * v);
}
let wind = 0;
let windPos = 0;
let lastMs = 0;
const history = [];
let lastSample = 0;

// ---- the tunes: three scales, picked by how strong the wind is ----
const tunes = [
  { name: 'calm: low and dreamy', root: 57, steps: [0, 3, 5, 7, 10, 12, 15], wave: 'sine', len: 2.2 },
  { name: 'breeze: bright and open', root: 60, steps: [0, 2, 4, 7, 9, 12, 14], wave: 'sine', len: 1.6 },
  { name: 'gust: high and sparkly', root: 64, steps: [0, 2, 4, 6, 7, 9, 11], wave: 'triangle', len: 0.9 }
];
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function tuneIndex() { return wind < 0.3 ? 0 : wind < 0.65 ? 1 : 2; }
function midiName(m) { return noteNames[m % 12] + (Math.floor(m / 12) - 1); }
function midiFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// ---- sound ----
let audio = null;
let soundOn = false;
let master = null;
let drone = null;
let lastNoteTime = 0;
let lastNoteName = '-';
let recentNotes = [];

function updateButton() {
  soundBtn.className = soundOn ? 'on' : '';
  soundBtn.textContent = soundOn ? 'Sound ON \u266A (tap to mute)' : 'Sound off - tap to hear the reeds';
}

function startAudio() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = new AC();
    master = audio.createGain();
    master.gain.value = 0.5;
    master.connect(audio.destination);
    // the hum: two sines a fifth apart through a soft filter
    const filt = audio.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 500;
    const g = audio.createGain();
    g.gain.value = 0;
    const o1 = audio.createOscillator();
    const o2 = audio.createOscillator();
    o1.type = 'sine'; o2.type = 'sine';
    o1.connect(filt); o2.connect(filt);
    filt.connect(g); g.connect(master);
    o1.start(); o2.start();
    drone = { o1: o1, o2: o2, g: g, filt: filt };
  }
  if (audio.state === 'suspended') audio.resume();
  soundOn = true;
  updateButton();
}

function toggleSound() {
  if (soundOn) { soundOn = false; updateButton(); } else { startAudio(); }
}

function playNote(m, vol, tune) {
  if (!soundOn || !audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = tune.wave;
  osc.frequency.value = midiFreq(m);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.04);
  g.gain.exponentialRampToValueAtTime(0.001, now + tune.len);
  osc.connect(g);
  g.connect(master);
  osc.start(now);
  osc.stop(now + tune.len + 0.1);
}

// the hum follows the wind: louder, brighter and a little higher in a gust
function updateDrone() {
  if (!drone || !audio) return;
  const now = audio.currentTime;
  const tune = tunes[tuneIndex()];
  const base = midiFreq(tune.root - 24);
  drone.o1.frequency.setTargetAtTime(base, now, 0.5);
  drone.o2.frequency.setTargetAtTime(base * 1.5, now, 0.5);
  drone.filt.frequency.setTargetAtTime(250 + wind * 900, now, 0.3);
  drone.g.gain.setTargetAtTime(soundOn ? 0.03 + wind * 0.09 : 0, now, 0.3);
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeReeds() {
  const rand = seededRandom(42);
  const w = canvas.width;
  const h = canvas.height;
  const count = Math.max(20, Math.floor(w / 14));
  reeds = [];
  for (let i = 0; i < count; i++) {
    const depth = rand();
    reeds.push({
      x: (i + rand()) / count * w,
      baseY: h * (0.82 + depth * 0.2),
      height: h * (0.25 + rand() * 0.3) * (0.6 + depth * 0.5),
      width: 2 + depth * 3,
      lean: (rand() - 0.5) * 0.06,
      phase: rand() * 6.28,
      stiff: 0.8 + rand() * 0.4,
      depth: depth,
      lastBend: 0,
      glow: 0,
      pos: 0
    });
  }
  // low notes on the left, high notes on the right
  const byX = reeds.slice().sort(function (a, b) { return a.x - b.x; });
  byX.forEach(function (r, i) { r.pos = i / (byX.length - 1); });
  reeds.sort(function (a, b) { return a.depth - b.depth; });
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#14243a');
  g.addColorStop(0.6, '#e9b97a');
  g.addColorStop(1, '#f4d9a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawWindStreaks() {
  const w = canvas.width, h = canvas.height;
  const u = Math.max(1, w / 400);
  ctx.lineCap = 'round';
  ctx.lineWidth = u;
  for (let i = 0; i < 14; i++) {
    const y = h * (0.12 + (i * 0.37 % 1) * 0.6);
    const len = (20 + wind * 90) * u;
    const x = ((i * 211 + windPos * (0.6 + (i % 3) * 0.3)) % (w + len * 2)) - len;
    ctx.strokeStyle = 'rgba(255,250,230,' + (0.08 + wind * 0.4) + ')';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
}

// calm: gently swaying. gust: leaning far to the right.
function bendOf(r, t) {
  const travel = Math.sin(t * 1.6 - r.x * 0.004 + r.phase * 0.3);
  const flutter = Math.sin(t * 3.1 + r.phase);
  const push = wind * 0.38;
  const sway = (0.07 + wind * 0.16) * travel + wind * 0.03 * flutter;
  return (push + sway) * r.stiff + r.lean;
}

// A reed plucks a note when its bend crosses a line moving rightwards.
// Which note it plays depends on the current tune (so on the wind).
function checkNote(r, bend, t) {
  const line = 0.17 - wind * 0.06;
  const gap = 0.22 - wind * 0.13;
  if (r.lastBend < line && bend >= line && t - lastNoteTime > gap) {
    lastNoteTime = t;
    r.glow = 1;
    const tune = tunes[tuneIndex()];
    const k = Math.min(tune.steps.length - 1, Math.floor(r.pos * tune.steps.length));
    const m = tune.root + tune.steps[k];
    const name = midiName(m);
    lastNoteName = name;
    playNote(m, 0.05 + wind * 0.05, tune);
    recentNotes.push({ x: r.x, y: r.baseY - r.height, born: t, name: name });
    if (recentNotes.length > 12) recentNotes.shift();
  }
  r.lastBend = bend;
}

function drawReed(r, t) {
  const bend = bendOf(r, t);
  checkNote(r, bend, t);
  r.glow *= 0.96;
  const tipX = r.x + bend * r.height;
  const tipY = r.baseY - r.height * (1 - Math.abs(bend) * 0.25);
  const cx = r.x + bend * r.height * 0.15;
  const cy = r.baseY - r.height * 0.6;
  const light = 22 + r.depth * 22 + r.glow * 30;
  ctx.strokeStyle = 'hsl(95, 40%, ' + light + '%)';
  ctx.lineWidth = r.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r.x, r.baseY);
  ctx.quadraticCurveTo(cx, cy, tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = 'hsl(30, 45%, ' + (25 + r.depth * 15 + r.glow * 35) + '%)';
  ctx.beginPath();
  ctx.ellipse(tipX, tipY + r.height * 0.04, r.width * 0.9, r.height * 0.07, bend * 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawNotes(t) {
  const u = Math.max(1, canvas.width / 400);
  ctx.font = (10 * u) + 'px sans-serif';
  for (let i = 0; i < recentNotes.length; i++) {
    const n = recentNotes[i];
    const age = t - n.born;
    if (age > 1.5) continue;
    const a = 1 - age / 1.5;
    ctx.strokeStyle = 'rgba(255,245,210,' + a * 0.8 + ')';
    ctx.lineWidth = u;
    ctx.beginPath();
    ctx.arc(n.x, n.y - age * 30 * u, 4 * u + age * 6 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
    ctx.fillText(n.name, n.x + 8 * u, n.y - age * 30 * u);
  }
}

function drawMeter() {
  const u = Math.max(1, canvas.width / 400);
  const x = 16 * u, y = 16 * u, w = 120 * u, h = 8 * u;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 6 * u, y - 6 * u, w + 12 * u, 118 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,240,200,0.95)';
  ctx.fillRect(x, y, w * wind, h);

  const gy = y + h + 8 * u, gh = 30 * u;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, gy, w, gh);
  ctx.strokeStyle = 'rgba(255,240,200,0.9)';
  ctx.lineWidth = Math.max(1, u * 0.8);
  ctx.beginPath();
  for (let i = 0; i < history.length; i++) {
    const px = x + w * i / 119;
    const py = gy + gh * (1 - history[i]);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,240,200,0.95)';
  ctx.font = (10 * u) + 'px sans-serif';
  ctx.fillText('wind over time', x + 3 * u, gy + 10 * u);
  ctx.font = (11 * u) + 'px sans-serif';
  ctx.fillText('wind: ' + Math.round(wind * 100) + '%', x, gy + gh + 14 * u);
  ctx.fillText('last note: ' + lastNoteName + (soundOn ? '' : ' (muted)'), x, gy + gh + 30 * u);
  ctx.font = (10 * u) + 'px sans-serif';
  ctx.fillText('tune - ' + tunes[tuneIndex()].name, x, gy + gh + 46 * u);
}

// a big hint while the page is still silent
function drawHint() {
  if (soundOn) return;
  const u = Math.max(1, canvas.width / 400);
  ctx.font = 'bold ' + (16 * u) + 'px sans-serif';
  ctx.textAlign = 'center';
  const text = 'Tap anywhere to hear the reeds sing';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(canvas.width / 2 - tw / 2 - 12 * u, canvas.height * 0.4 - 22 * u, tw + 24 * u, 34 * u);
  ctx.fillStyle = '#fff5d2';
  ctx.fillText(text, canvas.width / 2, canvas.height * 0.4);
  ctx.textAlign = 'left';
}

function draw(t) {
  drawBackground();
  drawWindStreaks();
  for (let i = 0; i < reeds.length; i++) drawReed(reeds[i], t);
  drawNotes(t);
  drawMeter();
  drawHint();
}

function frame(ms) {
  const t = ms / 1000;
  const dt = Math.min(0.1, (ms - lastMs) / 1000);
  lastMs = ms;
  wind = windAt(t + 8);
  windPos += wind * dt * 400 * Math.max(1, canvas.width / 800);
  if (t - lastSample > 0.25 || history.length === 0) {
    lastSample = t;
    history.push(wind);
    if (history.length > 120) history.shift();
  }
  updateDrone();
  draw(t);
  requestAnimationFrame(frame);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  makeReeds();
}

soundBtn.addEventListener('click', toggleSound);

// Any first touch, click or key wakes the sound (the button itself toggles it).
let woke = false;
function wake(e) {
  if (woke) return;
  if (e && e.target === soundBtn) { woke = true; return; }
  woke = true;
  if (!soundOn) startAudio();
}
window.addEventListener('pointerdown', wake);
window.addEventListener('touchstart', wake, { passive: true });
window.addEventListener('mousedown', wake);
window.addEventListener('keydown', wake);

// Try to start right away. If the browser says no, the context stays suspended
// and the first touch resumes it.
try { startAudio(); } catch (err) { /* wait for a touch */ }
// if the browser kept it suspended, show the hint again as 'off' until a touch
if (audio && audio.state === 'suspended') {
  soundOn = false;
  updateButton();
}

window.addEventListener('resize', resize);
resize();
updateButton();
requestAnimationFrame(frame);
