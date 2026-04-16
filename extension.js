// pixel_cat — VSCode 익스텐션 진입점

const vscode = require('vscode');

/** @type {vscode.StatusBarItem} */
let statusBarItem;
/** @type {vscode.WebviewPanel | undefined} */
let catPanel;
/** 현재 고양이 상태 */
let catState = 'idle';
/** 상태 복귀 타이머 */
let stateTimer = null;

/**
 * 익스텐션 활성화
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // 이전 세션 상태 복원 (잠자던 고양이는 idle로 깨움)
  const saved = context.globalState.get('catState', 'idle');
  catState = saved === 'sleeping' ? 'idle' : saved;

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
  statusBarItem.tooltip = 'Pixel Cat — 클릭해서 열기';
  statusBarItem.command = 'pixel-cat.open';
  updateStatusBar(catState);
  statusBarItem.show();

  const cmds = [
    vscode.commands.registerCommand('pixel-cat.open',  () => openCatPanel(context)),
    vscode.commands.registerCommand('pixel-cat.food',  () => feedCat(context)),
    vscode.commands.registerCommand('pixel-cat.pet',   () => petCat(context)),
    vscode.commands.registerCommand('pixel-cat.sleep', () => sleepCat(context)),
  ];

  context.subscriptions.push(statusBarItem, ...cmds);
}

// ─── 상태 전환 헬퍼 ────────────────────────────────────────────────────────

/**
 * 상태 변경 + 저장 + 패널/상태바 동기화
 * @param {string} state
 * @param {vscode.ExtensionContext} ctx
 */
function setState(state, ctx) {
  catState = state;
  ctx.globalState.update('catState', state);
  updateStatusBar(state);
  sendStateToPanel(state);
}

/**
 * N ms 후 자동으로 다른 상태로 복귀
 * @param {string} nextState
 * @param {number} ms
 * @param {vscode.ExtensionContext} ctx
 */
function scheduleReturn(nextState, ms, ctx) {
  if (stateTimer) clearTimeout(stateTimer);
  stateTimer = setTimeout(() => setState(nextState, ctx), ms);
}

// ─── 커맨드 핸들러 ─────────────────────────────────────────────────────────

/** @param {vscode.ExtensionContext} ctx */
function feedCat(ctx) {
  if (catState === 'eating') return; // 먹는 중 중복 방지
  setState('eating', ctx);
  vscode.window.showInformationMessage('냠냠~ 고양이가 생선을 먹고 있어요 🐟');
  scheduleReturn('idle', 4000, ctx);
}

/** @param {vscode.ExtensionContext} ctx */
function petCat(ctx) {
  if (catState === 'grooming') return;
  setState('grooming', ctx);
  vscode.window.showInformationMessage('골골~ 고양이를 쓰다듬었어요 ✨');
  scheduleReturn('sitting', 4000, ctx);
}

/** @param {vscode.ExtensionContext} ctx */
function sleepCat(ctx) {
  if (catState === 'sleeping') {
    // 이미 자고 있으면 깨움
    setState('idle', ctx);
    vscode.window.showInformationMessage('고양이가 깨어났어요 👀');
    return;
  }
  if (stateTimer) clearTimeout(stateTimer); // 진행 중인 복귀 취소
  setState('sleeping', ctx);
  vscode.window.showInformationMessage('zzz... 고양이가 잠들었어요 💤');
}

// ─── 상태바 ────────────────────────────────────────────────────────────────

const STATUS_TEXT = {
  idle:     '🐱 nyaa~',
  walking:  '🐱 터벅터벅',
  sitting:  '🐱 앉아있는 중',
  grooming: '🐱✨ 그루밍 중...',
  sleeping: '🐱💤 zzz...',
  eating:   '🐱🐟 냠냠...',
};

function updateStatusBar(state) {
  if (statusBarItem) {
    statusBarItem.text = STATUS_TEXT[state] || '🐱';
  }
}

// ─── Webview 통신 ──────────────────────────────────────────────────────────

function sendStateToPanel(state) {
  if (catPanel) {
    catPanel.webview.postMessage({ type: 'setState', state });
  }
}

