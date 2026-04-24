'use strict';

// Node.js 내장 모듈만 사용해서 128×128 PNG 아이콘을 생성합니다.
// 얼굴만 크게, 볼 홍조, 호박색 눈동자, 배경 soft glow
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 128, H = 128;
const canvas = new Uint8Array(W * H * 4); // RGBA

function hex(s) {
  const v = s.replace('#', '');
  return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16), 255];
}

function setPixel(x, y, rgba) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  canvas[i] = rgba[0]; canvas[i+1] = rgba[1]; canvas[i+2] = rgba[2]; canvas[i+3] = rgba[3];
}

function screenRect(x, y, w, h, rgba) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(x+dx, y+dy, rgba);
}

// ── 스프라이트 도우미 ─────────────────────────────────────────────
// 얼굴(cols 2–11, rows 0–8)을 128×128 중앙에 맞춰 배치
// PX=10 → 얼굴 너비 100px, 높이 90px
const PX = 10;
const OX = -6; // col 2 → x=14, col 11 → x=113, 가로 중앙(≈64) ✓
const OY = 15; // row 0 → y=15, row 8 → y=104, 세로 약간 위(≈60) ✓

function px(cx, cy, color) {
  if (!color) return;
  screenRect(OX + cx*PX, OY + cy*PX, PX, PX, color);
}
function row(r, c1, c2, color) {
  for (let c = c1; c <= c2; c++) px(c, r, color);
}
function rect(c1, r1, c2, r2, color) {
  for (let r = r1; r <= r2; r++) row(r, c1, c2, color);
}

// ── 색상 팔레트 ───────────────────────────────────────────────────
const OG = hex('#e8942a');
const LT = hex('#f7c97a');
const PK = hex('#ffaaaa');
const EY = hex('#d4a030'); // 호박 눈동자 (초록 대신)
const DK = hex('#0d1117');

// ── 배경: 방사형 soft glow (중앙이 살짝 더 밝은 원) ──────────────
const CX = 64, CY = 58; // glow 중심 (얼굴 중심과 대략 일치)
const BG0 = [26, 32, 48]; // #1a2030 — 바깥 배경
const BG1 = [38, 44, 72]; // #262c48 — 중앙 glow

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2);
    const t = Math.max(0, 1 - d / 58);
    setPixel(x, y, [
      Math.round(BG0[0] + (BG1[0] - BG0[0]) * t),
      Math.round(BG0[1] + (BG1[1] - BG0[1]) * t),
      Math.round(BG0[2] + (BG1[2] - BG0[2]) * t),
      255,
    ]);
  }
}

// ── 고양이 얼굴 ───────────────────────────────────────────────────

// 귀 (뾰족한 삼각형)
px(3, 0, DK); px(4, 0, DK);
px(9, 0, DK); px(10, 0, DK);
px(2, 1, DK); px(3, 1, OG); px(4, 1, PK); px(5, 1, DK);
px(8, 1, DK); px(9, 1, PK); px(10, 1, OG); px(11, 1, DK);

// 머리 윤곽 + 주황 채움
px(2, 2, DK); row(2, 3, 10, OG); px(11, 2, DK);
for (let r = 3; r <= 7; r++) { px(2, r, DK); row(r, 3, 10, OG); px(11, r, DK); }
row(8, 2, 11, DK);

// 얼굴 밝은 영역
rect(4, 5, 9, 7, LT);

// 볼 (기본 주황 → 홍조로 덮음)
px(3, 5, PK); px(3, 6, PK);   // 왼쪽 볼 홍조
px(10, 5, PK); px(10, 6, PK); // 오른쪽 볼 홍조

// 행복한 눈 (^ω^ 스타일) + 호박색 홍채 힌트
px(4, 4, EY); px(9, 4, EY);  // 홍채 (눈 아래 호박색 빛)
px(4, 3, DK); px(5, 4, DK);  // 왼쪽 ^ 아치
px(9, 3, DK); px(8, 4, DK);  // 오른쪽 ^ 아치

// 코 (분홍)
px(6, 6, PK); px(7, 6, PK);

// ── PNG 출력 ──────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len  = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t    = Buffer.from(type, 'ascii');
  const cVal = Buffer.alloc(4); cVal.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, cVal]);
}

// IHDR: 128×128, 8-bit, RGBA (color type 6)
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// IDAT: 각 스캔라인 앞에 filter 바이트 0x00, 그 후 deflate
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (W*4+1)] = 0;
  for (let x = 0; x < W; x++) {
    const pi = (y*W+x)*4;
    const ri = y*(W*4+1) + 1 + x*4;
    raw[ri]=canvas[pi]; raw[ri+1]=canvas[pi+1]; raw[ri+2]=canvas[pi+2]; raw[ri+3]=canvas[pi+3];
  }
}
const compressed = zlib.deflateSync(raw, { level: 9 });

const out = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', compressed),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, 'icon.png');
fs.writeFileSync(outPath, out);
console.log(`✓ icon.png 재생성 완료 (${out.length} bytes, 128×128 — 얼굴만, 호박눈, 볼터치)`);
