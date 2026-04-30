'use strict';
const vscode = require('vscode');

// ── globalState 데이터 구조 ───────────────────────────────────────
const DEFAULT_CAT_DATA = {
  catType: null,       // 'fire' | 'water' | 'grass' | null
  xp: 0,
  level: 1,
  totalMinutes: 0,
};

function loadCatData(context) {
  return Object.assign({}, DEFAULT_CAT_DATA, context.globalState.get('catData', {}));
}

function saveCatData(context, patch) {
  const current = loadCatData(context);
  const next = Object.assign({}, current, patch);
  context.globalState.update('catData', next);
  return next;
}

function calcLevel(xp) {
  if (xp >= 7000) return 5;
  if (xp >= 3500) return 4;
  if (xp >= 1500) return 3;
  if (xp >= 500)  return 2;
  return 1;
}

function grantXP(context, provider, amount, onUpdate) {
  const current = loadCatData(context);
  if (!current.catType) return;
  const newXp    = current.xp + amount;
  const newLevel = calcLevel(newXp);
  const leveled  = newLevel > current.level;
  const next     = saveCatData(context, { xp: newXp, level: newLevel });
  provider.sendData({ xp: next.xp, level: next.level });
  onUpdate?.();
  if (leveled) {
    provider.sendLevelUp(newLevel);
    vscode.window.showInformationMessage(`🎉 Nabi가 Lv.${newLevel}으로 성장했어요!`);
  }
}

class CatViewProvider {
  constructor(context) {
    this._context = context;
    this._view = null;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    const catData = loadCatData(this._context);
    webviewView.webview.html = getHTML(catData);

    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'meow') vscode.window.showInformationMessage('🐱 Nyaa~!');
      if (msg.type === 'saveCatData') { saveCatData(this._context, msg.data); this._onDataSaved?.(); }
    });
    webviewView.onDidDispose(() => { this._view = null; });
  }

  send(type) {
    this._view?.webview.postMessage({ type });
    this._context.globalState.update('catState', type);
  }

  sendData(patch) {
    this._view?.webview.postMessage({ type: 'xpUpdate', data: patch });
  }

  sendLevelUp(level) {
    this._view?.webview.postMessage({ type: 'levelUp', level });
  }
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  const provider = new CatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('pixelCat', provider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // ── 코딩 XP 감지: 파일 편집 이벤트 → 1분 단위 XP +1 ────────────────
  let codingThisMinute = false;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => { codingThisMinute = true; })
  );
  const xpTimer = setInterval(() => {
    if (!codingThisMinute) return;
    codingThisMinute = false;
    const cur = loadCatData(context);
    saveCatData(context, { totalMinutes: cur.totalMinutes + 1 });
    grantXP(context, provider, 1, updateStatusBar);
  }, 60_000);
  context.subscriptions.push({ dispose: () => clearInterval(xpTimer) });

  // ── 상태바 (왼쪽, 애니메이션) ──────────────────────────────────────
  const sb = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -999);
  sb.command = 'pixelCat.show';
  sb.tooltip  = 'Click to visit your cat!';
  sb.show();
  context.subscriptions.push(sb);

  const catFaces = ['=^･ω･^=', '=^♥♥^= ', '=^･ω･^=', '=^･ー･^='];
  const typeEmoji = { fire: '🔴', water: '🔵', grass: '🟢' };
  let sbFrames = [...catFaces];

  function updateStatusBar() {
    const d = loadCatData(context);
    const pre = d.catType ? typeEmoji[d.catType] + ' ' : '';
    const suf = d.catType ? ' Lv.' + d.level : '';
    sbFrames = catFaces.map(f => pre + f + suf);
  }
  updateStatusBar();
  provider._onDataSaved = updateStatusBar;

  let sbi = 0;
  const sbTimer = setInterval(() => {
    sb.text = sbFrames[sbi++ % sbFrames.length];
  }, 700);
  context.subscriptions.push({ dispose: () => clearInterval(sbTimer) });

  // ── 커맨드 ────────────────────────────────────────────────────────
  // pixelCat.focus는 VSCode가 WebviewView id로 자동 생성하는 내장 커맨드
  const show = () => vscode.commands.executeCommand('pixelCat.focus');
  const send = (type) => {
    show();
    setTimeout(() => provider.send(type), 150);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('pixelCat.show',  show),
    vscode.commands.registerCommand('pixelCat.food',  () => { grantXP(context, provider, 5, updateStatusBar); send('food'); }),
    vscode.commands.registerCommand('pixelCat.pet',   () => { grantXP(context, provider, 5, updateStatusBar); send('pet'); }),
    vscode.commands.registerCommand('pixelCat.sleep', () => send('sleep')),
    vscode.commands.registerCommand('pixelCat.code',  () => send('code')),
  );
}

