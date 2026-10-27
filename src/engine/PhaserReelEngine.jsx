import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SYMBOLS, THEME_ASSETS, GUARDIANS } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';

// Native internal resolution (exact 5:3 aspect ratio matching 1315x789 PSD reel_net)
const GAME_W = 850;
const GAME_H = 510;
const COLS = 5;
const ROWS = 3;
const COL_W = GAME_W / COLS; // 170
const ROW_H = GAME_H / ROWS; // 170
const STRIP_SIZE = 7;

/**
 * Removes solid black (#000000) outer backgrounds from AI-generated neon JPGs
 * ONCE at startup via edge BFS flood-fill.
 */
function createNeonKeyedCanvas(img, threshold = 28, feather = 44) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const pushIfBg = (x, y) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    const p = idx * 4;
    const maxC = Math.max(data[p], data[p + 1], data[p + 2]);
    if (maxC <= threshold + feather) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(0, y);
    pushIfBg(w - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    const p = curr * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);

    if (maxC <= threshold) {
      data[p + 3] = 0;
    } else {
      const alpha = Math.min(255, Math.round(((maxC - threshold) / feather) * 255));
      data[p + 3] = alpha;
      if (alpha > 0 && alpha < 255) {
        const boost = 255 / Math.max(alpha, 48);
        data[p] = Math.min(255, Math.round(r * boost));
        data[p + 1] = Math.min(255, Math.round(g * boost));
        data[p + 2] = Math.min(255, Math.round(b * boost));
      }
    }

    const cx = curr % w;
    const cy = (curr / w) | 0;
    if (cx > 0) pushIfBg(cx - 1, cy);
    if (cx + 1 < w) pushIfBg(cx + 1, cy);
    if (cy > 0) pushIfBg(cx, cy - 1);
    if (cy + 1 < h) pushIfBg(cx, cy + 1);
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Draws a glossy 3D cabochon gemstone at (cx, cy) with gold bezel setting.
 */
function drawCabochonGem(ctx, cx, cy, rx, ry, primaryColor, highlightColor) {
  ctx.save();
  ctx.translate(cx, cy);

  // Gold bezel rim
  ctx.beginPath();
  ctx.ellipse(0, 0, rx + 3, ry + 3, 0, 0, Math.PI * 2);
  const goldGrad = ctx.createLinearGradient(-rx, -ry, rx, ry);
  goldGrad.addColorStop(0, '#fff3b0');
  goldGrad.addColorStop(0.5, '#d97706');
  goldGrad.addColorStop(1, '#78350f');
  ctx.fillStyle = goldGrad;
  ctx.fill();

  // Translucent cabochon gem body
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  const gemGrad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, rx * 0.1, 0, 0, Math.max(rx, ry));
  gemGrad.addColorStop(0, highlightColor);
  gemGrad.addColorStop(0.55, primaryColor);
  gemGrad.addColorStop(1, '#090214');
  ctx.fillStyle = gemGrad;
  ctx.fill();

  // Specular glass highlight
  ctx.beginPath();
  ctx.ellipse(-rx * 0.28, -ry * 0.32, rx * 0.42, ry * 0.25, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fill();

  ctx.restore();
}

/**
 * Synthesizes a 3D Pop-Out Royal Symbol (A, K, Q, J) matching the exact art style of
 * the reference folder (`high_scarab.png`, `high_eye.png`, `high_ankh.png`, `high_necklace.png`):
 *  1. Recessed rounded-square tile frame with a thin brushed 24k gold rim and a rich
 *     velvet jewel-toned inner cushion (`74%` of cell size).
 *  2. A chunky, multi-layer 3D extruded gold & cabochon-gemstone letter tilted at a dynamic
 *     angle that physically bursts OUT past the edges of the gold tile frame (`112%` of cell size)
 *     and casts a deep drop shadow onto the tile below!
 */