/** @param {vscode.ExtensionContext} context */
function openCatPanel(context) {
  if (catPanel) { catPanel.reveal(); return; }

  catPanel = vscode.window.createWebviewPanel(
    'pixelCat', 'Pixel Cat 🐱',
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  catPanel.webview.html = getCatHtml();

  // 패널이 열리면 현재 상태 전송
  catPanel.webview.onDidReceiveMessage((msg) => {
    if (msg.type === 'ready') sendStateToPanel(catState);
  });

  catPanel.onDidDispose(() => { catPanel = undefined; });
}

// ─── Webview HTML + 스프라이트 ────────────────────────────────────────────

function getCatHtml() {
  return /* html */`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1e1e1e;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: 'Courier New', monospace;
    color: #aaa;
    gap: 12px;
  }
  canvas {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  #label {
    font-size: 13px;
    letter-spacing: 2px;
    opacity: 0.5;
  }
</style>
</head>
<body>
<canvas id="c" width="160" height="160"></canvas>
<div id="label">idle</div>
<script>
const vscode = acquireVsCodeApi();
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const label  = document.getElementById('label');
const S = 10; // 1픽셀 = 10px, 16x16 그리드 → 160x160 캔버스

// ── 색상 팔레트 ──────────────────────────────────────────────────
//  0: 투명(배경)  1: 외곽선  2: 몸통(주황)  3: 줄무늬(짙은주황)
//  4: 배(크림)    5: 눈동자  6: 코(분홍)    7: 흰색(혀/Zzz)
const PAL = [
  null,
  '#2c1810',  // 1 외곽선
  '#f5a623',  // 2 몸통
  '#d4891a',  // 3 줄무늬
  '#fde9c5',  // 4 배
  '#1a1a2e',  // 5 눈
  '#e8a090',  // 6 코
  '#ffffff',  // 7 흰색
];

// ── 프레임 렌더 ──────────────────────────────────────────────────
function draw(frame) {
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, 160, 160);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = PAL[frame[y][x]];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * S, y * S, S, S);
      }
    }
  }
}

// ── 스프라이트 프레임 데이터 (16×16) ────────────────────────────

// 앉기 — 눈 뜸
const SIT0 = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0],
  [0,0,1,2,2,1,0,0,0,1,2,2,1,0,0,0],
  [0,1,2,2,2,2,1,1,1,2,2,2,2,1,0,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
  [0,1,2,5,2,2,3,2,3,2,2,5,2,1,0,0],
  [0,1,2,2,2,2,2,6,2,2,2,2,2,1,0,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
  [0,1,4,4,4,4,4,4,4,4,4,4,4,1,0,0],
  [1,2,2,4,4,4,4,4,4,4,4,4,2,2,1,0],
  [1,2,3,2,2,4,4,4,4,4,2,2,3,2,1,0],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
  [0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 앉기 — 눈 반감김 (깜빡임 중간)
const SIT1 = SIT0.map((r,y)=> y===5
  ? [0,1,2,1,2,2,3,2,3,2,2,1,2,1,0,0]
  : [...r]);

// 앉기 — 눈 완전히 감김
const SIT2 = SIT0.map((r,y)=> y===5
  ? [0,1,2,1,1,2,3,2,3,2,1,1,2,1,0,0]
  : [...r]);

// 걷기 — 왼발 올림
const WALK0 = SIT0.map((r,y)=>{
  if (y===12) return [0,1,2,2,2,2,2,2,2,2,2,2,2,1,0,0];
  if (y===13) return [0,1,1,0,0,0,0,0,0,0,0,1,2,1,0,0];
  if (y===14) return [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0];
  return [...r];
});

// 걷기 — 양발 중립
const WALK1 = SIT0.map((r,y)=>{
  if (y===12) return [0,1,2,2,2,2,2,2,2,2,2,2,2,1,0,0];
  if (y===13) return [0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0];
  if (y===14) return [0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0];
  return [...r];
});

// 걷기 — 오른발 올림
const WALK2 = SIT0.map((r,y)=>{
  if (y===12) return [0,1,2,2,2,2,2,2,2,2,2,2,2,1,0,0];
  if (y===13) return [0,1,2,1,0,0,0,0,0,0,0,0,1,1,0,0];
  if (y===14) return [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0];
  return [...r];
});

// 잠자기 — Zzz + 눈 감김 (frame A)
const SLEEP0 = SIT0.map((r,y)=>{
  if (y===0) return [0,0,0,0,0,0,0,0,7,7,7,0,0,0,0,0];   // ZZZ
  if (y===5) return [0,1,2,1,1,2,3,2,3,2,1,1,2,1,0,0];   // 눈 감김
  return [...r];
});

// 잠자기 — Zzz 한 칸 이동 (호흡 느낌)
const SLEEP1 = SIT0.map((r,y)=>{
  if (y===0) return [0,0,0,0,0,0,0,7,7,7,0,0,0,0,0,0];
  if (y===1) return [0,0,0,1,1,0,0,0,7,0,1,1,0,0,0,0];   // z 위 작게
  if (y===5) return [0,1,2,1,1,2,3,2,3,2,1,1,2,1,0,0];
  return [...r];
});

// 그루밍 — 기본 (발 내림)
const GROOM0 = SIT0.map(r=>[...r]);

// 그루밍 — 오른발 올려 귀 옆에
const GROOM1 = SIT0.map((r,y)=>{
  if (y===3) return [0,1,2,2,2,2,1,1,1,2,2,2,2,1,2,0];   // 발이 귀 옆에
  if (y===4) return [0,1,2,2,2,2,2,2,2,2,2,2,2,1,2,0];
  if (y===13)return [0,1,2,1,0,0,0,0,0,0,0,0,0,1,0,0];   // 오른발 올라감
  if (y===14)return [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0];
  return [...r];
});

// 그루밍 — 왼발 올려 귀 옆에
const GROOM2 = SIT0.map((r,y)=>{
  if (y===3) return [0,2,1,2,2,2,1,1,1,2,2,2,2,1,0,0];
  if (y===4) return [0,2,1,2,2,2,2,2,2,2,2,2,2,1,0,0];
  if (y===13)return [0,0,0,1,0,0,0,0,0,0,0,1,2,1,0,0];   // 왼발 올라감
  if (y===14)return [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0];
  return [...r];
});

// 먹기 — 혀 없음 (= SIT0)
const EAT0 = SIT0.map(r=>[...r]);

// 먹기 — 혀 내밀기
const EAT1 = SIT0.map((r,y)=>{
  if (y===7) return [0,1,2,2,2,2,7,7,7,2,2,2,2,1,0,0];   // 혀
  if (y===6) return [0,1,2,2,2,2,7,6,7,2,2,2,2,1,0,0];   // 코 + 혀 위
  return [...r];
});

// 먹기 — 머리 살짝 내려감 (아래로 먹는 모션)
const EAT2 = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0],
  [0,0,1,2,2,1,0,0,0,1,2,2,1,0,0,0],
  [0,1,2,2,2,2,1,1,1,2,2,2,2,1,0,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
  [0,1,2,5,2,2,3,2,3,2,2,5,2,1,0,0],
  [0,1,2,2,2,2,7,6,7,2,2,2,2,1,0,0],
  [0,1,2,2,2,2,7,7,7,2,2,2,2,1,0,0],
  [0,1,4,4,4,4,4,4,4,4,4,4,4,1,0,0],
  [1,2,2,4,4,4,4,4,4,4,4,4,2,2,1,0],
  [1,2,3,2,2,4,4,4,4,4,2,2,3,2,1,0],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
  [0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0],
];

// ── 애니메이션 테이블 ────────────────────────────────────────────
// frames: 재생할 프레임 배열, ms: 프레임당 밀리초
const ANIM = {
  idle:     { frames: [SIT0,SIT0,SIT0,SIT0,SIT0,SIT0,SIT1,SIT2,SIT1], ms: 150 },
  walking:  { frames: [WALK0,WALK1,WALK2,WALK1], ms: 120 },
  sitting:  { frames: [SIT0,SIT0,SIT0,SIT0,SIT0,SIT0,SIT1,SIT2,SIT1], ms: 150 },
  grooming: { frames: [GROOM0,GROOM1,GROOM1,GROOM2,GROOM2,GROOM0], ms: 180 },
  sleeping: { frames: [SLEEP0,SLEEP0,SLEEP0,SLEEP0,SLEEP1,SLEEP1], ms: 300 },
  eating:   { frames: [EAT0,EAT1,EAT2,EAT1], ms: 130 },
};

// ── 애니메이션 루프 ──────────────────────────────────────────────
let curState = 'idle';
let frameIdx = 0;
let lastTick = 0;

function loop(ts) {
  const anim = ANIM[curState] || ANIM.idle;
  if (ts - lastTick >= anim.ms) {
    draw(anim.frames[frameIdx % anim.frames.length]);
    frameIdx++;
    lastTick = ts;
  }
  requestAnimationFrame(loop);
}

// ── VSCode → Webview 메시지 수신 ─────────────────────────────────
window.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg.type === 'setState') {
    curState = msg.state;
    frameIdx = 0; // 상태 바뀌면 프레임 처음부터
    label.textContent = msg.state;
  }
});

// 준비됐다고 extension에 알림 (현재 상태 받기 위해)
vscode.postMessage({ type: 'ready' });
requestAnimationFrame(loop);
</script>
</body>
</html>`;
}

function deactivate() {
  if (catPanel) catPanel.dispose();
}

module.exports = { activate, deactivate };
