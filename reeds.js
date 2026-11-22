// Breeze Reed Music - step 3: each reed sways with the breeze.
// Wendle's plan: the wind is one number (0 to 1). Now it bends every reed.

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');

let reeds = [];

// ---- the wind ----
// A blend of a few slow sine waves, so it never repeats exactly.
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

// Simple seeded random so the field looks the same every resize
function makeRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeReeds() {
  const rand = makeRandom(42);
  const w = canvas.width;
  const h = canvas.height;
  const count = Math.max(20, Math.floor(w / 14));
  reeds = [];
  for (let i = 0; i < count; i++) {
    const depth = rand(); // 0 = far away, 1 = close
    reeds.push({
      x: (i + rand()) / count * w,
      baseY: h * (0.82 + depth * 0.2),
      height: h * (0.25 + rand() * 0.3) * (0.6 + depth * 0.5),
      width: 2 + depth * 3,
      lean: (rand() - 0.5) * 0.1,
      phase: rand() * 6.28,
      stiff: 0.8 + rand() * 0.4,
      depth: depth
    });
  }
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

// How far a reed's tip is pushed sideways (in fractions of its height).
// A steady push grows with the wind, a wave travels across the field
// (so gusts roll along), and a small flutter keeps each reed its own.
function bendOf(r, t) {
  const travel = Math.sin(t * 1.6 - r.x * 0.004 + r.phase * 0.3);
  const flutter = Math.sin(t * 3.1 + r.phase);
  const push = 0.08 + wind * 0.5;
  const sway = (0.05 + wind * 0.3) * travel + wind * 0.05 * flutter;
  return (push + sway) * r.stiff + r.lean;
}

function drawReed(r, t) {
  const bend = bendOf(r, t);
  const tipX = r.x + bend * r.height;
  const tipY = r.baseY - r.height * (1 - Math.abs(bend) * 0.25);
  // control point stays low and upright so the reed curves like a bow
  const cx = r.x + bend * r.height * 0.15;
  const cy = r.baseY - r.height * 0.6;
  const light = 22 + r.depth * 22;
  ctx.strokeStyle = 'hsl(95, 40%, ' + light + '%)';
  ctx.lineWidth = r.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r.x, r.baseY);
  ctx.quadraticCurveTo(cx, cy, tipX, tipY);
  ctx.stroke();

  // the fluffy head follows the tip, tilted along the bend
  ctx.fillStyle = 'hsl(30, 45%, ' + (25 + r.depth * 15) + '%)';
  ctx.beginPath();
  ctx.ellipse(tipX, tipY + r.height * 0.04, r.width * 0.9, r.height * 0.07, bend * 1.2, 0, Math.PI * 2);
  ctx.fill();
}

// Wind meter plus a trail of past wind
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
  ctx.fillText(wind < 0.2 ? 'wind: calm' : wind < 0.6 ? 'wind: breeze' : 'wind: gust', x, gy + gh + 14 * u);
}

function draw(t) {
  drawBackground();
  for (let i = 0; i < reeds.length; i++) drawReed(reeds[i], t);
  drawMeter();
}

function frame(ms) {
  const t = ms / 1000;
  wind = windAt(t + 8); // start a little way in so the first look is already breezy
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

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