function create3DPopOutRoyalSprites(sym, size) {
  // 1. Create the recessed velvet & brushed-gold tile frame canvas
  const frameCan = document.createElement('canvas');
  frameCan.width = size;
  frameCan.height = size;
  const fCtx = frameCan.getContext('2d');

  const tileSize = Math.round(size * 0.72);
  const tileX = Math.round((size - tileSize) / 2);
  const tileY = Math.round((size - tileSize) / 2);
  const radius = Math.round(tileSize * 0.18);

  // Outer drop shadow of the tile itself
  fCtx.save();
  fCtx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  fCtx.shadowBlur = 10;
  fCtx.shadowOffsetY = 5;

  // Brushed 24k Gold Bezel Rim
  const rimGrad = fCtx.createLinearGradient(tileX, tileY, tileX + tileSize, tileY + tileSize);
  rimGrad.addColorStop(0, '#fef08a');
  rimGrad.addColorStop(0.3, '#f59e0b');
  rimGrad.addColorStop(0.7, '#b45309');
  rimGrad.addColorStop(1, '#fde047');

  fCtx.fillStyle = rimGrad;
  fCtx.beginPath();
  fCtx.roundRect(tileX, tileY, tileSize, tileSize, radius);
  fCtx.fill();
  fCtx.restore();

  // Inner dark gold bevel groove
  const pad = 6;
  fCtx.strokeStyle = '#451a03';
  fCtx.lineWidth = 2;
  fCtx.beginPath();
  fCtx.roundRect(tileX + pad, tileY + pad, tileSize - pad * 2, tileSize - pad * 2, radius - 3);
  fCtx.stroke();

  // Rich Velvet Jewel-Toned Cushion Interior
  const cushionGrad = fCtx.createRadialGradient(
    size * 0.45,
    size * 0.42,
    tileSize * 0.08,
    size * 0.5,
    size * 0.5,
    tileSize * 0.65
  );
  cushionGrad.addColorStop(0, sym.tileBgStart);
  cushionGrad.addColorStop(1, sym.tileBgEnd);

  fCtx.fillStyle = cushionGrad;
  fCtx.beginPath();
  fCtx.roundRect(tileX + pad, tileY + pad, tileSize - pad * 2, tileSize - pad * 2, radius - 3);
  fCtx.fill();

  // Subtle inner vignette shadow inside the tile frame
  fCtx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  fCtx.lineWidth = 4;
  fCtx.beginPath();
  fCtx.roundRect(
    tileX + pad + 2,
    tileY + pad + 2,
    tileSize - (pad + 2) * 2,
    tileSize - (pad + 2) * 2,
    radius - 4
  );
  fCtx.stroke();

  // 2. Create the 3D Pop-Out Tilted Gold & Gemstone Letter Artifact Canvas
  const artCan = document.createElement('canvas');
  artCan.width = size;
  artCan.height = size;
  const aCtx = artCan.getContext('2d');

  const cx = size / 2;
  const cy = size / 2 + 6;
  const tiltRad = ((sym.tiltDeg || -6) * Math.PI) / 180;

  aCtx.save();
  aCtx.translate(cx, cy);
  aCtx.rotate(tiltRad);

  const fontStr = "900 132px 'Cinzel Decorative', 'Amarante', 'Cinzel', serif";
  aCtx.font = fontStr;
  aCtx.textAlign = 'center';
  aCtx.textBaseline = 'middle';

  // Cast deep 3D shadow onto the tile underneath so the letter floats above the frame!
  aCtx.save();
  aCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  aCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  aCtx.shadowBlur = 12;
  aCtx.shadowOffsetX = 6;
  aCtx.shadowOffsetY = 12;
  aCtx.fillText(sym.letter, 4, 10);
  aCtx.restore();

  // 3D Solid Gold Extrusion Stack (12 layers from deep bronze to warm gold)
  for (let depth = 11; depth >= 1; depth--) {
    const ratio = depth / 11;
    aCtx.fillStyle = ratio > 0.5 ? '#5c2404' : '#92400e';
    aCtx.strokeStyle = '#451a03';
    aCtx.lineWidth = 6;
    aCtx.lineJoin = 'round';
    aCtx.strokeText(sym.letter, depth * 0.7, depth * 1.15);
    aCtx.fillText(sym.letter, depth * 0.7, depth * 1.15);
  }

  // Outer 24k Gold Beveled Rim of the Letter
  const outerGold = aCtx.createLinearGradient(-55, -65, 55, 65);
  outerGold.addColorStop(0, '#fffbeb');
  outerGold.addColorStop(0.25, '#fde047');
  outerGold.addColorStop(0.55, '#f59e0b');
  outerGold.addColorStop(0.85, '#b45309');
  outerGold.addColorStop(1, '#fef08a');

  aCtx.lineJoin = 'round';
  aCtx.lineWidth = 13;
  aCtx.strokeStyle = outerGold;
  aCtx.strokeText(sym.letter, 0, 0);

  // Inner Recessed Jewel Channel inside the 3D Gold Letter
  const innerJewel = aCtx.createLinearGradient(-40, -60, 40, 60);
  innerJewel.addColorStop(0, sym.gemHighlight);
  innerJewel.addColorStop(0.45, sym.gemPrimary);
  innerJewel.addColorStop(1, sym.tileBgEnd);

  aCtx.fillStyle = innerJewel;
  aCtx.fillText(sym.letter, 0, 0);

  // Specular Gold Inner Pin-Stripe Highlight
  aCtx.lineWidth = 2.5;
  aCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  aCtx.strokeText(sym.letter, -1.2, -1.5);

  // Add 3D Cabochon Gemstones & Pharaonic Crown/Wings breaking out past the top/sides!
  // Top Crown / Emblem
  drawCabochonGem(aCtx, 0, -54, 14, 10, sym.gemPrimary, sym.gemHighlight);
  drawCabochonGem(aCtx, -22, -48, 7, 5, sym.gemSecondary, '#ffffff');
  drawCabochonGem(aCtx, 22, -48, 7, 5, sym.gemSecondary, '#ffffff');

  // Center / Base Cabochon Gems
  drawCabochonGem(aCtx, -24, 18, 8, 8, sym.gemPrimary, sym.gemHighlight);
  drawCabochonGem(aCtx, 24, 18, 8, 8, sym.gemPrimary, sym.gemHighlight);
  drawCabochonGem(aCtx, 0, 46, 11, 8, sym.gemSecondary, '#ffffff');

  aCtx.restore();

  // 3. Composite Normal Sprite (Frame + Pop-Out Artifact)
  const normalCan = document.createElement('canvas');
  normalCan.width = size;
  normalCan.height = size;
  const nCtx = normalCan.getContext('2d');
  nCtx.drawImage(frameCan, 0, 0);
  nCtx.drawImage(artCan, 0, 0);

  // 4. Pre-bake Glowing Win Frame & Glowing Win Pop-Out Artifact
  const winFrameCan = createBakedSprite(frameCan, size, size, '', sym.accentColor);
  const winArtCan = createBakedSprite(artCan, size, size, '', '#ffd700');

  return {
    normalCan,
    frameCan: winFrameCan,
    artCan: winArtCan,
  };
}