// ─────────────────────────────────────────────────────────────────
//  WEBVIEW HTML
// ─────────────────────────────────────────────────────────────────
function getHTML(catData) {
  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:100%; height:100%; background:#0d1117; overflow:hidden; }

body {
  display:flex; flex-direction:column;
  font-family: 'Courier New', monospace;
}

#topbar {
  padding: 10px 14px;
  color: #444;
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #1e2530;
  flex-shrink: 0;
}
#catname { color: #e8942a; font-size: 13px; letter-spacing: 1px; }
#mood-label {
  color: #555;
  font-size: 11px;
  min-width: 80px;
  text-align: right;
  transition: color 0.4s;
}

#scene {
  flex: 1;
  position: relative;
  overflow: hidden;
}
canvas {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  image-rendering: pixelated;
}

#btnbar {
  padding: 8px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-top: 1px solid #1e2530;
  background: #0d1117;
  flex-shrink: 0;
}
button {
  flex: 1 1 0;
  min-width: 0;
  background: #161b22;
  color: #8b949e;
  border: 1px solid #2a3040;
  padding: 5px 4px;
  cursor: pointer;
  border-radius: 5px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  transition: all 0.15s;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
button:hover { background:#21262d; color:#e8942a; border-color:#e8942a; }
button:active { transform: scale(0.95); }
#hint { color:#333; font-size:10px; width:100%; text-align:center; margin-top:2px; }
</style>
</head>
<body>

<div id="topbar">
  <div id="catname">Nabi</div>
  <div id="mood-label">idle</div>
</div>

<div id="scene">
  <canvas id="c"></canvas>
</div>

<div id="btnbar">
  <button onclick="feed()">🐟 /food</button>
  <button onclick="goSleep()">💤 /sleep</button>
  <button onclick="startCode()">💻 /code</button>
  <span id="hint">or use Cmd+Shift+P → Pixel Cat</span>
</div>

<script>
const __INITIAL_DATA__ = ${JSON.stringify(catData)};
const vscode = acquireVsCodeApi();

// ── 영속 데이터 (extension globalState 미러) ─────────────────────
let catData = __INITIAL_DATA__;

function persistCatData(patch) {
  Object.assign(catData, patch);
  vscode.postMessage({ type: 'saveCatData', data: patch });
}

// ── 알 선택 모드 ────────────────────────────────────────────────
let eggMode   = catData.catType === null;
let eggFrame  = 0;
let hatchAnim = null; // { type, x, y, frame } | null
let catScale  = 1;

const EGGS = [
  { type: 'fire',  label: '🔴 불',  hover: false, x: 0, y: 0 },
  { type: 'water', label: '🔵 물',  hover: false, x: 0, y: 0 },
  { type: 'grass', label: '🟢 풀',  hover: false, x: 0, y: 0 },
];
function updateEggPositions() {
  EGGS[0].x = W * 0.22; EGGS[1].x = W * 0.50; EGGS[2].x = W * 0.78;
  EGGS[0].y = EGGS[1].y = EGGS[2].y = H * 0.42;
}

// ── 캔버스 세팅 ──────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const moodEl = document.getElementById('mood-label');

let W = 0, H = 0;
function resize() {
  const s = document.getElementById('scene');
  W = canvas.width  = s.clientWidth;
  H = canvas.height = s.clientHeight;
  if (eggMode) updateEggPositions();
}
resize();
window.addEventListener('resize', () => { resize(); });

// ── 픽셀아트 헬퍼 ────────────────────────────────────────────────
const PX = 4; // 1 스프라이트 픽셀 = 화면 4px

function px(cx, cy, color) {
  if (!color || color === 'none') return;
  ctx.fillStyle = color;
  ctx.fillRect(cx * PX, cy * PX, PX, PX);
}
function row(r, c1, c2, color) {
  for (let c = c1; c <= c2; c++) px(c, r, color);
}
function rect(c1, r1, c2, r2, color) {
  for (let r = r1; r <= r2; r++) row(r, c1, c2, color);
}

// ── 속성별 팔레트 ────────────────────────────────────────────────
const PALETTES = {
  fire:  { body: '#e8521a', light: '#f89870', stripe: '#b03010', eye: '#ff4400', particle: '🔥' },
  water: { body: '#4a90d9', light: '#a0c8f0', stripe: '#2860a8', eye: '#00ccff', particle: '💧' },
  grass: { body: '#5ab84a', light: '#90d080', stripe: '#3a8030', eye: '#aaff44', particle: '🍃' },
};

// ── 색상 팔레트 (drawCat 호출 전 applyPalette()로 교체됨) ────────
let OG = '#e8942a';   // 몸통 — 속성별 교체
let LT = '#f7c97a';   // 밝은 얼굴 — 속성별 교체
const PK = '#ffaaaa'; // 분홍 (귀 안, 코) — 고정
let GR = '#d4a030';   // 눈동자 — 속성별 교체
const DK = '#0d1117'; // 짙은 윤곽선 — 고정
const WH = '#f0e8d0'; // 크림 배 — 고정
let ST = '#b06820';   // 줄무늬 — 속성별 교체
const FD = '#4a9eff'; // 생선 파란색
const ZC = '#7090b0'; // Zzz 색
const HT = '#ff6a88'; // 하트 색

function applyPalette(catType) {
  const pal = PALETTES[catType];
  if (!pal) return;
  OG = pal.body;
  LT = pal.light;
  GR = pal.eye;
  ST = pal.stripe;
}

// ── 기본 몸통 ────────────────────────────────────────────────────
function drawBody() {
  rect(2, 8, 11, 13, DK);
  rect(3, 9, 10, 12, OG);
  rect(4, 9, 9, 12, WH);
  px(3, 9, ST); px(3, 10, ST); px(3, 11, ST);
  px(10, 9, ST); px(10, 10, ST); px(10, 11, ST);
  px(4, 9, ST); px(8, 9, ST);
}

// ── 기본 머리 ────────────────────────────────────────────────────
// eyeType: 'open' | 'closed' | 'happy' | 'wide'
function drawHead(eyeType = 'open') {
  // 귀 (뾰족한 삼각형)
  px(3, 0, DK); px(4, 0, DK);
  px(9, 0, DK); px(10, 0, DK);
  px(2, 1, DK); px(3, 1, OG); px(4, 1, PK); px(5, 1, DK);
  px(8, 1, DK); px(9, 1, PK); px(10, 1, OG); px(11, 1, DK);

  // 머리 윤곽 + 전체 채움 (주황)
  px(2, 2, DK); row(2, 3, 10, OG); px(11, 2, DK);
  for (let r = 3; r <= 7; r++) { px(2, r, DK); row(r, 3, 10, OG); px(11, r, DK); }
  row(8, 2, 11, DK);

  // 얼굴 밝은 영역
  rect(4, 5, 9, 7, LT);
  px(3, 5, OG); px(3, 6, OG); // 왼쪽 볼
  px(10, 5, OG); px(10, 6, OG); // 오른쪽 볼
  // 행복할 때 볼 홍조
  if (eyeType === 'happy') {
    px(3, 5, PK); px(3, 6, PK);
    px(10, 5, PK); px(10, 6, PK);
  }

  // 눈 (2×2 홍채 + 동공)
  if (eyeType === 'open') {
    px(4, 3, GR); px(5, 3, GR); px(4, 4, GR); px(5, 4, DK);
    px(8, 3, GR); px(9, 3, GR); px(8, 4, GR); px(9, 4, DK);
  } else if (eyeType === 'closed') {
    row(4, 4, 5, DK);
    row(4, 8, 9, DK);
  } else if (eyeType === 'happy') {
    px(4, 3, DK); px(5, 4, DK);
    px(9, 3, DK); px(8, 4, DK);
  } else if (eyeType === 'wide') {
    px(4, 3, GR); px(5, 3, GR); px(4, 4, GR); px(5, 4, GR);
    px(8, 3, GR); px(9, 3, GR); px(8, 4, GR); px(9, 4, GR);
  }

  // 코 (분홍 2픽셀)
  px(6, 6, PK); px(7, 6, PK);

  // 수염 (반투명 얇은 선 — facingLeft 뒤집기에서도 자동 대칭)
  ctx.fillStyle = '#cccccc44';
  ctx.fillRect(0,        5 * PX + 2, 2 * PX, 1);
  ctx.fillRect(0,        6 * PX + 2, 2 * PX, 1);
  ctx.fillRect(12 * PX,  5 * PX + 2, 3 * PX, 1);
  ctx.fillRect(12 * PX,  6 * PX + 2, 3 * PX, 1);
}

// ── 다리 ─────────────────────────────────────────────────────────
// legPhase: 0=중립, 1=걷기A, 2=걷기B
function drawLegs(legPhase = 0) {
  if (legPhase === 0) {
    px(3, 13, OG); px(4, 13, OG);
    px(3, 14, DK); px(4, 14, DK); px(5, 14, DK);
    px(8, 13, OG); px(9, 13, OG);
    px(8, 14, DK); px(9, 14, DK); px(10, 14, DK);
  } else if (legPhase === 1) {
    px(2, 13, OG); px(3, 13, OG); px(2, 14, DK); px(3, 14, DK);
    px(9, 13, OG); px(10, 13, OG); px(10, 14, OG); px(11, 14, DK);
  } else {
    px(3, 13, OG); px(4, 13, OG); px(4, 14, OG); px(5, 14, DK);
    px(8, 13, OG); px(7, 14, DK); px(8, 14, DK);
  }
}

// ── 꼬리 ─────────────────────────────────────────────────────────
// swing: 0=자연, 1=위, -1=아래
function drawTail(swing = 0) {
  if (swing === 0) {
    px(11, 9, OG); px(12, 9, OG);
    px(12, 10, OG); px(12, 11, OG);
    px(11, 12, OG); px(12, 12, DK);
  } else if (swing === 1) {
    px(11, 7, OG); px(12, 7, OG);
    px(12, 8, OG); px(13, 8, OG);
    px(12, 6, DK); px(13, 9, DK);
  } else {
    px(11, 10, OG); px(11, 11, OG);
    px(10, 11, OG); px(10, 12, OG);
    px(9, 12, DK);
  }
}

// ── 상태별 드로잉 ────────────────────────────────────────────────
function drawWalk(frame) {
  const cycle    = frame % 8;
  const legPhase = cycle < 4 ? 1 : 2;
  // 발이 바닥을 박차는 순간 몸이 살짝 위로 솟는 아치 (sin 곡선)
  const bob      = -Math.abs(Math.sin(cycle / 8 * Math.PI * 2)) * PX * 0.7;
  // 꼬리는 몸보다 반박자 늦게 반응 (follow-through)
  const tailSin  = Math.sin((frame + 4) / 8 * Math.PI * 2);
  const tailSwing = tailSin > 0.4 ? 1 : tailSin < -0.4 ? -1 : 0;

  ctx.save();
  ctx.translate(0, bob);
  drawBody();
  drawLegs(legPhase);
  drawTail(tailSwing);
  drawHead('open'); // 머리도 함께 — 분리 없이 자연스럽게
  ctx.restore();
}

function drawSit(frame) {
  const blink    = frame % 90 > 85;
  // 느리고 자연스러운 호흡 (가슴이 살짝 오르내림)
  const breathe  = Math.sin(frame / 30) * PX * 0.4;
  // 꼬리: sin 곡선으로 부드럽게 좌우 흔들기
  const tailSin  = Math.sin(frame / 22);
  const tailSwing = tailSin > 0.55 ? 1 : tailSin < -0.55 ? -1 : 0;

  ctx.save();
  ctx.translate(0, breathe);
  drawBody();
  drawLegs(0);
  drawTail(tailSwing);
  ctx.restore();
  drawHead(blink ? 'closed' : 'open');
}

function drawGroom(frame) {
  const lick = frame % 12; // 8→12프레임: 좀 더 여유있는 그루밍 리듬
  drawBody();
  drawLegs(0);
  drawTail(0);
  if (lick < 6) {
    px(11, 4, OG); px(12, 4, OG); px(12, 3, DK);
  } else {
    px(11, 2, OG); px(12, 2, OG); px(12, 1, DK);
  }
  drawHead(lick < 6 ? 'closed' : 'open');
}

function drawSleeping(frame) {
  // 잠든 고양이의 느리고 고른 호흡 (sin 곡선)
  const breathe = Math.sin(frame / 15) * 0.5 + 0.5;

  ctx.save();
  ctx.translate(0, breathe * PX);

  // 누운 몸통
  rect(2, 10, 12, 14, DK);
  rect(3, 11, 11, 13, OG);
  rect(4, 11, 9, 12, WH);
  px(3, 11, ST); px(3, 12, ST); px(10, 11, ST); px(10, 12, ST);
  px(4, 11, ST); px(8, 11, ST);
  // 꼬리 (옆으로 늘어진)
  px(12, 11, OG); px(13, 11, OG); px(13, 12, OG); px(13, 13, DK);

  // 잠든 머리 (옆으로 누움)
  rect(2, 7, 9, 10, DK);
  rect(3, 8, 8, 9, OG);
  rect(4, 8, 7, 8, LT);
  // 귀 (납작하게)
  px(2, 7, OG); px(3, 7, PK); px(4, 7, DK);
  // 감긴 눈
  row(8, 4, 5, DK);
  // 코
  px(6, 9, PK);

  ctx.restore();
}

function drawEat(frame) {
  const chew = frame % 6;
  drawBody();
  drawLegs(0);
  drawTail(1);

  // 생선
  row(12, 13, 15, FD);
  px(15, 12, FD); px(16, 12, FD);
  px(16, 13, FD); px(16, 14, FD);

  // 머리 살짝 앞으로
  ctx.save();
  ctx.translate(PX, 0);
  drawHead(chew < 3 ? 'wide' : 'closed');
  ctx.restore();
}

function drawHappy(frame) {
  const t      = (frame % 12) / 12 * Math.PI * 2;
  const sinVal = Math.sin(t);
  // 위로 솟았다가 내려오는 포물선 아크
  const jumpY  = -Math.max(0, sinVal) * 2.5 * PX;
  // 공중에 있을 때 다리 교대 (달리는 느낌)
  const legPhase  = sinVal > 0 ? 1 : 2;
  const tailSwing = frame % 6 < 3 ? 1 : 0;

  ctx.save();
  ctx.translate(0, jumpY);
  drawBody();
  drawLegs(legPhase);
  drawTail(tailSwing);
  drawHead('happy');
  ctx.restore();
}

function drawCode(frame) {
  const phase  = Math.floor(frame / 8) % 2;
  const cursor = Math.floor(frame / 15) % 2;

  const FR = '#252d3a'; // 노트북 프레임
  const SC = '#0a1628'; // 화면 (어두운 파랑)
  const CD = '#4aff70'; // 코드 줄 (초록)
  const KB = '#6a7880'; // 키보드 (실버)

  drawBody();
  // 꼬리는 데스크 뒤에 숨겨짐 — 생략

  // 맥북 화면 (열린 뚜껑)
  rect(13, 3, 18, 10, FR);
  rect(14, 4, 17, 9, SC);
  row(4, 14, 16, CD);
  row(5, 14, 15, CD);
  row(6, 14, 17, CD);
  row(7, 14, 15, CD);
  if (cursor) px(16, 7, CD);
  row(8, 14, 16, CD);

  // 맥북 키보드 베이스
  rect(11, 10, 18, 12, KB);
  row(10, 11, 18, FR);
  row(12, 11, 18, FR);
  ctx.fillStyle = '#3a4856';
  ctx.fillRect(12 * PX + 1, 11 * PX + 1, PX - 2, PX - 2);
  ctx.fillRect(14 * PX + 1, 11 * PX + 1, PX - 2, PX - 2);
  ctx.fillRect(16 * PX + 1, 11 * PX + 1, PX - 2, PX - 2);

  // 뒷발 (접힌)
  px(3, 13, OG); px(4, 13, OG);
  px(3, 14, DK); px(4, 14, DK);

  // 앞발 타이핑 (키보드 위에서 교대로 올라갔다 내려옴)
  if (phase === 0) {
    px(9, 11, OG); px(10, 11, OG); px(11, 11, OG);
    px(8, 11, DK); px(12, 11, DK);
  } else {
    px(9, 10, OG); px(10, 10, OG); px(11, 10, OG);
    px(8, 10, DK); px(12, 10, DK);
  }

  drawHead('open');
}

// ── 레벨별 외형 추가 레이어 ──────────────────────────────────────
function drawLevelExtras(state) {
  const level   = catData.level;
  const catType = catData.catType;
  if (!level || level < 2 || state === 'sleep') return;

  // Lv.2+: 몸통 중앙 수평 줄무늬
  row(11, 5, 8, ST);

  // Lv.3+: 귀 끝 털 픽셀
  if (level >= 3) {
    px(3, 0, LT); px(10, 0, LT);
  }

  // Lv.4+: 속성 악세서리
  if (level >= 4) {
    if (catType === 'fire') {
      // 불꽃 왕관
      px(5, -3, '#ff8800'); px(7, -3, '#ffd700'); px(9, -3, '#ff8800');
      px(4, -2, '#ffa000'); px(6, -2, '#ffcc00'); px(8, -2, '#ffcc00'); px(10, -2, '#ffa000');
    } else if (catType === 'water') {
      // 물방울 목걸이
      row(8, 5, 8, '#00ccff');
      px(6, 9, '#b8e0ff'); px(7, 9, '#00ccff'); px(8, 9, '#b8e0ff');
    } else if (catType === 'grass') {
      // 잎사귀 머리띠
      px(4, -1, '#3a8030'); px(5, -1, '#5ab84a');
      px(6, -1, '#90d080'); px(7, -1, '#5ab84a');
      px(8, -1, '#5ab84a'); px(9, -1, '#3a8030');
    }
  }
}

function drawCat(bx, by, state, frame, facingLeft) {
  ctx.save();
  ctx.translate(bx, by);
  if (facingLeft) {
    ctx.translate(14 * PX, 0);
    ctx.scale(-1, 1);
  }
  switch (state) {
    case 'walk':    drawWalk(frame);     break;
    case 'sit':     drawSit(frame);      break;
    case 'groom':   drawGroom(frame);    break;
    case 'sleep':   drawSleeping(frame); break;
    case 'eat':     drawEat(frame);      break;
    case 'happy':   drawHappy(frame);    break;
    case 'code':    drawCode(frame);     break;
    default:        drawSit(0);
  }
  drawLevelExtras(state);
  ctx.restore();
}

// ── 파티클 시스템 (하트, Zzz, 반짝) ─────────────────────────────
// ── 알 스프라이트 ────────────────────────────────────────────────
// cx: 가로 중앙 좌표, cy: 상단 Y 좌표, shakeX: 흔들림 오프셋(px)
function drawEgg(type, cx, cy, shakeX) {
  const palettes = {
    fire:  { base: '#e85020', shade: '#c03010', hi: '#ff9070', mark: '#801808' },
    water: { base: '#4a90d9', shade: '#2868b0', hi: '#b8e0ff', mark: '#204888' },
    grass: { base: '#5ab84a', shade: '#3a9030', hi: '#b0f090', mark: '#1a5010' },
  };
  const pal = palettes[type];
  ctx.save();
  ctx.translate(Math.round(cx - 3.5 * PX + shakeX), Math.round(cy));

  // 하단 음영
  row(4, 0, 6, pal.shade);
  row(5, 1, 5, pal.shade);
  row(6, 2, 4, pal.shade);
  px(3, 7, pal.shade);

  // 몸통
  row(0, 2, 4, pal.base);
  row(1, 1, 5, pal.base);
  for (let r = 2; r <= 4; r++) row(r, 0, 6, pal.base);

  // 상단 하이라이트
  px(3, 0, pal.hi); px(4, 0, pal.hi);
  px(2, 1, pal.hi); px(3, 1, pal.hi);

  // 속성별 무늬
  if (type === 'fire') {
    // 크랙
    px(3, 2, pal.mark); px(4, 3, pal.mark); px(3, 4, pal.mark);
    px(2, 3, pal.mark); px(1, 4, pal.mark);
  } else if (type === 'water') {
    // 물결
    row(2, 2, 4, pal.hi);
    row(4, 1, 5, pal.hi);
  } else {
    // 점무늬
    px(2, 2, pal.mark); px(4, 2, pal.mark);
    px(2, 5, pal.mark); px(4, 5, pal.mark);
  }

  ctx.restore();
}

const particles = [];

const CODE_SYMS = ['{}', '()', '<>', '//', '=>'];
function spawnParticle(type, sx, sy, sym = null) {
  const isGold = type === 'gold';
  const angle  = isGold ? Math.random() * Math.PI * 2 : 0;
  const speed  = isGold ? 1.5 + Math.random() * 2.5 : 1;
  particles.push({
    type, x: sx, y: sy,
    vx: isGold ? Math.cos(angle) * speed : (Math.random() - 0.5) * 1.2,
    vy: isGold ? Math.sin(angle) * speed : -1 - Math.random() * 1.5,
    life: 1.0,
    size: type === 'z' ? 14 : type === 'gold' ? 13 : 10,
    sym: type === 'codebit' ? CODE_SYMS[Math.floor(Math.random() * CODE_SYMS.length)] : (type === 'attr' ? sym : null),
  });
}

function tickParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy *= 0.98;
    p.life -= 0.018;
    if (p.life <= 0) { particles.splice(i, 1); continue; }

    ctx.globalAlpha = p.life * 0.9;
    ctx.font = p.size + 'px monospace';
    ctx.textBaseline = 'top';
    if      (p.type === 'z')       { ctx.fillStyle = ZC;       ctx.fillText('z',    p.x, p.y); }
    else if (p.type === 'heart')   { ctx.fillStyle = HT;       ctx.fillText('♥',    p.x, p.y); }
    else if (p.type === 'codebit') { ctx.fillStyle = '#4aff70'; ctx.fillText(p.sym,  p.x, p.y); }
    else if (p.type === 'gold')    { ctx.fillStyle = '#ffd700'; ctx.fillText('✦',    p.x, p.y); }
    else if (p.type === 'attr')    {                            ctx.fillText(p.sym,  p.x, p.y); }
    else                           { ctx.fillStyle = '#ffd060'; ctx.fillText('✦',    p.x, p.y); }
    ctx.globalAlpha = 1;
  }
}

