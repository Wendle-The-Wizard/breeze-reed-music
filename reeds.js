// Breeze Reed Music - step 4: a gentle note when a reed bends.
// Wendle's notes: last time the sway was too shy to see, so now calm = upright, gust = leaning far.

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
let windPos = 0; // how far the wind streaks have travelled
let lastMs = 0;
const history = [];
let lastSample = 0;

// ---- sound ----
let audio = null;
let soundOn = false;
let master = null;
let lastNoteTime = 0;
let lastNoteName = '-';
let recentNotes = [];
const scale = [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37, 659.25];
const names = ['A3', 'B3', 'C#4', 'E4', 'F#4', 'A4', 'B4', 'C#5', 'E5'];

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
  }
  if (audio.state === 'suspended') audio.resume();
  soundOn = true;
  updateButton();
}

function toggleSound() {
  if (soundOn) { soundOn = false; updateButton(); } else { startAudio(); }
}

function playNote(freq, vol) {
  if (!soundOn || !audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
  osc.connect(g);
  g.connect(master);
  osc.start(now);
  osc.stop(now + 1.7);
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
      glow: 0
    });
  }
  reeds.sort(function (a, b) { return a.depth - b.depth; });
  // low notes on the left, high notes on the right
  const byX = reeds.slice().sort(function (a, b) { return a.x - b.x; });
  byX.forEach(function (r, i) {
    const k = Math.floor(i / byX.length * scale.length);
    r.note = scale[k];
    r.noteName = names[k];
  });
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#14243a');
  g.addColorStop(0.6, '#e9b97a');
  g.addColorStop(1, '#f4d9a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// pale streaks blowing to the right: faster and longer when the wind is stronger
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

// calm: nearly upright. gust: leaning far to the right.
function bendOf(r, t) {
  const travel = Math.sin(t * 1.6 - r.x * 0.004 + r.phase * 0.3);
  const flutter = Math.sin(t * 3.1 + r.phase);
  const push = wind * 0.38;
  const sway = (0.05 + wind * 0.16) * travel + wind * 0.03 * flutter;
  return (push + sway) * r.stiff + r.lean;
}

// A reed plucks a note when its bend crosses a line moving rightwards.
function checkNote(r, bend, t) {
  const line = 0.17 - wind * 0.06;
  if (r.lastBend < line && bend >= line && t - lastNoteTime > 0.12) {
    lastNoteTime = t;
    r.glow = 1;
    lastNoteName = r.noteName;
    playNote(r.note, 0.05 + wind * 0.06);
    recentNotes.push({ x: r.x, y: r.baseY - r.height, born: t, name: r.noteName });
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

// rising rings with the note name where a reed was plucked
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
  ctx.fillRect(x - 6 * u, y - 6 * u, w + 12 * u, 100 * u);
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
  ctx.fillText((wind < 0.2 ? 'wind: calm' : wind < 0.6 ? 'wind: breeze' : 'wind: gust') + ' (' + Math.round(wind * 100) + '%)', x, gy + gh + 14 * u);
  ctx.fillText('last note: ' + lastNoteName + (soundOn ? '' : ' (muted)'), x, gy + gh + 30 * u);
}

function draw(t) {
  drawBackground();
  drawWindStreaks();
  for (let i = 0; i < reeds.length; i++) drawReed(reeds[i], t);
  drawNotes(t);
  drawMeter();
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
// tapping the field the very first time also wakes the sound
canvas.addEventListener('pointerdown', function () {
  if (!audio) startAudio();
});

window.addEventListener('resize', resize);
resize();
updateButton();
requestAnimationFrame(frame);