/**
 * Synthesizes the 3D Pop-Out Pharaoh's Royal Bonus Chest Scatter Symbol (`bonus_chest`):
 *  1. Recessed 24k Gold & Imperial Ruby-Amber Velvet Tile Frame with 4 corner cabochon gems.
 *  2. 3D Angled Golden Treasure Vault Chest + Winged Jewel Scarab Crest + 3D Extruded "BONUS"
 *     plaque that physically bursts out past the edges of the tile frame!
 */
function create3DPopOutBonusSprites(sym, size, scarabNoFrameImg) {
  const frameCan = document.createElement('canvas');
  frameCan.width = size;
  frameCan.height = size;
  const fCtx = frameCan.getContext('2d');

  const tileSize = Math.round(size * 0.74);
  const tileX = Math.round((size - tileSize) / 2);
  const tileY = Math.round((size - tileSize) / 2);
  const radius = Math.round(tileSize * 0.18);

  // Outer drop shadow of the tile
  fCtx.save();
  fCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  fCtx.shadowBlur = 11;
  fCtx.shadowOffsetY = 5;

  const rimGrad = fCtx.createLinearGradient(tileX, tileY, tileX + tileSize, tileY + tileSize);
  rimGrad.addColorStop(0, '#fffbeb');
  rimGrad.addColorStop(0.28, '#fde047');
  rimGrad.addColorStop(0.65, '#d97706');
  rimGrad.addColorStop(1, '#fef08a');

  fCtx.fillStyle = rimGrad;
  fCtx.beginPath();
  fCtx.roundRect(tileX, tileY, tileSize, tileSize, radius);
  fCtx.fill();
  fCtx.restore();

  const pad = 6;
  const cushionGrad = fCtx.createRadialGradient(
    size * 0.46,
    size * 0.42,
    tileSize * 0.06,
    size * 0.5,
    size * 0.5,
    tileSize * 0.65
  );
  cushionGrad.addColorStop(0, '#9a3412');
  cushionGrad.addColorStop(0.55, '#4c0519');
  cushionGrad.addColorStop(1, '#1c040c');

  fCtx.fillStyle = cushionGrad;
  fCtx.beginPath();
  fCtx.roundRect(tileX + pad, tileY + pad, tileSize - pad * 2, tileSize - pad * 2, radius - 3);
  fCtx.fill();

  // Corner Cabochon Gems on the Bonus Tile Frame
  const cOff = tileSize * 0.38;
  drawCabochonGem(fCtx, size / 2 - cOff, size / 2 - cOff, 6, 6, '#ef4444', '#fecdd3');
  drawCabochonGem(fCtx, size / 2 + cOff, size / 2 - cOff, 6, 6, '#00e5ff', '#bae6fd');
  drawCabochonGem(fCtx, size / 2 - cOff, size / 2 + cOff, 6, 6, '#10b981', '#a7f3d0');
  drawCabochonGem(fCtx, size / 2 + cOff, size / 2 + cOff, 6, 6, '#c084fc', '#f3e8ff');

  // 2. 3D Pop-Out Treasure Chest + Scarab Crest + 3D "BONUS" Banner
  const artCan = document.createElement('canvas');
  artCan.width = size;
  artCan.height = size;
  const aCtx = artCan.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;

  aCtx.save();
  aCtx.translate(cx, cy - 6);
  aCtx.rotate((-5 * Math.PI) / 180);

  // Deep 3D Chest Base & Vault Lid
  const chestW = size * 0.58;
  const chestH = size * 0.42;
  const chestX = -chestW / 2;
  const chestY = -chestH / 2 + 2;

  aCtx.save();
  aCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  aCtx.shadowBlur = 14;
  aCtx.shadowOffsetY = 9;

  const chestGrad = aCtx.createLinearGradient(chestX, chestY, chestX + chestW, chestY + chestH);
  chestGrad.addColorStop(0, '#fde047');
  chestGrad.addColorStop(0.4, '#d97706');
  chestGrad.addColorStop(0.8, '#78350f');
  chestGrad.addColorStop(1, '#f59e0b');

  aCtx.fillStyle = chestGrad;
  aCtx.beginPath();
  aCtx.roundRect(chestX, chestY, chestW, chestH, 14);
  aCtx.fill();
  aCtx.restore();

  // Royal Crimson & Lapis Enamel Panels on the Chest
  aCtx.fillStyle = '#7f1d1d';
  aCtx.strokeStyle = '#fef08a';
  aCtx.lineWidth = 3;
  aCtx.beginPath();
  aCtx.roundRect(chestX + 8, chestY + 8, chestW - 16, chestH - 16, 9);
  aCtx.fill();
  aCtx.stroke();

  // Draw the 3D Winged Scarab Crest bursting out of the top of the Treasure Chest!
  if (scarabNoFrameImg) {
    const sW = size * 0.78;
    const sH = size * 0.78;
    aCtx.drawImage(scarabNoFrameImg, -sW / 2, -sH / 2 - 12, sW, sH);
  }

  // Central Ruby & Emerald Jewels on the Chest Lock
  drawCabochonGem(aCtx, 0, 14, 14, 10, '#ef4444', '#fecdd3');
  drawCabochonGem(aCtx, -28, 12, 8, 6, '#00e5ff', '#e0f2fe');
  drawCabochonGem(aCtx, 28, 12, 8, 6, '#10b981', '#d1fae5');

  aCtx.restore();

  // 3D Extruded Gold "BONUS" Plaque across the bottom-front bursting past the frame!
  aCtx.save();
  aCtx.translate(cx, cy + size * 0.27);
  const pW = size * 0.76;
  const pH = 34;
  const pGrad = aCtx.createLinearGradient(-pW / 2, -pH / 2, pW / 2, pH / 2);
  pGrad.addColorStop(0, '#78350f');
  pGrad.addColorStop(0.2, '#f59e0b');
  pGrad.addColorStop(0.5, '#fef08a');
  pGrad.addColorStop(0.8, '#d97706');
  pGrad.addColorStop(1, '#78350f');

  aCtx.fillStyle = pGrad;
  aCtx.strokeStyle = '#fffbeb';
  aCtx.lineWidth = 2.5;
  aCtx.beginPath();
  aCtx.roundRect(-pW / 2, -pH / 2, pW, pH, 9);
  aCtx.fill();
  aCtx.stroke();

  // Inner dark ruby plate
  aCtx.fillStyle = '#450a0a';
  aCtx.beginPath();
  aCtx.roundRect(-pW / 2 + 4, -pH / 2 + 4, pW - 8, pH - 8, 6);
  aCtx.fill();

  const badgeText = sym.bonusBadgeText || 'BONUS';
  aCtx.font = "900 22px 'Cinzel Decorative', 'Amarante', 'Cinzel', serif";
  aCtx.textAlign = 'center';
  aCtx.textBaseline = 'middle';
  aCtx.lineWidth = 4;
  aCtx.strokeStyle = '#451a03';
  aCtx.strokeText(badgeText, 0, 1);
  aCtx.fillStyle = '#fde047';
  aCtx.fillText(badgeText, 0, 0);
  aCtx.restore();

  const normalCan = document.createElement('canvas');
  normalCan.width = size;
  normalCan.height = size;
  const nCtx = normalCan.getContext('2d');
  nCtx.drawImage(frameCan, 0, 0);
  nCtx.drawImage(artCan, 0, 0);

  const winFrameCan = createBakedSprite(frameCan, size, size, '', '#fbbf24');
  const winArtCan = createBakedSprite(artCan, size, size, '', '#00e5ff');

  return {
    normalCan,
    frameCan: winFrameCan,
    artCan: winArtCan,
  };
}

