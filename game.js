console.log("FLVVT Gauntlet engine loaded");

// =========================
// CONFIG
// =========================
const API = "https://YOUR-BACKEND-URL.onrender.com"; // <-- set this
const TICK_RATE = 1000 / 60; // 60 FPS
const BASE_HAZARD_SPAWN = 1200; // ms
const PLAYER_SPEED = 4;

// =========================
// DOM
// =========================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const phaseEl = document.getElementById("phase");
const statusEl = document.getElementById("status");
const playerNameEl = document.getElementById("playerName");

const startBtn = document.getElementById("startBtn");
const endBtn = document.getElementById("endBtn");

// =========================
// STATE
// =========================
let playerId = localStorage.getItem("playerId") || null;
let playerName = localStorage.getItem("playerName") || "Unknown";

let running = false;
let score = 0;
let phase = 1;
let startTime = 0;
let lastFrameTime = 0;
let hazardTimer = 0;

let hazards = [];
let keys = {};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  r: 12
};

// =========================
// BACKEND
// =========================
async function submitRun() {
  if (!playerId) {
    console.warn("No playerId, not submitting run.");
    return;
  }

  try {
    await fetch(`${API}/game/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_id: Number(playerId),
        score,
        phase
      })
    });
    console.log("Run submitted:", { score, phase });
  } catch (err) {
    console.error("Submit failed:", err);
  }
}

// =========================
// INPUT
// =========================
document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === "Space") startRun();
  if (e.code === "Escape") endRun();
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// =========================
// GAME CONTROL
// =========================
function resetState() {
  hazards = [];
  score = 0;
  phase = 1;
  startTime = performance.now();
  lastFrameTime = startTime;
  hazardTimer = 0;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
}

function startRun() {
  if (!playerId) {
    alert("You must register first (backend side).");
    return;
  }
  if (running) return;

  running = true;
  resetState();
  statusEl.textContent = "RUNNING";
  requestAnimationFrame(loop);
}

async function endRun() {
  if (!running) return;
  running = false;
  statusEl.textContent = "ENDED";
  await submitRun();
}

startBtn.onclick = startRun;
endBtn.onclick = endRun;

// =========================
// GAME LOOP
// =========================
function loop(timestamp) {
  if (!running) return;

  const dt = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt) {
  // time & score
  const elapsed = (lastFrameTime - startTime) / 1000;
  score = Math.floor(elapsed * 10);
  phase = 1 + Math.floor(elapsed / 10);

  scoreEl.textContent = score;
  phaseEl.textContent = phase;

  // player movement
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    player.x += dx * PLAYER_SPEED;
    player.y += dy * PLAYER_SPEED;
  }

  // clamp player
  player.x = Math.max(player.r, Math.min(canvas.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(canvas.height - player.r, player.y));

  // hazard spawn rate scales with phase
  hazardTimer += dt;
  const spawnInterval = BASE_HAZARD_SPAWN / Math.max(1, phase * 0.7);

  if (hazardTimer >= spawnInterval) {
    hazardTimer = 0;
    spawnHazard();
  }

  // update hazards
  for (let h of hazards) {
    h.x += h.vx;
    h.y += h.vy;
  }

  // remove offscreen hazards
  hazards = hazards.filter(
    (h) =>
      h.x > -50 &&
      h.x < canvas.width + 50 &&
      h.y > -50 &&
      h.y < canvas.height + 50
  );

  // collision
  for (let h of hazards) {
    const dist = Math.hypot(h.x - player.x, h.y - player.y);
    if (dist < player.r + h.r) {
      // hit
      running = false;
      statusEl.textContent = "HIT";
      submitRun();
      return;
    }
  }
}

// =========================
// HAZARDS
// =========================
function spawnHazard() {
  // spawn from random edge, move inward
  const edge = Math.floor(Math.random() * 4);
  let x, y, vx, vy;

  const speed = 1.5 + phase * 0.3;

  if (edge === 0) { // top
    x = Math.random() * canvas.width;
    y = -20;
  } else if (edge === 1) { // bottom
    x = Math.random() * canvas.width;
    y = canvas.height + 20;
  } else if (edge === 2) { // left
    x = -20;
    y = Math.random() * canvas.height;
  } else { // right
    x = canvas.width + 20;
    y = Math.random() * canvas.height;
  }

  // aim roughly at player with some randomness
  const angle = Math.atan2(player.y - y, player.x - x) + (Math.random() - 0.5) * 0.6;
  vx = Math.cos(angle) * speed;
  vy = Math.sin(angle) * speed;

  hazards.push({
    x,
    y,
    vx,
    vy,
    r: 10 + Math.random() * 8
  });
}

// =========================
// RENDER
// =========================
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  const grd = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    50,
    canvas.width / 2,
    canvas.height / 2,
    400
  );
  grd.addColorStop(0, "#1a0033");
  grd.addColorStop(1, "#02020a");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = "#00ffcc";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  // hazards
  for (let h of hazards) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ff3366";
    ctx.fill();
  }
}

// =========================
// INIT
// =========================
playerNameEl.textContent = playerName;
statusEl.textContent = "IDLE";
scoreEl.textContent = "0";
phaseEl.textContent = "1";
render();