// ── 알 선택 화면 렌더링 ──────────────────────────────────────────
function tickEggs(floorY) {
  eggFrame++;

  if (!hatchAnim) {
    ctx.fillStyle = '#666';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('알을 선택하세요', W / 2, 14);

    for (const egg of EGGS) {
      const shakeX = egg.hover ? Math.sin(eggFrame * 0.5) * 2 * PX : 0;
      drawEgg(egg.type, egg.x, egg.y, shakeX);
      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(egg.label, egg.x, egg.y + 9 * PX);
    }
    return;
  }

  const f = ++hatchAnim.frame;

  if (f < 30) {
    // 점점 빨라지는 흔들림
    const shakeX = Math.sin(f * 0.6) * (f * 0.15) * PX;
    drawEgg(hatchAnim.type, hatchAnim.x, hatchAnim.y, shakeX);
  } else if (f < 50) {
    // 최대 흔들림 + 금 파티클 발생
    const shakeX = Math.sin(f * 1.8) * 3 * PX;
    drawEgg(hatchAnim.type, hatchAnim.x, hatchAnim.y, shakeX);
    if (f % 3 === 0) {
      for (let i = 0; i < 4; i++) spawnParticle('gold', hatchAnim.x, hatchAnim.y + 4 * PX);
    }
  } else if (f < 65) {
    // 알 페이드아웃
    if (f === 50) {
      for (let i = 0; i < 20; i++) spawnParticle('gold', hatchAnim.x, hatchAnim.y + 4 * PX);
    }
    ctx.globalAlpha = 1 - (f - 50) / 15;
    drawEgg(hatchAnim.type, hatchAnim.x, hatchAnim.y, 0);
    ctx.globalAlpha = 1;
  } else if (f < 95) {
    // 고양이 줌인
    catScale = (f - 65) / 30;
    renderCatZoom(floorY);
  } else {
    catScale = 1;
    eggMode = false;
    hatchAnim = null;
    persistCatData({ catType: catData.catType });
    startState('sit');
  }
}

