// Breeze Reed Music - step 4: a gentle note when a reed bends.
// Wendle's plan: when a reed's bend swings past a threshold, it plucks a soft note.

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');

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
const history = [];
let lastSample = 0;

// ---- sound ----
// Browsers only allow sound after a tap, so the first tap wakes it up.
let audio = null;
let soundOn = false;
let master = null;
let lastNoteTime = 0;
let recentNotes = []; // for the little note bubbles on screen
// A pentatonic scale: every note sounds nice with every other one.
const scale = [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37, 659.25];

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
}

function toggleSound() {
  if (soundOn) { soundOn = false; } else { startAudio(); }
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
      lean: (rand() - 0.5) * 0.1,
      phase: rand() * 6.28,
      stiff: 0.8 + rand() * 0.4,
      depth: depth,
      lastBend: 0,
      glow: 0
    });
  }
  reeds.sort(function (a, b) { return a.depth - b.depth; });
  // each reed gets a note by its position left to right
  const byX = reeds.slice().sort(function (a, b) { return a.x - b.x; });
  byX.forEach(function (r, i) {
    r.note = scale[Math.floor(i / byX.length * scale.length)];
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

function bendOf(r, t) {
  const travel = Math.sin(t * 1.6 - r.x * 0.004 + r.phase * 0.3);
  const flutter = Math.sin(t * 3.1 + r.phase);
  const push = 0.04 + wind * 0.35;
  const sway = (0.08 + wind * 0.3) * travel + wind * 0.05 * flutter;
  return (push + sway) * r.stiff + r.lean;
}

// A reed "bends" when its bend crosses a line moving rightwards (a fresh push).
// Stronger wind lowers the line a bit, so gusts pluck more reeds.
function checkNote(r, bend, t) {
  const line = 0.3 - wind * 0.1;
  if (r.lastBend < line && bend >= line && t - lastNoteTime > 0.12) {
    lastNoteTime = t;
    r.glow = 1;
    playNote(r.note, 0.05 + wind * 0.06);
    recentNotes.push({ x: r.x, y: r.baseY - r.height, born: t });
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

// little rising circles where notes were plucked
function drawNotes(t) {
  const u = Math.max(1, canvas.width / 400);
  for (let i = 0; i < recentNotes.length; i++) {
    const n = recentNotes[i];
    const age = t - n.born;
    if (age > 1.5) continue;
    ctx.strokeStyle = 'rgba(255,245,210,' + (1 - age / 1.5) * 0.8 + ')';
    ctx.lineWidth = u;
    ctx.beginPath();
    ctx.arc(n.x, n.y - age * 30 * u, 4 * u + age * 6 * u, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMeter() {
  const u = Math.max(1, canvas.width / 400);
  const x = 16 * u, y = 16 * u, w = 120 * u, h = 8 * u;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,240,200,0.9)';
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

  ctx.font = (10 * u) + 'px sans-serif';
  ctx.fillStyle = 'rgba(255,240,200,0.9)';
  ctx.fillText('wind over time', x + 3 * u, gy + 10 * u);
  ctx.font = (11 * u) + 'px sans-serif';
  ctx.fillText((wind < 0.2 ? 'wind: calm' : wind < 0.6 ? 'wind: breeze' : 'wind: gust') + ' (' + Math.round(wind * 100) + '%)', x, gy + gh + 14 * u);

  // sound button / indicator
  const by = gy + gh + 24 * u, bw = 120 * u, bh = 22 * u;
  ctx.fillStyle = soundOn ? 'rgba(120,200,120,0.85)' : 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, by, bw, bh);
  ctx.fillStyle = soundOn ? '#10240f' : 'rgba(255,240,200,0.95)';
  ctx.font = (11 * u) + 'px sans-serif';
  ctx.fillText(soundOn ? 'sound on (tap to mute)' : 'tap for sound', x + 6 * u, by + 15 * u);
  buttonRect = { x: x, y: by, w: bw, h: bh };
}
let buttonRect = null;

function draw(t) {
  drawBackground();
  for (let i = 0; i < reeds.length; i++) drawReed(reeds[i], t);
  drawNotes(t);
  drawMeter();
}

function frame(ms) {
  const t = ms / 1000;
  wind = windAt(t + 8);
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

// Tap the button to toggle; tapping anywhere else also wakes the sound the first time.
canvas.addEventListener('pointerdown', function (e) {
  const dpr = window.devicePixelRatio || 1;
  const px = e.clientX * dpr, py = e.clientY * dpr;
  const b = buttonRect;
  if (b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
    toggleSound();
  } else if (!soundOn && !audio) {
    startAudio();
  }
});

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
