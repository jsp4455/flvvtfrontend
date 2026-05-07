// =========================
// CONFIG
// =========================
const API = "https://echoloop-backend.onrender.com";
// When deployed: "https://flvvt-backend.onrender.com"

// =========================
// CANVAS SETUP
// =========================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const GAME = {
  width: canvas.width,
  height: canvas.height,
  lastTime: 0,
  spawnTimer: 0
};

// =========================
// REGISTRATION UI
// =========================
const startScreen = document.getElementById("startScreen");
const regButton = document.getElementById("regButton");

let playerId = localStorage.getItem("playerId") || null;

if (!playerId) {
  startScreen.style.display = "flex";
} else {
  startScreen.style.display = "none";
}

regButton.onclick = async () => {
  const username = document.getElementById("regUsername").value.trim();
  const country = document.getElementById("regCountry").value.trim();

  if (!username) return alert("Enter a username");

  try {
    const res = await fetch(`${API}/player/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, country })
    });

    const data = await res.json();
    playerId = data.id;
    localStorage.setItem("playerId", playerId);

    startScreen.style.opacity = 0;
    setTimeout(() => startScreen.style.display = "none", 600);

  } catch (err) {
    alert("Registration failed");
  }
};

// =========================
// PLAYER
// =========================
const player = {
  x: GAME.width / 2,
  y: GAME.height / 2,
  radius: 16,
  vx: 0,
  vy: 0,
  accel: 900,
  maxSpeed: 320,
  friction: 0.88
};

// =========================
// INPUT
// =========================
const keys = { left: false, right: false, up: false, down: false };

document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft" || e.key === "a") keys.left = true;
  if (e.key === "ArrowRight" || e.key === "d") keys.right = true;
  if (e.key === "ArrowUp" || e.key === "w") keys.up = true;
  if (e.key === "ArrowDown" || e.key === "s") keys.down = true;

  if (e.key === "l" || e.key === "L") {
    leaderboardVisible = !leaderboardVisible;
    if (leaderboardVisible) fetchLeaderboard();
  }

  if (e.key === "r" || e.key === "R") {
    if (!isAlive) restartGame();
  }
});

document.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft" || e.key === "a") keys.left = false;
  if (e.key === "ArrowRight" || e.key === "d") keys.right = false;
  if (e.key === "ArrowUp" || e.key === "w") keys.up = false;
  if (e.key === "ArrowDown" || e.key === "s") keys.down = false;
});

// =========================
// GAME STATE
// =========================
let isAlive = true;
let timeSurvived = 0;
let bestTime = 0;

let phase = 1;
let phaseTimer = 0;

let shapes = [];

let leaderboard = [];
let leaderboardVisible = false;

let scoreSubmitted = false;

// =========================
// SHAPE SPAWNING
// =========================
function spawnShape() {
  const size = 20 + Math.random() * 20;

  const baseSpeed = 120 + Math.random() * 180;
  const speed = baseSpeed + (phase - 1) * 40;

  const edge = Math.floor(Math.random() * 4);
  let x, y, vx, vy;

  if (edge === 0) { x = Math.random() * GAME.width; y = -size; vx = (Math.random() - 0.5) * 80; vy = speed; }
  else if (edge === 1) { x = GAME.width + size; y = Math.random() * GAME.height; vx = -speed; vy = (Math.random() - 0.5) * 80; }
  else if (edge === 2) { x = Math.random() * GAME.width; y = GAME.height + size; vx = (Math.random() - 0.5) * 80; vy = -speed; }
  else { x = -size; y = Math.random() * GAME.height; vx = speed; vy = (Math.random() - 0.5) * 80; }

  const type = ["circle", "square", "triangle"][Math.floor(Math.random() * 3)];

  shapes.push({ x, y, vx, vy, size, type });
}

// =========================
// COLLISION
// =========================
function isColliding(player, shape) {
  const dx = player.x - shape.x;
  const dy = player.y - shape.y;
  const dist = Math.hypot(dx, dy);
  const shapeRadius = shape.size * 0.9;
  return dist < player.radius + shapeRadius;
}

// =========================
// BACKEND SCORE SUBMISSION
// =========================
async function submitScore() {
  if (!playerId) return;

  const payload = {
    playerId,
    timeSurvived: Math.floor(timeSurvived * 1000),
    phaseReached: phase
  };

  try {
    await fetch(`${API}/gauntlet/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    scoreSubmitted = true;
  } catch (err) {
    console.error("Failed to submit score:", err);
  }
}

// =========================
// LEADERBOARD
// =========================
async function fetchLeaderboard() {
  try {
    const res = await fetch(`${API}/leaderboard/global`);
    leaderboard = await res.json();
  } catch (err) {
    console.error("Leaderboard error:", err);
  }
}

// =========================
// UPDATE LOOP
// =========================
function update(dt) {
  if (isAlive) {
    timeSurvived += dt;
    phaseTimer += dt;

    if (phaseTimer >= 20) {
      phase++;
      phaseTimer = 0;
    }
  }

  // Movement
  if (keys.left) player.vx -= player.accel * dt;
  else if (keys.right) player.vx += player.accel * dt;
  else player.vx *= player.friction;

  if (keys.up) player.vy -= player.accel * dt;
  else if (keys.down) player.vy += player.accel * dt;
  else player.vy *= player.friction;

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > player.maxSpeed) {
    const scale = player.maxSpeed / speed;
    player.vx *= scale;
    player.vy *= scale;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  player.x = Math.max(player.radius, Math.min(GAME.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(GAME.height - player.radius, player.y));

  // Spawn shapes
  const spawnInterval = Math.max(0.55 - (phase - 1) * 0.08, 0.18);
  GAME.spawnTimer += dt;
  while (GAME.spawnTimer > spawnInterval) {
    spawnShape();
    GAME.spawnTimer -= spawnInterval;
  }

  // Update shapes
  for (let s of shapes) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }

  // Remove offscreen
  shapes = shapes.filter(s =>
    s.x > -200 && s.x < GAME.width + 200 &&
    s.y > -200 && s.y < GAME.height + 200
  );

  // Collision
  if (isAlive) {
    for (let s of shapes) {
      if (isColliding(player, s)) {
        isAlive = false;
        bestTime = Math.max(bestTime, timeSurvived);
        submitScore();
        leaderboardVisible = true;
        fetchLeaderboard();
        break;
      }
    }
  }
}

// =========================
// DRAW LOOP
// =========================
function drawBackground() {
  const phaseColor = Math.min(phase, 6);
  const g = ctx.createLinearGradient(0, 0, GAME.width, GAME.height);
  g.addColorStop(0, `rgba(${20 * phaseColor}, 0, ${40 * phaseColor}, 1)`);
  g.addColorStop(1, `rgba(0, 0, 0, 1)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GAME.width, GAME.height);
}

function drawPlayer() {
  const speed = Math.hypot(player.vx, player.vy);
  const glowStrength = Math.min(speed / player.maxSpeed, 1);

  const glow = ctx.createRadialGradient(
    player.x, player.y, 4,
    player.x, player.y, 60 + glowStrength * 40
  );
  glow.addColorStop(0, `rgba(0, 255, 255, ${0.7 + glowStrength * 0.3})`);
  glow.addColorStop(1, "rgba(0, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 60 + glowStrength * 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#00f5ff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawShapes() {
  for (let s of shapes) {
    const glow = ctx.createRadialGradient(
      s.x, s.y, 4,
      s.x, s.y, s.size * 2.5
    );
    glow.addColorStop(0, "rgba(255, 0, 120, 0.9)");
    glow.addColorStop(1, "rgba(255, 0, 120, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff008c";

    if (s.type === "circle") {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.type === "square") {
      ctx.fillRect(s.x - s.size, s.y - s.size, s.size * 2, s.size * 2);
    } else if (s.type === "triangle") {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.size);
      ctx.lineTo(s.x + s.size, s.y + s.size);
      ctx.lineTo(s.x - s.size, s.y + s.size);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawHUD() {
  ctx.fillStyle = "#ffffff";
  ctx.font = "18px Montserrat, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`TIME: ${timeSurvived.toFixed(2)}s`, 20, 30);
  ctx.fillText(`BEST: ${bestTime.toFixed(2)}s`, 20, 55);

  ctx.textAlign = "right";
  ctx.fillText(`PHASE ${phase}`, GAME.width - 20, 30);
}

function drawLeaderboard() {
  if (!leaderboardVisible) return;

  const panelWidth = 300;
  const panelHeight = 380;
  const x = GAME.width - panelWidth - 20;
  const y = 60;

  ctx.fillStyle = "rgba(10, 0, 30, 0.85)";
  ctx.fillRect(x, y, panelWidth, panelHeight);

  ctx.strokeStyle = "#7b2cff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, panelWidth, panelHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GLOBAL LEADERBOARD", x + panelWidth / 2, y + 30);

  ctx.font = "16px Montserrat, sans-serif";
  ctx.textAlign = "left";

  leaderboard.slice(0, 10).forEach((p, i) => {
    const entryY = y + 70 + i * 28;

    ctx.fillStyle = "#b084ff";
    ctx.fillText(`${i + 1}. ${p.username}`, x + 20, entryY);

    ctx.fillStyle = "#00f5ff";
    ctx.textAlign = "right";
    ctx.fillText(`${p.best_time}ms`, x + panelWidth - 20, entryY);
    ctx.textAlign = "left";
  });
}

function drawGameOver() {
  if (isAlive) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, GAME.width, GAME.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff4b9a";
  ctx.font = "32px Montserrat, sans-serif";
  ctx.fillText("GAME OVER", GAME.width / 2, GAME.height / 2 - 20);

  ctx.fillStyle = "#ffffff";
  ctx.font = "18px Montserrat, sans-serif";
  ctx.fillText(`Survived: ${timeSurvived.toFixed(2)}s`, GAME.width / 2, GAME.height / 2 + 10);
  ctx.fillText("Press R to restart", GAME.width / 2, GAME.height / 2 + 40);

  if (scoreSubmitted) {
    ctx.fillStyle = "#00ffcc";
    ctx.font = "20px Montserrat, sans-serif";
    ctx.fillText("Score Submitted ✓", GAME.width / 2, GAME.height / 2 + 70);
  }
}

// =========================
// RESTART
// =========================
function restartGame() {
  isAlive = true;
  timeSurvived = 0;
  shapes = [];
  player.x = GAME.width / 2;
  player.y = GAME.height / 2;
  player.vx = 0;
  player.vy = 0;
  phase = 1;
  phaseTimer = 0;
  scoreSubmitted = false;
  leaderboardVisible = false;
}

// =========================
// MAIN LOOP
// =========================
function draw() {
  drawBackground();
  drawShapes();
  drawPlayer();
  drawHUD();
  drawLeaderboard();
  drawGameOver();
}

function loop(timestamp) {
  const dt = (timestamp - GAME.lastTime) / 1000;
  GAME.lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