function renderCatZoom(floorY) {
  const spriteH = 16 * PX;
  const cy = floorY - spriteH + 4;
  catX = W / 2 - 7 * PX;
  ctx.save();
  ctx.translate(catX + 7 * PX, cy + 16 * PX);
  ctx.scale(catScale, catScale);
  ctx.translate(-7 * PX, -16 * PX);
  applyPalette(catData.catType);
  drawCat(0, 0, 'sit', 0, false);
  ctx.restore();
}

// ── 배경 (픽셀아트 방) ──────────────────────────────────────────
function drawBG() {
  // 하늘 그라데이션
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0e1a');
  grad.addColorStop(1, '#141822');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 별
  ctx.fillStyle = '#ffffff22';
  for (let i = 0; i < 40; i++) {
    const sx = (i * 137 + 17) % W;
    const sy = (i * 211 + 31) % (H * 0.6);
    const r  = i % 3 === 0 ? 1.5 : 1;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 바닥
  const floorY = H - 24;
  ctx.fillStyle = '#1a1f2e';
  ctx.fillRect(0, floorY, W, 24);
  ctx.fillStyle = '#222840';
  ctx.fillRect(0, floorY, W, 3);
  ctx.fillStyle = '#1e2436';
  for (let fx = 0; fx < W; fx += 16) {
    ctx.fillRect(fx, floorY + 6, 2, 2);
  }

  return floorY;
}

// ── 상태 머신 ────────────────────────────────────────────────────
let catX       = 60;
let catState   = 'sit';
let catFrame   = 0;
let facingLeft = false;
let stateTimer = 0;
const SPEED    = 1.2;

function setMood(text, color = '#555') {
  moodEl.textContent = text;
  moodEl.style.color  = color;
}

function pickNextIdle() {
  const r = Math.random();
  if (r < 0.35) return 'walk';
  if (r < 0.55) return 'groom';
  if (r < 0.75) return 'code';
  return 'sit';
}

function startState(s) {
  catState = s;
  catFrame = 0;
  switch (s) {
    case 'walk':  stateTimer = 120 + Math.random() * 180; setMood('walking', '#4a8a5a');      break;
    case 'sit':   stateTimer = 100 + Math.random() * 160; setMood('sitting', '#888');          break;
    case 'groom': stateTimer = 100 + Math.random() * 80;  setMood('grooming ✧', '#a080d0');   break;
    case 'sleep': stateTimer = 9999;                       setMood('sleeping 💤', '#5070a0');  break;
    case 'eat':   stateTimer = 140;                        setMood('eating 🐟', '#4a9eff');    break;
    case 'happy': stateTimer = 100;                        setMood('happy ♥', '#ff6a88');      break;
    case 'code':  stateTimer = 180; facingLeft = false;    setMood('coding 💻', '#4aff70');    break;
  }
}

function tickState(floorY) {
  stateTimer--;
  catFrame++;

  const spriteH = 16 * PX;
  const catY    = floorY - spriteH + 4;

  if (catState === 'walk') {
    catX += facingLeft ? -SPEED : SPEED;
    const margin = 20;
    if (catX < margin)                    { catX = margin;                  facingLeft = false; }
    if (catX > W - 14 * PX - margin)     { catX = W - 14 * PX - margin;   facingLeft = true; }
    if (stateTimer <= 0) startState(Math.random() < 0.4 ? 'groom' : 'sit');
  } else if (catState === 'sit') {
    if (stateTimer <= 0) startState(pickNextIdle());
  } else if (catState === 'groom') {
    if (stateTimer <= 0) startState(Math.random() < 0.6 ? 'sit' : 'walk');
  } else if (catState === 'sleep') {
    if (catFrame % 60 === 0) spawnParticle('z', catX + 12 * PX, catY);
  } else if (catState === 'eat') {
    if (catFrame % 15 === 0) {
      const sym = catData.catType && PALETTES[catData.catType] && PALETTES[catData.catType].particle;
      spawnParticle(sym ? 'attr' : 'sparkle', catX + 14 * PX, catY + 4 * PX, sym);
    }
    if (stateTimer <= 0) startState('sit');
  } else if (catState === 'happy') {
    if (catFrame % 10 === 0) {
      const sym = catData.catType && PALETTES[catData.catType] && PALETTES[catData.catType].particle;
      spawnParticle(sym ? 'attr' : 'heart', catX + 7 * PX, catY, sym);
    }
    if (stateTimer <= 0) startState('sit');
  } else if (catState === 'code') {
    if (catFrame % 20 === 0) spawnParticle('codebit', catX + 10 * PX, catY - PX);
    if (stateTimer <= 0) startState('sit');
  }

  ctx.save();
  ctx.translate(Math.round(catX), catY);
  applyPalette(catData.catType);
  if (catData.level >= 5) {
    const lv5 = { fire: '#ffd700', water: '#c0e8ff', grass: '#d4ff70' };
    if (lv5[catData.catType]) OG = lv5[catData.catType];
  }
  drawCat(0, 0, catState, catFrame, facingLeft);
  ctx.restore();

  if (catData.level >= 5 && catFrame % 10 === 0) {
    const sym = catData.catType && PALETTES[catData.catType]?.particle;
    spawnParticle(sym ? 'attr' : 'sparkle', catX + 7 * PX, catY + 4 * PX, sym);
  }
}

// ── 메인 루프 ────────────────────────────────────────────────────
let lastTime = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (ts - lastTime < 1000 / 30) return; // ~30fps
  lastTime = ts;
  const floorY = drawBG();
  if (eggMode) {
    tickEggs(floorY);
  } else {
    tickState(floorY);
  }
  tickParticles();
}

