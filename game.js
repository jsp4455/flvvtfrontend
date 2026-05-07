console.log("FLVVT One-Screen Engine Loaded");

// =========================
// CONFIG
// =========================
const API = "https://echoloop-backend.onrender.com"; // <-- SET THIS
const WS_URL = API.replace(/^http/, "ws");

const PLAYER_SPEED = 4;
const BASE_SPAWN = 1200;

// =========================
// DOM
// =========================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const usernameInput = document.getElementById("usernameInput");
const startBtn = document.getElementById("startBtn");

const scoreEl = document.getElementById("score");
const phaseEl = document.getElementById("phase");
const statusEl = document.getElementById("status");

const overlay = document.getElementById("overlay");
const finalScoreEl = document.getElementById("finalScore");
const finalPhaseEl = document.getElementById("finalPhase");
const leaderboardListEl = document.getElementById("leaderboardList");
const closeOverlayBtn = document.getElementById("closeOverlay");

// =========================
// STATE
// =========================
let playerId = null;
let playerName = null;

let running = false;
let score = 0;
let phase = 1;
let startTime = 0;
let lastFrame = 0;
let hazardTimer = 0;
let moodMultiplier = 1;

let hazards = [];
let keys = {};
let ws = null;

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  r: 12
};

// =========================
// BACKEND
// =========================
async function registerPlayer(name) {
  const res = await fetch(`${API}/player/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: name })
  });
  return res.json();
}

async function submitRun() {
  if (!playerId) return;

  await fetch(`${API}/game/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      player_id: Number(playerId),
      score,
      phase
    })
  });
}

async function loadLeaderboard() {
  const res = await fetch(`${API}/leaderboard`);
  const data = await res.json();

  leaderboardListEl.textContent = data
    .map((e, i) => `${i + 1}. ${e.username} — ${e.score} (phase ${e.phase})`)
    .join("\n");
}

// =========================
// INPUT
// =========================
document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === "Space") startGame();
  if (e.code === "Escape") endGame();
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// =========================
// GAME FLOW
// =========================
async function startGame() {
  if (running) return;

  const name = usernameInput.value.trim();
  if (!name) return alert("Enter a name first.");

  if (!playerId) {
    const data = await registerPlayer(name);
    playerId = data.id;
    playerName = name;
    localStorage.setItem("playerId", playerId);
    localStorage.setItem("playerName", name);
  }

  overlay.classList.add("hidden");

  running = true;
  score = 0;
  phase = 1;
  hazards = [];
  startTime = performance.now();
  lastFrame = startTime;
  hazardTimer = 0;

  player.x = canvas.width / 2;
  player.y = canvas.height / 2;

  statusEl.textContent = "RUNNING";

  requestAnimationFrame(loop);
}

async function endGame() {
  if (!running) return;

  running = false;
  statusEl.textContent = "ENDED";

  await submitRun();
  await showOverlay();
}

async function showOverlay() {
  finalScoreEl.textContent = score;
  finalPhaseEl.textContent = phase;
  await loadLeaderboard();
  overlay.classList.remove("hidden");
}

closeOverlayBtn.onclick = () => overlay.classList.add("hidden");

// =========================
// GAME LOOP
// =========================
function loop(t) {
  if (!running) return;

  const dt = t - lastFrame;
  lastFrame = t;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt) {
  const elapsed = (lastFrame - startTime) / 1000;
  score = Math.floor(elapsed * 10 * moodMultiplier);
  phase = 1 + Math.floor(elapsed / 10);

  scoreEl.textContent = score;
  phaseEl.textContent = phase;

  // movement
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.x += dx * PLAYER_SPEED;
    player.y += dy * PLAYER_SPEED;
  }

  player.x = Math.max(player.r, Math.min(canvas.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(canvas.height - player.r, player.y));

  // hazards
  hazardTimer += dt;
  const spawnRate = (BASE_SPAWN / (phase * 0.7)) / moodMultiplier;

  if (hazardTimer >= spawnRate) {
    hazardTimer = 0;
    spawnHazard();
  }

  for (let h of hazards) {
    h.x += h.vx;
    h.y += h.vy;
  }

  hazards = hazards.filter(
    (h) =>
      h.x > -50 &&
      h.x < canvas.width + 50 &&
      h.y > -50 &&
      h.y < canvas.height + 50
  );

  for (let h of hazards) {
    if (Math.hypot(h.x - player.x, h.y - player.y) < player.r + h.r) {
      endGame();
      return;
    }
  }
}

// =========================
// HAZARDS
// =========================
function spawnHazard() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) { x = Math.random() * canvas.width; y = -20; }
  else if (edge === 1) { x = Math.random() * canvas.width; y = canvas.height + 20; }
  else if (edge === 2) { x = -20; y = Math.random() * canvas.height; }
  else { x = canvas.width + 20; y = Math.random() * canvas.height; }

  const speed = (1.5 + phase * 0.3) * moodMultiplier;
  const angle = Math.atan2(player.y - y, player.x - x) + (Math.random() - 0.5) * 0.6;

  hazards.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: 10 + Math.random() * 8
  });
}

// =========================
// RENDER
// =========================
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#02020a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = "#00ffcc";
  ctx.fill();

  for (let h of hazards) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ff3366";
    ctx.fill();
  }
}

// =========================
// WEBSOCKETS (mood storms)
// =========================
function connectWS() {
  ws = new WebSocket(WS_URL);

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);

    if (data.type === "mood_storm") {
      handleMoodStorm(data.mood);
    }
  };

  ws.onclose = () => setTimeout(connectWS, 2000);
}

function handleMoodStorm(mood) {
  document.body.classList.add(`storm-${mood}`);

  if (mood === "happy") moodMultiplier = 0.8;
  else if (mood === "angry") moodMultiplier = 1.4;
  else if (mood === "dreamy") moodMultiplier = 1.2;
  else moodMultiplier = 1.0;

  setTimeout(() => {
    document.body.classList.remove(`storm-${mood}`);
    moodMultiplier = 1.0;
  }, 4000);
}

// =========================
// INIT
// =========================
connectWS();
render();
