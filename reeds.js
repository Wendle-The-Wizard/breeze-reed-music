// Breeze Reed Music - step 1: just drawing the reeds.
// Wendle's plan: later each reed will get a sway and a note.

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');

let reeds = [];

// Simple seeded random so the field looks the same every resize
function makeRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Create the reeds, spread along the bottom of the screen
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
      lean: (rand() - 0.5) * 0.1, // tiny natural lean
      depth: depth
    });
  }
  // far reeds first so close ones paint over them
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
  // darker green for far reeds, brighter for near ones
  const light = 22 + r.depth * 22;
  ctx.strokeStyle = 'hsl(95, 40%, ' + light + '%)';
  ctx.lineWidth = r.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r.x, r.baseY);
  // a gentle curve to the tip
  ctx.quadraticCurveTo(r.x, r.baseY - r.height * 0.6, tipX, tipY);
  ctx.stroke();

  // the fluffy brown top of the reed
  ctx.fillStyle = 'hsl(30, 45%, ' + (25 + r.depth * 15) + '%)';
  ctx.beginPath();
  ctx.ellipse(tipX, tipY + r.height * 0.04, r.width * 0.9, r.height * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  drawBackground();
  reeds.forEach(drawReed);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  makeReeds();
  draw();
}

window.addEventListener('resize', resize);
resize();