startState('sit');
catX = W / 2 - 7 * PX;
requestAnimationFrame(loop);

// ── 커맨드 수신 (extension → webview) ───────────────────────────
function feed()      { startState('eat'); }
function pet()       { startState('happy'); }
function goSleep()   { startState(catState === 'sleep' ? 'sit' : 'sleep'); }
function startCode() { startState('code'); }

window.addEventListener('message', e => {
  const { type, data } = e.data;
  if (type === 'init')     { catData = data; eggMode = catData.catType === null; updateEggPositions(); }
  if (type === 'food')     feed();
  if (type === 'pet')      pet();
  if (type === 'sleep')    goSleep();
  if (type === 'code')     startCode();
  if (type === 'xpUpdate') Object.assign(catData, data);
  if (type === 'levelUp') {
    startState('happy');
    const floorY = H - 24;
    const catY   = floorY - 16 * PX + 4;
    const sym    = catData.catType && PALETTES[catData.catType] && PALETTES[catData.catType].particle;
    for (let i = 0; i < 30; i++) {
      spawnParticle(sym ? 'attr' : 'gold', catX + 7 * PX, catY + 8 * PX, sym);
    }
  }
});

// ── 알 hover 감지 ────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  if (!eggMode || hatchAnim) return;
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  for (const egg of EGGS) {
    const hw = 4 * PX, hh = 5 * PX;
    egg.hover = mx > egg.x - hw && mx < egg.x + hw && my > egg.y - hh && my < egg.y + hh + 4 * PX;
  }
});

// ── 캔버스 클릭 ──────────────────────────────────────────────────
canvas.addEventListener('click', e => {
  const r  = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;

  if (eggMode && !hatchAnim) {
    for (const egg of EGGS) {
      const hw = 4 * PX, hh = 5 * PX;
      if (mx > egg.x - hw && mx < egg.x + hw && my > egg.y - hh && my < egg.y + hh + 4 * PX) {
        catData.catType = egg.type;
        hatchAnim = { type: egg.type, x: egg.x, y: egg.y, frame: 0 };
        catX = W / 2 - 7 * PX;
        return;
      }
    }
    return;
  }

  const floorY  = H - 24;
  const spriteH = 16 * PX;
  const catY    = floorY - spriteH + 4;
  if (mx > catX && mx < catX + 14 * PX && my > catY && my < catY + 16 * PX) {
    vscode.postMessage({ type: 'meow' });
    startState('happy');
  }
});
</script>
</body>
</html>`;
}

module.exports = { activate };