/**
 * Pre-renders a symbol onto a fixed-size offscreen canvas at startup, optionally
 * with a baked-in neon glow halo so the 60fps loop NEVER uses ctx.shadowBlur!
 */
function createBakedSprite(sourceImgOrCanvas, targetW, targetH, filterStr = '', glowColor = '') {
  const pad = glowColor ? 18 : 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetW + pad * 2);
  canvas.height = Math.round(targetH + pad * 2);
  const ctx = canvas.getContext('2d');

  if (filterStr) {
    ctx.filter = filterStr;
  }
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 14;
  }
  ctx.drawImage(sourceImgOrCanvas, pad, pad, targetW, targetH);
  return canvas;
}

/**
 * Pre-renders the 1x3 Tall Expanding Guardian Column (Left or Right Guardian from `GUARDIANS`)
 * into a single static sprite at startup so expanding columns cost only 1 drawImage call per frame!
 */
function createBakedTallColumnSprite(bgImg, charImg, fireImg, isRightGuardian, bannerText) {
  const canvas = document.createElement('canvas');
  canvas.width = COL_W;
  canvas.height = GAME_H;
  const ctx = canvas.getContext('2d');
  const cx = COL_W / 2;
  const cy = GAME_H / 2;

  if (bgImg) {
    ctx.drawImage(
      bgImg,
      cx - (COL_W * 0.95) / 2,
      cy - (GAME_H * 0.96) / 2,
      COL_W * 0.95,
      GAME_H * 0.96
    );
  }

  if (charImg) {
    const cw = isRightGuardian ? COL_W * 1.12 : COL_W * 1.24;
    const ch = isRightGuardian ? GAME_H * 0.95 : GAME_H * 1.2;
    const cyOff = isRightGuardian ? 0 : 16;
    ctx.drawImage(charImg, cx - cw / 2, cy - ch / 2 + cyOff, cw, ch);
  }

  if (fireImg) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(fireImg, cx + COL_W * 0.28 - 25, cy - GAME_H * 0.26 - 50, 50, 100);
    ctx.restore();
  }

  const bw = COL_W * 0.9;
  const bh = 28;
  const bx = cx - bw / 2;
  const by = cy + GAME_H * 0.36;
  const plaqueGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
  plaqueGrad.addColorStop(0, '#0c1938');
  plaqueGrad.addColorStop(0.5, '#1e1b4b');
  plaqueGrad.addColorStop(1, '#0c1938');
  ctx.fillStyle = plaqueGrad;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.font = "900 11.5px 'Amarante', 'Cinzel', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bannerText || '1×3 EXPANDING WILD', cx, by + bh / 2);

  return canvas;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function PhaserReelEngine({
  initialGrid,
  initialExpandedCols,
  spinTrigger,
  onColumnStop,
  onSpinComplete,
  winningLines,
  winningCells,
  activeWinLineIdx,
}) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const callbacksRef = useRef({ onColumnStop, onSpinComplete });
  const winStateRef = useRef({
    winningLines: [],
    winningCells: new Set(),
    activeWinLineIdx: 0,
  });

  useEffect(() => {
    callbacksRef.current = { onColumnStop, onSpinComplete };
  }, [onColumnStop, onSpinComplete]);

  useEffect(() => {
    winStateRef.current = {
      winningLines: winningLines || [],
      winningCells: winningCells || new Set(),
      activeWinLineIdx: activeWinLineIdx || 0,
    };
  }, [winningLines, winningCells, activeWinLineIdx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

    const nonExpandingSymbols = SYMBOLS.filter((s) => !s.isExpanding);
    const randomSymbol = () =>
      nonExpandingSymbols[Math.floor(Math.random() * nonExpandingSymbols.length)];

    const reels = Array.from({ length: COLS }, (_, c) => {
      const strip = Array.from({ length: STRIP_SIZE }, (__, idx) => {
        const visibleRow = idx - (STRIP_SIZE - ROWS);
        if (visibleRow >= 0 && initialGrid?.[c]?.[visibleRow]) {
          return initialGrid[c][visibleRow];
        }
        return randomSymbol();
      });

      const isExp = Boolean(initialExpandedCols?.[c]);

      return {
        colIndex: c,
        x: c * COL_W,
        centerX: c * COL_W + COL_W / 2,
        strip,
        scrollPx: 0,
        offsetY: 0,
        velocity: 0,
        state: 'IDLE',
        anticipation: false,
        targetSymbols: initialGrid?.[c] || [randomSymbol(), randomSymbol(), randomSymbol()],
        willExpand: isExp,
        expandedVisible: isExp,
        tallScaleX: isExp ? 1 : 0,
        tallScaleY: isExp ? 1 : 0,
        tallAlpha: isExp ? 1 : 0,
        landingQueue: null,
        tweens: [],
      };
    });

    const particles = [];
    const sprites = {};
    let isDisposed = false;

    const spawnParticles = (x, y, count = 18, colorHex = '#ffd700') => {
      const palette = [colorHex, '#ffd700', '#00e5ff', '#10b981', '#f43f5e', '#c084fc'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 90 + Math.random() * 230;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          radius: 3 + Math.random() * 4.5,
          alpha: 1,
          color: palette[i % palette.length],
          decay: 1.35 + Math.random() * 0.8,
        });
      }
    };

    const buildStaticBackdrop = (netImg) => {
      const bgCan = document.createElement('canvas');
      bgCan.width = GAME_W;
      bgCan.height = GAME_H;
      const bCtx = bgCan.getContext('2d');
      if (netImg) {
        bCtx.save();
        bCtx.globalAlpha = 0.55;
        bCtx.drawImage(netImg, 0, 0, GAME_W, GAME_H);
        bCtx.restore();
      }
      sprites.staticBg = bgCan;

      const shadeCan = document.createElement('canvas');
      shadeCan.width = GAME_W;
      shadeCan.height = GAME_H;
      const sCtx = shadeCan.getContext('2d');
      const shadeTop = sCtx.createLinearGradient(0, 0, 0, 38);
      shadeTop.addColorStop(0, 'rgba(6, 1, 15, 0.58)');
      shadeTop.addColorStop(1, 'rgba(6, 1, 15, 0)');
      sCtx.fillStyle = shadeTop;
      sCtx.fillRect(0, 0, GAME_W, 38);

      const shadeBot = sCtx.createLinearGradient(0, GAME_H - 38, 0, GAME_H);
      shadeBot.addColorStop(0, 'rgba(6, 1, 15, 0)');
      shadeBot.addColorStop(1, 'rgba(6, 1, 15, 0.58)');
      sCtx.fillStyle = shadeBot;
      sCtx.fillRect(0, GAME_H - 38, GAME_W, 38);
      sprites.staticShade = shadeCan;
    };

    buildStaticBackdrop(null);

    // Load & pre-bake all 3D Pop-Out Sprites ONCE from `THEME_ASSETS` & `GUARDIANS`
    (async () => {
      const [
        netImg,
        wildGlowImg,
        tallBgImg,
        leftHandFxImg,
        rightHandFxImg,
        rawLeftTallImg,
        rawRightTallImg,
      ] = await Promise.all([
        loadImage(THEME_ASSETS.reelNetImage),
        loadImage(THEME_ASSETS.wildGlowImage1),
        loadImage(THEME_ASSETS.tallColumnBgImage),
        GUARDIANS.left.handFxImage ? loadImage(GUARDIANS.left.handFxImage) : Promise.resolve(null),
        GUARDIANS.right.handFxImage ? loadImage(GUARDIANS.right.handFxImage) : Promise.resolve(null),
        loadImage(GUARDIANS.left.tallColumnImage),
        loadImage(GUARDIANS.right.tallColumnImage),
      ]);

      if (isDisposed) return;

      if (netImg) buildStaticBackdrop(netImg);

      const preparedLeftGuardian = rawLeftTallImg
        ? GUARDIANS.left.keyedBackground
          ? createNeonKeyedCanvas(rawLeftTallImg, 26, 44)
          : createBakedSprite(
              rawLeftTallImg,
              rawLeftTallImg.width,
              rawLeftTallImg.height,
              'saturate(1.22) brightness(1.06) contrast(1.06)'
            )
        : null;

      const preparedRightGuardian = rawRightTallImg
        ? GUARDIANS.right.keyedBackground
          ? createNeonKeyedCanvas(rawRightTallImg, 26, 44)
          : createBakedSprite(
              rawRightTallImg,
              rawRightTallImg.width,
              rawRightTallImg.height,
              'saturate(1.22) brightness(1.06) contrast(1.06)'
            )
        : null;

      sprites.tallAnubisCol = createBakedTallColumnSprite(
        tallBgImg,
        preparedLeftGuardian,
        leftHandFxImg,
        false,
        GUARDIANS.left.tallBannerText
      );
      sprites.tallBastetCol = createBakedTallColumnSprite(
        tallBgImg,
        preparedRightGuardian,
        rightHandFxImg,
        true,
        GUARDIANS.right.tallBannerText
      );

      // Render 3D Pop-Out Royal Symbols, 3D Bonus Symbol, & High-Tier Two-Layer Symbols
      const bonusCrestOverlay = await loadImage(THEME_ASSETS.bonusCrestOverlayImage);

      await Promise.all(
        SYMBOLS.map(async (sym) => {
          if (sym.is3DBonus) {
            const bonusSize = Math.round(ROW_H * 1.18);
            const customOverlay = sym.noFrameImage
              ? await loadImage(sym.noFrameImage)
              : bonusCrestOverlay;
            const { normalCan, frameCan, artCan } = create3DPopOutBonusSprites(
              sym,
              bonusSize,
              customOverlay || bonusCrestOverlay
            );
            sprites[`sym_${sym.id}`] = normalCan;
            sprites[`frame_${sym.id}`] = frameCan;
            sprites[`pop_${sym.id}`] = artCan;
            return;
          }

          if (sym.is3DRoyal) {
            const royalSize = Math.round(ROW_H * 1.16);
            const { normalCan, frameCan, artCan } = create3DPopOutRoyalSprites(sym, royalSize);
            sprites[`sym_${sym.id}`] = normalCan;
            sprites[`frame_${sym.id}`] = frameCan;
            sprites[`pop_${sym.id}`] = artCan;
            return;
          }

          const rawImg = await loadImage(sym.image);
          if (!rawImg || isDisposed) return;

          const baseSize = Math.round(ROW_H * 1.22);

          if (sym.isWild && !sym.isExpanding && wildGlowImg) {
            const comp = document.createElement('canvas');
            comp.width = baseSize;
            comp.height = baseSize;
            const cCtx = comp.getContext('2d');
            cCtx.drawImage(wildGlowImg, 0, 0, baseSize, baseSize);
            if (sym.neonFilter) cCtx.filter = sym.neonFilter;
            cCtx.drawImage(rawImg, 0, 0, baseSize, baseSize);
            sprites[`sym_${sym.id}`] = comp;
            sprites[`win_${sym.id}`] = createBakedSprite(
              comp,
              baseSize,
              baseSize,
              '',
              sym.accentColor || '#00e5ff'
            );
          } else {
            const normalSprite = createBakedSprite(
              rawImg,
              baseSize,
              baseSize,
              sym.neonFilter || '',
              ''
            );
            sprites[`sym_${sym.id}`] = normalSprite;
            sprites[`win_${sym.id}`] = createBakedSprite(
              normalSprite,
              baseSize,
              baseSize,
              '',
              sym.accentColor || '#ffd700'
            );
          }

          // Load separate Frame + No-Frame 3D Pop-Out layers for winning animations!
          if (sym.frameImage && sym.noFrameImage && sym.noFrameImage !== sym.image) {
            const [fImg, nfImg] = await Promise.all([
              loadImage(sym.frameImage),
              loadImage(sym.noFrameImage),
            ]);
            if (fImg && nfImg && !isDisposed) {
              const frameSz = Math.round(ROW_H * 0.84);
              const popSz = Math.round(ROW_H * 1.28);
              sprites[`frame_${sym.id}`] = createBakedSprite(
                fImg,
                frameSz,
                frameSz,
                sym.neonFilter || '',
                sym.accentColor || '#ffd700'
              );
              sprites[`pop_${sym.id}`] = createBakedSprite(
                nfImg,
                popSz,
                popSz,
                sym.neonFilter || '',
                '#ffd700'
              );
            }
          }
        })
      );
    })();

    // Spin Controller
    const startSpin = (targetGrid, targetExpanded) => {
      reels.forEach((reel) => {
        reel.tweens.forEach((t) => t.kill());
        reel.tweens = [];
      });

      let specialCountSoFar = 0;

      reels.forEach((reel, c) => {
        reel.targetSymbols = targetGrid[c];
        reel.willExpand = Boolean(targetExpanded[c]);
        reel.expandedVisible = false;
        reel.tallAlpha = 0;
        reel.scrollPx = 0;
        reel.offsetY = 0;
        reel.velocity = 0;
        reel.landingQueue = null;
        reel.anticipation = specialCountSoFar >= 1 && c >= 2;

        if (
          reel.willExpand ||
          targetGrid[c].some((s) => s.isWild || s.isBonus || s.isExpanding || s.isTopHigh)
        ) {
          specialCountSoFar++;
        }

        const spinDurationSec = 0.28 + c * 0.21 + (reel.anticipation ? 0.34 : 0);
        const peakVelocity = reel.anticipation ? 2750 : 2350;

        reel.state = 'WINDUP';

        const tl = gsap.timeline({ delay: c * 0.04 });
        reel.tweens.push(tl);

        tl.to(reel, {
          offsetY: -20,
          duration: 0.11,
          ease: 'power2.out',
        })
          .call(() => {
            reel.state = 'SPINNING';
            reel.offsetY = 0;
            reel.velocity = 380;
          })
          .to(reel, {
            velocity: peakVelocity,
            duration: 0.19,
            ease: 'power2.in',
          })
          .to(reel, {
            velocity: peakVelocity,
            duration: spinDurationSec,
            ease: 'none',
            onComplete: () => {
              reel.landingQueue = [
                randomSymbol(),
                randomSymbol(),
                randomSymbol(),
                randomSymbol(),
                reel.targetSymbols[0],
                reel.targetSymbols[1],
                reel.targetSymbols[2],
              ];
            },
          });
      });
    };

    const triggerReelLandingBounce = (reel) => {
      reel.state = 'LANDING';
      reel.velocity = 0;
      reel.scrollPx = 0;
      reel.offsetY = -44;

      // Guarantee 100% deterministic alignment between visible rows (strip[4..6]) and targetSymbols[0..2]
      reel.strip[4] = reel.targetSymbols[0];
      reel.strip[5] = reel.targetSymbols[1];
      reel.strip[6] = reel.targetSymbols[2];

      const hasSpecial =
        reel.willExpand ||
        reel.targetSymbols.some((s) => s.isWild || s.isBonus || s.isExpanding);

      const bounceTl = gsap.timeline();
      reel.tweens.push(bounceTl);

      bounceTl
        .to(reel, {
          offsetY: 20,
          duration: 0.095,
          ease: 'power2.in',
          onComplete: () => {
            soundEngine.playReelStop(reel.colIndex, hasSpecial);
            if (hasSpecial) {
              spawnParticles(
                reel.centerX,
                GAME_H / 2,
                16,
                reel.colIndex >= 3 ? '#c084fc' : '#00e5ff'
              );
            }
            if (callbacksRef.current.onColumnStop) {
              callbacksRef.current.onColumnStop(reel.colIndex, reel.willExpand);
            }
          },
        })
        .to(reel, {
          offsetY: 0,
          duration: 0.22,
          ease: 'back.out(2.3)',
          onComplete: () => {
            reel.state = 'IDLE';

            if (reel.willExpand) {
              reel.expandedVisible = true;
              reel.tallScaleX = 0.3;
              reel.tallScaleY = 0.1;
              reel.tallAlpha = 0;

              spawnParticles(reel.centerX, GAME_H * 0.3, 14, '#ffd700');
              spawnParticles(reel.centerX, GAME_H * 0.7, 14, '#00e5ff');

              const expTween = gsap.to(reel, {
                tallScaleX: 1,
                tallScaleY: 1,
                tallAlpha: 1,
                duration: 0.36,
                ease: 'back.out(1.8)',
              });
              reel.tweens.push(expTween);
            }

            if (reels.every((r) => r.state === 'IDLE')) {
              if (callbacksRef.current.onSpinComplete) {
                callbacksRef.current.onSpinComplete();
              }
            }
          },
        });
    };

    // Ultra-fast 60/120 FPS Render Loop
    let lastTime = performance.now();
    const tick = () => {
      if (isDisposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      ctx.clearRect(0, 0, GAME_W, GAME_H);

      if (sprites.staticBg) {
        ctx.drawImage(sprites.staticBg, 0, 0);
      }

      const {
        winningLines: wins,
        winningCells: winSet,
        activeWinLineIdx: winIdx,
      } = winStateRef.current;
      const anySpinning = reels.some((r) => r.state !== 'IDLE');
      // Independent 3D pop-out scale for winning artifacts vs their recessed tile frame!
      const framePulse = 1 + 0.03 * Math.sin(now * 0.0085);
      const popOutPulse = 1.12 + 0.09 * Math.sin(now * 0.011);
      const popLiftY = -4 - 4 * Math.sin(now * 0.011);

      reels.forEach((reel, c) => {
        if (reel.state === 'SPINNING') {
          const step = reel.velocity * dt;
          reel.scrollPx += step;

          while (reel.scrollPx >= ROW_H) {
            reel.scrollPx -= ROW_H;
            soundEngine.playReelTick(c);

            reel.strip.pop();
            if (reel.landingQueue && reel.landingQueue.length > 0) {
              const nextSym = reel.landingQueue.pop();
              reel.strip.unshift(nextSym);
              if (reel.landingQueue.length === 0) {
                reel.landingQueue = null;
                triggerReelLandingBounce(reel);
                break;
              }
            } else {
              reel.strip.unshift(randomSymbol());
            }
          }
        }

        // Anticipation spotlight
        if (reel.state === 'SPINNING' && reel.anticipation) {
          ctx.fillStyle = 'rgba(255, 215, 0, 0.14)';
          ctx.fillRect(reel.x, 0, COL_W, GAME_H);
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.strokeRect(reel.x + 2, 2, COL_W - 4, GAME_H - 4);
        }

        // Draw 1x3 Tall Guardian OR Symbol Strip
        if (reel.expandedVisible && reel.tallAlpha > 0.01) {
          const tallSprite = c >= 3 ? sprites.tallBastetCol : sprites.tallAnubisCol;
          if (tallSprite) {
            ctx.save();
            ctx.translate(reel.centerX, GAME_H / 2);
            ctx.scale(reel.tallScaleX, reel.tallScaleY);
            ctx.globalAlpha = reel.tallAlpha;
            ctx.drawImage(tallSprite, -COL_W / 2, -GAME_H / 2);
            ctx.restore();
          }
        } else {
          const speedRatio = Math.min(1, reel.velocity / 2400);
          const stretchY = 1 + speedRatio * 0.16;
          const squashX = 1 - speedRatio * 0.04;

          for (let idx = 0; idx < STRIP_SIZE; idx++) {
            const sym = reel.strip[idx];
            const visibleRow = idx - (STRIP_SIZE - ROWS);
            const centerY =
              visibleRow * ROW_H + ROW_H / 2 + reel.scrollPx + reel.offsetY;

            if (centerY < -ROW_H || centerY > GAME_H + ROW_H) continue;

            const isWinningCell =
              !anySpinning && visibleRow >= 0 && winSet.has(`${c}-${visibleRow}`);

            const frameSprite = sprites[`frame_${sym.id}`];
            const popSprite = sprites[`pop_${sym.id}`];

            // If this symbol is a winning cell and has separate 3D Frame + Pop-Out Artifact layers,
            // animate the 3D object lifting up and bursting out off its tile frame!
            if (isWinningCell && frameSprite && popSprite) {
              const fw = frameSprite.width * framePulse;
              const fh = frameSprite.height * framePulse;
              ctx.drawImage(frameSprite, reel.centerX - fw / 2, centerY - fh / 2, fw, fh);

              const pw = popSprite.width * popOutPulse;
              const ph = popSprite.height * popOutPulse;
              ctx.drawImage(
                popSprite,
                reel.centerX - pw / 2,
                centerY - ph / 2 + popLiftY,
                pw,
                ph
              );
            } else {
              const sprite = isWinningCell
                ? sprites[`win_${sym.id}`] || sprites[`sym_${sym.id}`]
                : sprites[`sym_${sym.id}`];

              if (!sprite) continue;

              const sw = sprite.width;
              const sh = sprite.height;

              if (isWinningCell) {
                const dw = sw * popOutPulse;
                const dh = sh * popOutPulse;
                ctx.drawImage(sprite, reel.centerX - dw / 2, centerY - dh / 2, dw, dh);
              } else if (speedRatio > 0.02) {
                const dw = sw * squashX;
                const dh = sh * stretchY;
                ctx.drawImage(sprite, reel.centerX - dw / 2, centerY - dh / 2, dw, dh);
              } else {
                ctx.drawImage(sprite, reel.centerX - sw / 2, centerY - sh / 2);
              }
            }
          }
        }
      });

      if (sprites.staticShade) {
        ctx.drawImage(sprites.staticShade, 0, 0);
      }

      // Draw Multi-Layered Payline & Scatter Win Lasers
      if (!anySpinning && wins && wins.length > 0) {
        const activeWin = wins[winIdx % wins.length];
        if (activeWin) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (activeWin.isScatter) {
            const sPts = activeWin.cells.map(([c, r]) => ({
              x: c * COL_W + COL_W / 2,
              y: r * ROW_H + ROW_H / 2,
            }));

            ctx.beginPath();
            sPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 14;
            ctx.globalAlpha = 0.35;
            ctx.stroke();

            ctx.beginPath();
            sPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 4.5;
            ctx.globalAlpha = 0.95;
            ctx.stroke();

            sPts.forEach((p) => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
              ctx.fillStyle = '#fbbf24';
              ctx.fill();
              ctx.lineWidth = 3.5;
              ctx.strokeStyle = '#ffffff';
              ctx.stroke();
            });
          } else if (activeWin.line) {
            const allPts = activeWin.line.rows.map((r, c) => ({
              x: c * COL_W + COL_W / 2,
              y: r * ROW_H + ROW_H / 2,
            }));
            const winPts = allPts.slice(0, activeWin.matchCount);

            // Subtle dashed path for the full 5-reel payline template
            if (activeWin.matchCount < COLS) {
              ctx.save();
              ctx.setLineDash([7, 7]);
              ctx.beginPath();
              allPts.forEach((p, idx) =>
                idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
              );
              ctx.strokeStyle = activeWin.line.color;
              ctx.lineWidth = 3;
              ctx.globalAlpha = 0.28;
              ctx.stroke();
              ctx.restore();
            }

            // Bright solid laser strictly across the actual winning combination (0 .. matchCount - 1)
            ctx.beginPath();
            winPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.strokeStyle = activeWin.line.color;
            ctx.lineWidth = 15;
            ctx.globalAlpha = 0.34;
            ctx.stroke();

            ctx.beginPath();
            winPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.strokeStyle = activeWin.line.color;
            ctx.lineWidth = 6.5;
            ctx.globalAlpha = 0.96;
            ctx.stroke();

            ctx.beginPath();
            winPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.4;
            ctx.globalAlpha = 0.96;
            ctx.stroke();

            activeWin.cells.forEach(([c, r]) => {
              const cx = c * COL_W + COL_W / 2;
              const cy = r * ROW_H + ROW_H / 2;
              ctx.beginPath();
              ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.lineWidth = 3.5;
              ctx.strokeStyle = activeWin.line.color;
              ctx.stroke();
            });
          }

          ctx.restore();
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt;
        p.alpha -= p.decay * dt;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    gsap.ticker.add(tick);
    engineRef.current = { startSpin };

    return () => {
      isDisposed = true;
      gsap.ticker.remove(tick);
      reels.forEach((r) => r.tweens.forEach((t) => t.kill()));
    };
  }, []);

  useEffect(() => {
    if (!spinTrigger || !engineRef.current) return;
    engineRef.current.startSpin(spinTrigger.targetGrid, spinTrigger.targetExpanded);
  }, [spinTrigger]);

  return (
    <div className="phaser-reel-canvas-host" style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={GAME_W}
        height={GAME_H}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
