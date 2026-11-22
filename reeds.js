// Breeze Reed Music - step 2: the wind rises and falls over time.
// Wendle's plan: the wind is one number (0 to 1). Next step the reeds will sway with it.

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');

let reeds = [];

// ---- the wind ----
// A blend of a few slow sine waves, so it never repeats exactly.
// Wendle note: smoothstep makes calm and gusty moments last a bit longer.
function windAt(t) {
  const a = Math.sin(t * 0.35);
  const b = Math.sin(t * 0.83 + 1.7);
  const c = Math.sin(t * 1.9 + 4.2);
  let v = 0.5 + 0.32 * a + 0.2 * b + 0.08 * c;
  v = Math.min(1, Math.max(0, v));
  return v * v * (3 - 2 * v);
}
let wind = 0;
// A slowly smoothed copy of the wind, used for the history line
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

function drawReed(r) {
  const tipX = r.x + r.lean * r.height;
  const tipY = r.baseY - r.height;
  const light = 22 + r.depth * 22;
  ctx.strokeStyle = 'hsl(95, 40%, ' + light + '%)';
  ctx.lineWidth = r.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r.x, r.baseY);
  ctx.quadraticCurveTo(r.x, r.baseY - r.height * 0.6, tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = 'hsl(30, 45%, ' + (25 + r.depth * 15) + '%)';
  ctx.beginPath();
  ctx.ellipse(tipX, tipY + r.height * 0.04, r.width * 0.9, r.height * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Wind meter plus a little trail of past wind, so the rise and fall is easy to see
// (reeds don't move yet - that's step 3!)
function drawMeter() {
  const u = Math.max(1, canvas.width / 400);
  const x = 16 * u, y = 16 * u, w = 120 * u, h = 8 * u;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,240,200,0.9)';
  ctx.fillRect(x, y, w * wind, h);

  // history graph
  const gy = y + h + 8 * u, gh = 30 * u;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
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

  ctx.font = (11 * u) + 'px sans-serif';
  ctx.fillStyle = 'rgba(255,240,200,0.9)';
  ctx.fillText(wind < 0.2 ? 'wind: calm' : wind < 0.6 ? 'wind: breeze' : 'wind: gust', x, gy + gh + 14 * u);
}

function draw() {
  drawBackground();
  reeds.forEach(drawReed);
  drawMeter();
}

function frame(ms) {
  const t = ms / 1000;
  wind = windAt(t);
  // keep one sample every 0.25s, last 120 samples
  if (t - lastSample > 0.25) {
    lastSample = t;
    history.push(wind);
    if (history.length > 120) history.shift();
  }
  draw();
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
