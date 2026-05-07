console.log("FLVVT Game frontend loaded");

// =========================
// CONFIG
// =========================
const API = "https://YOUR-BACKEND-URL.onrender.com"; // <-- UPDATE THIS


// =========================
// DOM ELEMENTS
// =========================
const regDiv = document.getElementById("register");
const gameDiv = document.getElementById("game");
const lbDiv = document.getElementById("leaderboard");

const usernameInput = document.getElementById("username");
const registerBtn = document.getElementById("registerBtn");

const scoreEl = document.getElementById("score");
const phaseEl = document.getElementById("phase");
const statusEl = document.getElementById("status");

const submitRunBtn = document.getElementById("submitRunBtn");
const lbPre = document.getElementById("lb");


// =========================
// STATE
// =========================
let playerId = localStorage.getItem("playerId") || null;
let gameRunning = false;
let score = 0;
let phase = 1;
let gameTimer = null;


// =========================
// UI HELPERS
// =========================
function showRegistration() {
  regDiv.style.display = "block";
  gameDiv.style.display = "none";
  lbDiv.style.display = "none";
}

function showGame() {
  regDiv.style.display = "none";
  gameDiv.style.display = "block";
  lbDiv.style.display = "block";
}

function updateHUD() {
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  if (phaseEl) phaseEl.textContent = `Phase: ${phase}`;
  if (statusEl) statusEl.textContent = gameRunning ? "RUNNING" : "IDLE";
}


// =========================
// BACKEND CALLS
// =========================
async function registerPlayer(username) {
  const res = await fetch(`${API}/player/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
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
  lbPre.textContent = JSON.stringify(data, null, 2);
}


// =========================
// GAME LOOP
// =========================
function startGame() {
  if (!playerId) {
    alert("Register first");
    return;
  }

  if (gameRunning) return;

  gameRunning = true;
  score = 0;
  phase = 1;
  updateHUD();

  const startTime = Date.now();

  gameTimer = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;

    score = Math.floor(elapsed * 10);
    phase = 1 + Math.floor(elapsed / 10);

    updateHUD();
  }, 200);
}

async function endGame() {
  if (!gameRunning) return;

  gameRunning = false;
  clearInterval(gameTimer);
  gameTimer = null;

  await submitRun();
  await loadLeaderboard();
}


// =========================
// BUTTON EVENTS
// =========================
registerBtn.onclick = async () => {
  const username = usernameInput.value.trim();

  if (!username) {
    alert("Enter username");
    return;
  }

  try {
    const data = await registerPlayer(username);

    if (!data.id) {
      alert("Registration failed");
      return;
    }

    playerId = data.id;
    localStorage.setItem("playerId", playerId);

    showGame();
    await loadLeaderboard();

  } catch (err) {
    console.error("Registration error:", err);
    alert("Registration failed");
  }
};

submitRunBtn.onclick = async () => {
  await endGame();
};


// =========================
// KEYBOARD CONTROLS
// =========================
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") startGame();
  if (e.code === "Escape") endGame();
});


// =========================
// INIT
// =========================
(async function init() {
  if (playerId) {
    showGame();
    await loadLeaderboard();
  } else {
    showRegistration();
  }

  updateHUD();
})();
