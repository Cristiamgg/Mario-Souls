// ====== VARIÁVEIS GLOBAIS ======
const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');

// UI
const hpEl = document.getElementById('hp');
const atkEl = document.getElementById('atk');
const bestEl = document.getElementById('best');
const stBar = document.getElementById('stBar');
const muteBtn = document.getElementById('mute');
const helpBtn = document.getElementById('help');
const playBtn = document.getElementById('play');
const vibeBtn = document.getElementById('vibe');

// CORRIGIDO: overlay certo
const overlay = document.getElementById('ovlStart');
const toast = document.getElementById('toast');
bestEl.textContent = localStorage.getItem('abyss.best') || 0;

// Dimensões
let W = 0, H = 0, scale = 2;

// Player
let player = { x: 64, y: 0, w: 16, h: 16, vx: 0, vy: 0, hp: 5, atk: 1 };

// Level
let COL = 200, ROW = 15, T = 16;
let map = [];

// Game state
let paused = true;

// ====== FUNÇÕES ======
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  W = canvas.width;
  H = canvas.height;
}

function computeScale() {
  scale = Math.max(2, Math.floor(H / 160));
}

function spawnLevel() {
  map = [];
  for (let y = 0; y < ROW; y++) {
    map[y] = [];
    for (let x = 0; x < COL; x++) {
      map[y][x] = (y === ROW - 1) ? 1 : 0;
    }
  }
  player.x = 64;
  player.y = (ROW - 2) * T;
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.scale(scale, scale);

  // Camera CORRIGIDA
  const camX = Math.floor(
    Math.max(0, Math.min(player.x - W / (2 * scale), COL * T - W / scale))
  );

  // Render mapa
  ctx.fillStyle = '#333';
  for (let y = 0; y < ROW; y++) {
    for (let x = 0; x < COL; x++) {
      if (map[y][x] === 1) {
        ctx.fillRect(x * T - camX, y * T, T, T);
      }
    }
  }

  // Render player
  ctx.fillStyle = 'cyan';
  ctx.fillRect(player.x - camX, player.y, player.w, player.h);

  ctx.restore();
}

function loop() {
  if (paused) return;
  draw();
  requestAnimationFrame(loop);
}

// ====== CONTROLES ======
addEventListener('resize', resize, { passive: true });

playBtn.onclick = () => startGame();
helpBtn.onclick = () => {
  overlay.classList.remove('hidden');
  paused = true;
};

function startGame() {
  paused = false;
  overlay.classList.add('hidden');
  loop();
}

// ====== INICIALIZAÇÃO ======
function init() {
  resize();          // CORRIGIDO: garante canvas do tamanho certo no início
  computeScale();
  spawnLevel();
  draw();
}
init();
