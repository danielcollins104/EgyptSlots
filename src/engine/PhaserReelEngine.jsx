import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import gsap from 'gsap';
import { SYMBOLS, THEME_ASSETS, GUARDIANS, PAYLINES } from '../config/slotConfig';
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

  // Specular glass highlight (warm golden luster, no harsh white)
  ctx.beginPath();
  ctx.ellipse(-rx * 0.28, -ry * 0.32, rx * 0.42, ry * 0.25, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
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

  // Larger tiles with less space between each other
  const tileSize = Math.round(size * 0.85);
  const tileX = Math.round((size - tileSize) / 2);
  const tileY = Math.round((size - tileSize) / 2);
  const radius = Math.round(tileSize * 0.16);

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

  const isTen = sym.letter === '10';
  const fSize = isTen ? 100 : 132;
  const fontStr = `900 ${fSize}px 'Cinzel Decorative', 'Amarante', 'Cinzel', serif`;
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

  // Outer Crisp Obsidian Shadow / Contrast Rim (replaces blurry white stroke with sharp dark outline)
  aCtx.lineJoin = 'round';
  aCtx.lineWidth = 14;
  aCtx.strokeStyle = '#270c02';
  aCtx.strokeText(sym.letter, 0, 0);

  // Outer 24k Gold Beveled Rim of the Letter (pure gold palette: NO white)
  const outerGold = aCtx.createLinearGradient(-55, -65, 55, 65);
  outerGold.addColorStop(0, '#fef08a');
  outerGold.addColorStop(0.3, '#fbbf24');
  outerGold.addColorStop(0.65, '#d97706');
  outerGold.addColorStop(1, '#92400e');

  aCtx.lineJoin = 'round';
  aCtx.lineWidth = 10;
  aCtx.strokeStyle = outerGold;
  aCtx.strokeText(sym.letter, 0, 0);

  // Inner Recessed Jewel Channel inside the 3D Gold Letter
  const innerJewel = aCtx.createLinearGradient(-40, -60, 40, 60);
  innerJewel.addColorStop(0, sym.gemHighlight);
  innerJewel.addColorStop(0.45, sym.gemPrimary);
  innerJewel.addColorStop(1, sym.tileBgEnd);

  aCtx.fillStyle = innerJewel;
  aCtx.fillText(sym.letter, 0, 0);

  // Warm 24k Gold Inner Bevel Accent (NO white stroke!)
  aCtx.lineWidth = 1.6;
  aCtx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
  aCtx.strokeText(sym.letter, 0, 0);

  // Add 3D Cabochon Gemstones & Pharaonic Crown/Wings (warm gold highlights, NO harsh white)
  // Top Crown / Emblem
  drawCabochonGem(aCtx, 0, -54, 14, 10, sym.gemPrimary, sym.gemHighlight);
  drawCabochonGem(aCtx, -22, -48, 7, 5, sym.gemSecondary, '#fde047');
  drawCabochonGem(aCtx, 22, -48, 7, 5, sym.gemSecondary, '#fde047');

  // Center / Base Cabochon Gems
  drawCabochonGem(aCtx, -24, 18, 8, 8, sym.gemPrimary, sym.gemHighlight);
  drawCabochonGem(aCtx, 24, 18, 8, 8, sym.gemPrimary, sym.gemHighlight);
  drawCabochonGem(aCtx, 0, 46, 11, 8, sym.gemSecondary, '#fde047');

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

  // Larger tiles with less space between each other
  const tileSize = Math.round(size * 0.86);
  const tileX = Math.round((size - tileSize) / 2);
  const tileY = Math.round((size - tileSize) / 2);
  const radius = Math.round(tileSize * 0.16);

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
  aCtx.strokeStyle = '#fde047';
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
  // Allow canvas width to accommodate full natural guardian shoulder/staff/aura width
  const spriteW = Math.round(COL_W * 1.55);
  const spriteH = GAME_H;
  const canvas = document.createElement('canvas');
  canvas.width = spriteW;
  canvas.height = spriteH;
  const ctx = canvas.getContext('2d');
  const cx = spriteW / 2;
  const cy = spriteH / 2;

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
    const naturalW = charImg.naturalWidth || charImg.width || 380;
    const naturalH = charImg.naturalHeight || charImg.height || 680;
    const aspect = naturalW / naturalH; // Exact aspect ratio preserving true physique

    // Scale height to fit the 1x3 column frame gracefully
    const ch = Math.round(GAME_H * (isRightGuardian ? 0.97 : 1.05));
    // Calculate width strictly preserving natural aspect ratio so character is never squished
    const cw = Math.round(ch * aspect);
    const cyOff = isRightGuardian ? -2 : 12;

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

const PhaserReelEngine = forwardRef(function PhaserReelEngine({
  initialGrid,
  initialExpandedCols,
  spinTrigger,
  onColumnStop,
  onSpinComplete,
  onSlamStop,
  winningLines,
  winningCells,
  activeWinLineIdx,
  selectedLines = 15,
  linesPreviewTrigger = 0,
}, ref) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const callbacksRef = useRef({ onColumnStop, onSpinComplete, onSlamStop });
  const winStateRef = useRef({
    winningLines: [],
    winningCells: new Set(),
    activeWinLineIdx: 0,
  });
  const linesPreviewRef = useRef({
    selectedLines: 15,
    bornAt: 0,
  });

  useImperativeHandle(ref, () => ({
    instantStop: () => {
      engineRef.current?.instantStop?.();
    },
    startSpin: (targetGrid, targetExpanded, isTurbo = false) => {
      engineRef.current?.startSpin?.(targetGrid, targetExpanded, isTurbo);
    },
    triggerTileCascade: (cellsToExplode, newGrid, rowDropFromByCol, onCascadeComplete) => {
      engineRef.current?.triggerTileCascade?.(
        cellsToExplode,
        newGrid,
        rowDropFromByCol,
        onCascadeComplete
      );
    },
    fastForwardCascade: () => {
      return engineRef.current?.fastForwardCascade?.();
    },
  }), []);

  useEffect(() => {
    callbacksRef.current = { onColumnStop, onSpinComplete, onSlamStop };
  }, [onColumnStop, onSpinComplete, onSlamStop]);

  useEffect(() => {
    winStateRef.current = {
      winningLines: winningLines || [],
      winningCells: winningCells || new Set(),
      activeWinLineIdx: activeWinLineIdx || 0,
    };
    engineRef.current?.markDirty?.();
  }, [winningLines, winningCells, activeWinLineIdx]);

  useEffect(() => {
    linesPreviewRef.current.selectedLines = selectedLines || 15;
    if (linesPreviewTrigger > 0) {
      linesPreviewRef.current.bornAt = performance.now();
    } else {
      linesPreviewRef.current.bornAt = 0;
    }
    engineRef.current?.markDirty?.();
  }, [selectedLines, linesPreviewTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

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
    const illuminatedTiles = [];
    let plannedRareCellsByCol = [null, null, null, null, null];
    let totalPlannedRareCount = 0;
    let activeCascade = null;
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

      // 1. Deep Basalt / Obsidian Base Stone with Micro-Grain Texture
      const stoneGrad = bCtx.createLinearGradient(0, 0, GAME_W, GAME_H);
      stoneGrad.addColorStop(0, '#060710');
      stoneGrad.addColorStop(0.35, '#0c0f1c');
      stoneGrad.addColorStop(0.7, '#070814');
      stoneGrad.addColorStop(1, '#03040a');
      bCtx.fillStyle = stoneGrad;
      bCtx.fillRect(0, 0, GAME_W, GAME_H);

      // Micro-texture grain
      bCtx.fillStyle = 'rgba(255, 230, 160, 0.02)';
      for (let i = 0; i < 400; i++) {
        bCtx.fillRect(Math.random() * GAME_W, Math.random() * GAME_H, 1.5, 1.5);
      }

      // 2. 5x3 Recessed Cell Tablets with Carved Egyptian Sun Cartouche
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          const cx = c * COL_W;
          const cy = r * ROW_H;
          const pad = 2;

          // Tablet background (expanded to reduce space between tiles)
          bCtx.fillStyle = 'rgba(3, 4, 10, 0.82)';
          bCtx.beginPath();
          bCtx.roundRect(cx + pad, cy + pad, COL_W - pad * 2, ROW_H - pad * 2, 8);
          bCtx.fill();

          // Beveled border
          bCtx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
          bCtx.lineWidth = 1;
          bCtx.stroke();

          // Inner carved hieroglyphic disc
          bCtx.save();
          bCtx.translate(cx + COL_W / 2, cy + ROW_H / 2);
          bCtx.strokeStyle = 'rgba(251, 191, 36, 0.07)';
          bCtx.lineWidth = 1.2;
          bCtx.beginPath();
          bCtx.arc(0, 0, 48, 0, Math.PI * 2);
          bCtx.stroke();

          // 8 decorative solar radial rays
          for (let ray = 0; ray < 8; ray++) {
            const ang = (ray * Math.PI) / 4;
            bCtx.beginPath();
            bCtx.moveTo(Math.cos(ang) * 36, Math.sin(ang) * 36);
            bCtx.lineTo(Math.cos(ang) * 46, Math.sin(ang) * 46);
            bCtx.stroke();
          }
          bCtx.restore();
        }
      }

      if (netImg) {
        bCtx.save();
        bCtx.globalAlpha = 0.55;
        bCtx.drawImage(netImg, 0, 0, GAME_W, GAME_H);
        bCtx.restore();
      }
      sprites.staticBg = bgCan;

      // 3. Pre-render 2026 High-Def Fluted Gold & Lapis Reel Divider Pillars
      const pillarCan = document.createElement('canvas');
      pillarCan.width = GAME_W;
      pillarCan.height = GAME_H;
      const pCtx = pillarCan.getContext('2d');

      for (let c = 1; c < COLS; c++) {
        const px = c * COL_W;

        // Soft drop shadow cast left and right onto spinning reel strips
        const shGrad = pCtx.createLinearGradient(px - 12, 0, px + 12, 0);
        shGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.65)');
        shGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.9)');
        shGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.65)');
        shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        pCtx.fillStyle = shGrad;
        pCtx.fillRect(px - 12, 0, 24, GAME_H);

        // Fluted 24k Gold Pillar Shaft (6px wide)
        const goldGrad = pCtx.createLinearGradient(px - 3, 0, px + 3, 0);
        goldGrad.addColorStop(0, '#78350f');
        goldGrad.addColorStop(0.3, '#d97706');
        goldGrad.addColorStop(0.5, '#fef08a');
        goldGrad.addColorStop(0.7, '#b45309');
        goldGrad.addColorStop(1, '#451a03');
        pCtx.fillStyle = goldGrad;
        pCtx.fillRect(px - 3, 0, 6, GAME_H);

        // Center specular line
        pCtx.fillStyle = 'rgba(255, 255, 230, 0.6)';
        pCtx.fillRect(px - 0.5, 0, 1, GAME_H);

        // Micro-relief Egyptian notches down the pillar
        pCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        for (let y = 15; y < GAME_H; y += 22) {
          pCtx.fillRect(px - 2, y, 4, 1.5);
        }

        // 3D Jeweled Cabochon Nodes at Row Junctions (y = 0, 170, 340, 510)
        [0, ROW_H, ROW_H * 2, GAME_H].forEach((nodeY) => {
          drawCabochonGem(pCtx, px, nodeY, 6, 6, '#0284c7', '#38bdf8');
        });
      }
      sprites.reelDividerPillars = pillarCan;

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

    // Ultra-smooth 60/120 FPS Render Loop with Delta Smoothing & Intelligent Idle Throttling
    let lastTime = performance.now();
    let isDirty = true;
    const markDirty = () => { isDirty = true; };

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
        rawTileAuraImg,
        rawSupernovaImg,
      ] = await Promise.all([
        loadImage(THEME_ASSETS.reelNetImage),
        loadImage(THEME_ASSETS.wildGlowImage1),
        loadImage(THEME_ASSETS.tallColumnBgImage),
        GUARDIANS.left.handFxImage ? loadImage(GUARDIANS.left.handFxImage) : Promise.resolve(null),
        GUARDIANS.right.handFxImage ? loadImage(GUARDIANS.right.handFxImage) : Promise.resolve(null),
        loadImage(GUARDIANS.left.tallColumnImage),
        loadImage(GUARDIANS.right.tallColumnImage),
        THEME_ASSETS.tileElectricFireAuraImage
          ? loadImage(THEME_ASSETS.tileElectricFireAuraImage)
          : Promise.resolve(null),
        THEME_ASSETS.bonusSupernovaBurstImage
          ? loadImage(THEME_ASSETS.bonusSupernovaBurstImage)
          : Promise.resolve(null),
      ]);

      if (isDisposed) return;

      if (rawTileAuraImg) {
        sprites.tileElectricFireAura = createNeonKeyedCanvas(rawTileAuraImg, 22, 42);
      }
      if (rawSupernovaImg) {
        sprites.bonusSupernovaBurst = createNeonKeyedCanvas(rawSupernovaImg, 22, 42);
      }

      if (netImg) {
        buildStaticBackdrop(netImg);
        isDirty = true;
      }

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
      isDirty = true;

      // Render 3D Pop-Out Royal Symbols, 3D Bonus Symbol, & High-Tier Two-Layer Symbols
      const bonusCrestOverlay = await loadImage(THEME_ASSETS.bonusCrestOverlayImage);

      // Ensure webfonts are 100% loaded before rasterizing typography to avoid any font fallback blur
      try {
        if (typeof document !== 'undefined' && document.fonts) {
          await document.fonts.ready;
        }
      } catch (_) {}

      await Promise.all(
        SYMBOLS.map(async (sym) => {
          if (sym.is3DBonus) {
            const bonusSize = Math.round(ROW_H * 0.98);
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
            isDirty = true;
            return;
          }

          if (sym.is3DRoyal) {
            const royalSize = Math.round(ROW_H * 0.96);
            const { normalCan, frameCan, artCan } = create3DPopOutRoyalSprites(sym, royalSize);
            sprites[`sym_${sym.id}`] = normalCan;
            sprites[`frame_${sym.id}`] = frameCan;
            sprites[`pop_${sym.id}`] = artCan;
            isDirty = true;
            return;
          }

          const rawImg = await loadImage(sym.image);
          if (!rawImg || isDisposed) return;

          const baseSize = Math.round(ROW_H * 0.96);

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
          isDirty = true;

          // Load separate Frame + No-Frame 3D Pop-Out layers for winning animations!
          if (sym.frameImage && sym.noFrameImage && sym.noFrameImage !== sym.image) {
            const [fImg, nfImg] = await Promise.all([
              loadImage(sym.frameImage),
              loadImage(sym.noFrameImage),
            ]);
            if (fImg && nfImg && !isDisposed) {
              const frameSz = Math.round(ROW_H * 0.90);
              const popSz = Math.round(ROW_H * 1.18);
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
              isDirty = true;
            }
          }
        })
      );
      isDirty = true;
    })();

    // Spin Controller with Turbo Flow Mode & 3-Tile Guardian Illumination Suspense support
    const startSpin = (targetGrid, targetExpanded, isTurbo = false) => {
      isDirty = true;
      lastTime = performance.now();
      linesPreviewRef.current.bornAt = 0;
      illuminatedTiles.length = 0;
      if (activeCascade) {
        activeCascade.tweens?.forEach((t) => t.kill());
        activeCascade.timers?.forEach((id) => clearTimeout(id));
        activeCascade = null;
      }
      plannedRareCellsByCol = [null, null, null, null, null];
      totalPlannedRareCount = 0;

      // Identify Rare Illumination Trigger Cells across the 5 columns:
      // Priority 1: Bonus Scatters (2+ scatters build intense suspense for the 3rd scatter!)
      // Priority 2: 2+ Sacred Guardian Awakener Relics (bastet_lotus / anubis_scepter)
      const scatterCols = [];
      const awakenerCols = [];

      for (let c = 0; c < COLS; c++) {
        const colSyms = targetGrid[c] || [];
        const bonusRow = colSyms.findIndex((s) => s?.isBonus);
        if (bonusRow !== -1) {
          scatterCols.push({ col: c, row: bonusRow, sym: colSyms[bonusRow], kind: 'bonus' });
        }
        const awakenerRow = colSyms.findIndex(
          (s) => s?.isGuardianAwakener || s?.id === 'bastet_lotus' || s?.id === 'anubis_scepter'
        );
        if (awakenerRow !== -1) {
          awakenerCols.push({ col: c, row: awakenerRow, sym: colSyms[awakenerRow], kind: 'awakener' });
        }
      }

      const chosenRareList =
        scatterCols.length >= 2
          ? scatterCols
          : awakenerCols.length >= 2
          ? awakenerCols
          : [];

      chosenRareList.forEach((item) => {
        plannedRareCellsByCol[item.col] = item;
      });
      totalPlannedRareCount = chosenRareList.length;

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
        reel.slamCell = null;
        reel.isTurbo = isTurbo;
        reel.anticipation = specialCountSoFar >= 2 && c >= 2 && !isTurbo;

        if (
          reel.willExpand ||
          Boolean(plannedRareCellsByCol[c]) ||
          targetGrid[c].some((s) => s.isBonus)
        ) {
          specialCountSoFar++;
        }

        // When 2 special tiles have landed, the remaining reel(s)—especially the final reel (c === 4)—
        // spin noticeably longer (+1.65s on final reel, +0.85s on reel 4) with accelerating tempo & volume!
        const suspenseExtraSec = reel.anticipation ? (c === 4 ? 1.65 : 0.85) : 0;
        // Snappier cadence: ~20% faster reel cycle keeps suspense phases intact
        const baseSpinSec = isTurbo ? 0.07 + c * 0.04 : 0.14 + c * 0.1;
        const spinDurationSec = baseSpinSec + suspenseExtraSec;
        const cruiseVelocity = isTurbo ? 2800 : 2200;
        const suspensePeakVelocity = c === 4 ? 3500 : 3050;

        reel.state = 'WINDUP';

        const tl = gsap.timeline({ delay: isTurbo ? c * 0.012 : c * 0.024 });
        reel.tweens.push(tl);

        tl.to(reel, {
          offsetY: isTurbo ? -8 : -14,
          duration: isTurbo ? 0.04 : 0.08,
          ease: 'power2.out',
        })
          .call(() => {
            reel.state = 'SPINNING';
            reel.offsetY = 0;
            reel.velocity = isTurbo ? 900 : 650;
          })
          .to(reel, {
            velocity: cruiseVelocity,
            duration: isTurbo ? 0.06 : 0.12,
            ease: 'power2.in',
          })
          .to(reel, {
            velocity: cruiseVelocity,
            duration: baseSpinSec,
            ease: 'none',
          });

        if (reel.anticipation && suspenseExtraSec > 0) {
          // Final-tile suspense phase: accelerate spin velocity/tempo while rising audio crescendo plays!
          tl.call(() => {
            if (!isTurbo && c === 4) {
              soundEngine.playAnticipationRiser(suspenseExtraSec);
            }
          }).to(reel, {
            velocity: suspensePeakVelocity,
            duration: suspenseExtraSec,
            ease: 'power2.in',
          });
        }

        tl.call(() => {
          const buf0 = randomSymbol();
          const buf1 = randomSymbol();
          reel.landingQueue = [
            buf0,
            buf1,
            reel.targetSymbols[0],
            reel.targetSymbols[1],
            reel.targetSymbols[2],
          ];
        });
      });
    };

    // Instant Slam Stop: immediately stops all spinning reels with zero delay
    const instantStop = () => {
      const isAnySpinning = reels.some((r) => r.state !== 'IDLE');
      if (!isAnySpinning) return;
      isDirty = true;

      reels.forEach((reel) => {
        reel.tweens.forEach((t) => t.kill());
        reel.tweens = [];
        reel.state = 'IDLE';
        reel.velocity = 0;
        reel.scrollPx = 0;
        reel.offsetY = 0;
        reel.landingQueue = null;

        // Immediately place target symbols directly into the 3 visible positions (strip[4..6])
        if (reel.targetSymbols && reel.targetSymbols.length >= 3) {
          reel.strip[4] = reel.targetSymbols[0];
          reel.strip[5] = reel.targetSymbols[1];
          reel.strip[6] = reel.targetSymbols[2];
        }

        if (reel.willExpand) {
          reel.expandedVisible = true;
          reel.tallScaleX = 1;
          reel.tallScaleY = 1;
          reel.tallAlpha = 1;
        }

        if (callbacksRef.current.onColumnStop) {
          callbacksRef.current.onColumnStop(reel.colIndex, reel.willExpand, reel.targetSymbols);
        }
      });

      soundEngine.playSlamStop();

      if (callbacksRef.current.onSlamStop) {
        callbacksRef.current.onSlamStop();
      }

      if (callbacksRef.current.onSpinComplete) {
        callbacksRef.current.onSpinComplete();
      }
    };

    const triggerReelLandingBounce = (reel) => {
      reel.state = 'LANDING';
      reel.velocity = 0;
      reel.scrollPx = 0;
      reel.offsetY = 0;

      // Guarantee 100% deterministic alignment between visible rows (strip[4..6]) and targetSymbols[0..2]
      reel.strip[4] = reel.targetSymbols[0];
      reel.strip[5] = reel.targetSymbols[1];
      reel.strip[6] = reel.targetSymbols[2];

      const plannedRare = plannedRareCellsByCol[reel.colIndex];
      const hasSpecialSlam =
        Boolean(plannedRare) ||
        reel.willExpand ||
        reel.targetSymbols.some((s) => s.isBonus || s.isGuardianAwakener || s.isExpanding);
      const hasSpecial =
        hasSpecialSlam || reel.targetSymbols.some((s) => s.isWild);

      const bounceTl = gsap.timeline();
      reel.tweens.push(bounceTl);

      const isTurbo = Boolean(reel.isTurbo);

      // When a special tile hits, it REALLY SLAMS into place (38px deep high-velocity impact + heavy recoil)!
      const slamDepthPx = hasSpecialSlam ? (isTurbo ? 22 : 38) : (isTurbo ? 8 : 15);
      const slamDownSec = hasSpecialSlam ? 0.052 : (isTurbo ? 0.055 : 0.088);
      const slamReboundSec = hasSpecialSlam ? 0.27 : (isTurbo ? 0.12 : 0.21);
      const slamReboundEase = hasSpecialSlam
        ? 'back.out(3.6)'
        : isTurbo
        ? 'back.out(1.8)'
        : 'back.out(2.3)';

      bounceTl
        .fromTo(
          reel,
          { offsetY: 0 },
          {
            offsetY: slamDepthPx,
            duration: slamDownSec,
            ease: hasSpecialSlam ? 'power4.in' : 'power1.out',
            onComplete: () => {
              if (hasSpecialSlam) {
                soundEngine.playSpecialTileSlam(reel.colIndex, illuminatedTiles.length + 1);
              } else {
                soundEngine.playReelStop(reel.colIndex, hasSpecial);
              }
              if (hasSpecial) {
                spawnParticles(
                  reel.centerX,
                  GAME_H / 2,
                  hasSpecialSlam ? 26 : 14,
                  reel.colIndex >= 3 ? '#c084fc' : '#00e5ff'
                );
              }

              // Check if this column landed a Rare Illumination Tile!
              let rareTileHit = null;
              if (plannedRare) {
                const nowHit = performance.now();
                const hitOrder = illuminatedTiles.length + 1;
                const tileEntry = {
                  col: plannedRare.col,
                  row: plannedRare.row,
                  sym: plannedRare.sym,
                  kind: plannedRare.kind,
                  order: hitOrder,
                  bornAt: nowHit,
                  slamBornAt: nowHit,
                  explodeAt: 0,
                };
                illuminatedTiles.push(tileEntry);

                const cellCenterX = plannedRare.col * COL_W + COL_W / 2;
                const cellCenterY = plannedRare.row * ROW_H + ROW_H / 2;
                spawnParticles(cellCenterX, cellCenterY, 28, hitOrder % 2 === 1 ? '#00f0ff' : '#fbbf24');

                // If 3rd illuminated tile just hit -> trigger 3-Tile Supernova Detonation across all illuminated tiles!
                const didExplode3 = illuminatedTiles.length >= 3;
                if (didExplode3) {
                  illuminatedTiles.forEach((it) => {
                    if (!it.explodeAt) {
                      it.explodeAt = nowHit + 220;
                    }
                    const ix = it.col * COL_W + COL_W / 2;
                    const iy = it.row * ROW_H + ROW_H / 2;
                    spawnParticles(ix, iy, 32, '#ffd700');
                  });
                }

                rareTileHit = {
                  col: plannedRare.col,
                  row: plannedRare.row,
                  sym: plannedRare.sym,
                  kind: plannedRare.kind,
                  count: illuminatedTiles.length,
                  totalPlanned: totalPlannedRareCount,
                  exploded: didExplode3,
                  allIlluminatedCells: illuminatedTiles.map((it) => [it.col, it.row]),
                };
                isDirty = true;
              } else if (hasSpecialSlam) {
                // Even if only 1 bonus scatter landed on the whole spin, record a local slam shockwave for that cell
                const specialRow = reel.targetSymbols.findIndex(
                  (s) => s?.isBonus || s?.isGuardianAwakener || s?.isExpanding
                );
                if (specialRow !== -1) {
                  reel.slamCell = { row: specialRow, bornAt: performance.now() };
                  const cellCenterX = reel.colIndex * COL_W + COL_W / 2;
                  const cellCenterY = specialRow * ROW_H + ROW_H / 2;
                  spawnParticles(cellCenterX, cellCenterY, 22, '#fbbf24');
                  isDirty = true;
                }
              }

              if (callbacksRef.current.onColumnStop) {
                callbacksRef.current.onColumnStop(
                  reel.colIndex,
                  reel.willExpand,
                  reel.targetSymbols,
                  rareTileHit,
                  hasSpecialSlam
                );
              }
            },
          }
        )
        .to(reel, {
          offsetY: 0,
          duration: slamReboundSec,
          ease: slamReboundEase,
          onComplete: () => {
            reel.state = 'IDLE';

            if (reel.willExpand) {
              reel.expandedVisible = true;
              reel.tallScaleX = 0.3;
              reel.tallScaleY = 0.1;
              reel.tallAlpha = 0.01;
              isDirty = true;

              spawnParticles(reel.centerX, GAME_H * 0.3, 14, '#ffd700');
              spawnParticles(reel.centerX, GAME_H * 0.7, 14, '#00e5ff');

              const expTween = gsap.to(reel, {
                tallScaleX: 1,
                tallScaleY: 1,
                tallAlpha: 1,
                duration: 0.36,
                ease: 'back.out(1.8)',
                onUpdate: () => {
                  isDirty = true;
                },
                onComplete: () => {
                  isDirty = true;
                },
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

    // =========================================================================
    // 2026 GUARDIAN ZAP PAUSE -> LIT-UP TILE EXPLOSION -> CANDY-CRUSH CASCADE
    // =========================================================================
    const triggerTileCascade = (
      cellsToExplode = [],
      newGrid = null,
      rowDropFromByCol = null,
      onCascadeComplete = null
    ) => {
      if (!Array.isArray(cellsToExplode) || cellsToExplode.length === 0 || !newGrid) {
        onCascadeComplete?.();
        return;
      }

      if (activeCascade) {
        activeCascade.tweens?.forEach((t) => t.kill());
        activeCascade.timers?.forEach((id) => clearTimeout(id));
        activeCascade = null;
      }

      const nowStart = performance.now();
      const explodedSet = new Set(cellsToExplode.map(([c, r]) => `${c},${r}`));
      const dropOffsets = Array.from({ length: COLS }, () => [0, 0, 0]);

      // Ensure all zapped cells also appear in illuminatedTiles so the electric/solar aura renders during ZAP_PAUSE
      cellsToExplode.forEach(([c, r], idx) => {
        const exists = illuminatedTiles.some((it) => it.col === c && it.row === r);
        if (!exists) {
          illuminatedTiles.push({
            col: c,
            row: r,
            sym: reels[c]?.strip?.[4 + r],
            kind: 'zap',
            order: idx + 1,
            bornAt: nowStart,
            slamBornAt: nowStart,
            explodeAt: 0,
          });
        }
      });

      activeCascade = {
        phase: 'ZAP_PAUSE',
        phaseStart: nowStart,
        cellsToExplode,
        explodedSet,
        newGrid,
        rowDropFromByCol,
        dropOffsets,
        onCascadeComplete,
        tweens: [],
        timers: [],
      };
      isDirty = true;

      // Phase 1 -> Phase 2: After 640ms of the board getting zapped by Guardian power, EXPLODE the lit-up tiles!
      const tExplode = setTimeout(() => {
        if (!activeCascade || isDisposed) return;
        const nowExp = performance.now();
        activeCascade.phase = 'EXPLODING';
        activeCascade.phaseStart = nowExp;
        soundEngine.playSpecialTileSlam?.(2, 3);
        soundEngine.playThunderStrike?.();

        cellsToExplode.forEach(([c, r], idx) => {
          const cx = c * COL_W + COL_W / 2;
          const cy = r * ROW_H + ROW_H / 2;
          spawnParticles(cx, cy, 34, idx % 2 === 0 ? '#00f0ff' : '#fbbf24');
          const illum = illuminatedTiles.find((it) => it.col === c && it.row === r);
          if (illum) {
            illum.explodeAt = nowExp;
          }
        });
        isDirty = true;
      }, 640);

      // Phase 2 -> Phase 3: After 420ms of tile explosion leaving empty spaces, drop tiles down (Candy-Crush cascade!)
      const tCascade = setTimeout(() => {
        if (!activeCascade || isDisposed) return;
        const nowCas = performance.now();
        activeCascade.phase = 'CASCADING';
        activeCascade.phaseStart = nowCas;
        illuminatedTiles.length = 0;

        for (let c = 0; c < COLS; c++) {
          const reel = reels[c];
          if (newGrid[c] && newGrid[c].length >= 3) {
            reel.targetSymbols = newGrid[c];
            reel.strip[4] = newGrid[c][0];
            reel.strip[5] = newGrid[c][1];
            reel.strip[6] = newGrid[c][2];
          }

          for (let r = 0; r < ROWS; r++) {
            const fromRow =
              rowDropFromByCol && rowDropFromByCol[c] && typeof rowDropFromByCol[c][r] === 'number'
                ? rowDropFromByCol[c][r]
                : r;
            const rowDelta = r - fromRow;
            if (rowDelta > 0) {
              const startOff = -rowDelta * ROW_H;
              activeCascade.dropOffsets[c][r] = startOff;
              const proxy = { y: startOff };
              const tw = gsap.to(proxy, {
                y: 0,
                duration: 0.38 + Math.min(0.14, rowDelta * 0.05),
                delay: (ROWS - 1 - r) * 0.045 + c * 0.025,
                ease: 'back.out(1.65)',
                onUpdate: () => {
                  if (activeCascade && activeCascade.dropOffsets[c]) {
                    activeCascade.dropOffsets[c][r] = proxy.y;
                    isDirty = true;
                  }
                },
                onComplete: () => {
                  if (activeCascade && activeCascade.dropOffsets[c]) {
                    activeCascade.dropOffsets[c][r] = 0;
                    const cx = c * COL_W + COL_W / 2;
                    const cy = r * ROW_H + ROW_H / 2;
                    spawnParticles(cx, cy, 12, '#fde047');
                    soundEngine.playReelStop?.(c, true);
                    isDirty = true;
                  }
                },
              });
              activeCascade.tweens.push(tw);
            } else {
              activeCascade.dropOffsets[c][r] = 0;
            }
          }
        }
        isDirty = true;
      }, 640 + 420);

      // Phase 3 -> Phase 4: Cascade complete! Evaluate new board for second-chance win!
      const tFinish = setTimeout(() => {
        if (!activeCascade || isDisposed) return;
        const doneCb = activeCascade.onCascadeComplete;
        activeCascade.tweens?.forEach((t) => t.kill());
        activeCascade = null;
        illuminatedTiles.length = 0;
        isDirty = true;
        doneCb?.();
      }, 640 + 420 + 540);

      activeCascade.timers.push(tExplode, tCascade, tFinish);
    };

    const fastForwardCascade = () => {
      if (!activeCascade) return false;
      const { cellsToExplode, newGrid, onCascadeComplete, tweens, timers } = activeCascade;
      tweens?.forEach((t) => t.kill());
      timers?.forEach((id) => clearTimeout(id));

      for (let c = 0; c < COLS; c++) {
        const reel = reels[c];
        if (newGrid?.[c] && newGrid[c].length >= 3) {
          reel.targetSymbols = newGrid[c];
          reel.strip[4] = newGrid[c][0];
          reel.strip[5] = newGrid[c][1];
          reel.strip[6] = newGrid[c][2];
        }
      }

      cellsToExplode?.forEach(([c, r]) => {
        const cx = c * COL_W + COL_W / 2;
        const cy = r * ROW_H + ROW_H / 2;
        spawnParticles(cx, cy, 18, '#ffd700');
      });

      soundEngine.playSlamStop?.();
      illuminatedTiles.length = 0;
      activeCascade = null;
      isDirty = true;
      onCascadeComplete?.();
      return true;
    };

    const tick = () => {
      if (isDisposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      // High-precision frame delta bounded to [1ms, 45ms] to prevent stutter or physics lag
      const dt = Math.min(0.045, Math.max(0.001, rawDt));

      const {
        winningLines: wins,
        winningCells: winSet,
        activeWinLineIdx: winIdx,
      } = winStateRef.current;
      const anySpinning = reels.some((r) => r.state !== 'IDLE');
      const hasActiveWins = !anySpinning && wins && wins.length > 0;
      const previewElapsed =
        linesPreviewRef.current.bornAt > 0 ? now - linesPreviewRef.current.bornAt : 99999;
      const hasLinesPreview = !anySpinning && previewElapsed >= 0 && previewElapsed < 3600;
      const hasParticles = particles.length > 0;
      const hasIlluminated =
        illuminatedTiles.length > 0 &&
        (anySpinning ||
          Boolean(activeCascade) ||
          now - illuminatedTiles[illuminatedTiles.length - 1].bornAt < 3400);
      const hasTransitions = reels.some(
        (r) =>
          r.offsetY !== 0 ||
          (r.tallAlpha > 0.001 && r.tallAlpha < 0.999) ||
          (r.slamCell && now - r.slamCell.bornAt < 300)
      );
      const isActivelyAnimating =
        anySpinning ||
        hasActiveWins ||
        hasLinesPreview ||
        hasParticles ||
        hasTransitions ||
        hasIlluminated ||
        Boolean(activeCascade);

      // Intelligent Idle Throttling: If no reels are spinning and no animations/wins/particles are active,
      // draw the resting grid once and suspend drawing to yield 0% GPU load and eliminate thermal heat
      if (!isActivelyAnimating) {
        if (!isDirty) {
          return;
        }
        isDirty = false;
      } else {
        isDirty = true;
      }

      ctx.clearRect(0, 0, GAME_W, GAME_H);

      if (sprites.staticBg) {
        ctx.drawImage(sprites.staticBg, 0, 0);
      }

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
              const remaining = reel.landingQueue.length;
              if (remaining === 0) {
                reel.landingQueue = null;
                triggerReelLandingBounce(reel);
                break;
              } else {
                // Brisk, crisp progressive landing curve (never drag or crawl below 1350 px/s)
                const decelMultipliers = [0.65, 0.76, 0.88, 0.96];
                const mult = decelMultipliers[Math.min(decelMultipliers.length - 1, remaining - 1)] || 0.75;
                reel.velocity = Math.max(reel.isTurbo ? 1800 : 1350, (reel.anticipation ? 2600 : (reel.isTurbo ? 2800 : 2200)) * mult);
              }
            } else {
              reel.strip.unshift(randomSymbol());
            }
          }
        }

        // Anticipation & 2/3 Tile Suspense Spotlight
        if (reel.state === 'SPINNING' && (reel.anticipation || illuminatedTiles.length === 2)) {
          const pulseA = 0.14 + 0.08 * Math.sin(now * 0.018);
          ctx.fillStyle =
            illuminatedTiles.length === 2
              ? `rgba(0, 240, 255, ${pulseA.toFixed(2)})`
              : `rgba(255, 215, 0, ${pulseA.toFixed(2)})`;
          ctx.fillRect(reel.x, 0, COL_W, GAME_H);
          ctx.strokeStyle = illuminatedTiles.length === 2 ? '#00f0ff' : '#ffd700';
          ctx.lineWidth = 3.5;
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
            ctx.drawImage(tallSprite, -tallSprite.width / 2, -tallSprite.height / 2);
            ctx.restore();
          }
        } else {
          const speedRatio = Math.min(1, reel.velocity / 2400);
          const stretchY = 1 + speedRatio * 0.16;
          const squashX = 1 - speedRatio * 0.04;

          for (let idx = 0; idx < STRIP_SIZE; idx++) {
            const sym = reel.strip[idx];
            const visibleRow = idx - (STRIP_SIZE - ROWS);
            const cascadeDropY =
              visibleRow >= 0 &&
              visibleRow < ROWS &&
              activeCascade?.phase === 'CASCADING' &&
              activeCascade.dropOffsets?.[c]
                ? activeCascade.dropOffsets[c][visibleRow] || 0
                : 0;
            const centerY =
              visibleRow * ROW_H + ROW_H / 2 + reel.scrollPx + reel.offsetY + cascadeDropY;

            if (centerY < -ROW_H || centerY > GAME_H + ROW_H) continue;

            const isCascadeTargetCell =
              visibleRow >= 0 &&
              visibleRow < ROWS &&
              Boolean(activeCascade?.explodedSet?.has(`${c},${visibleRow}`));

            // During EXPLODING phase, zapped tiles burst outward and vanish into empty space!
            if (isCascadeTargetCell && activeCascade?.phase === 'EXPLODING') {
              const expElapsed = Math.max(0, now - activeCascade.phaseStart);
              const expProg = Math.min(1, expElapsed / 400);
              const sprite = sprites[`win_${sym.id}`] || sprites[`sym_${sym.id}`];
              if (sprite && expProg < 0.65) {
                const scaleOut = 1 + 0.42 * Math.sin((expProg / 0.65) * Math.PI * 0.5);
                const alphaOut = Math.max(0, 1 - expProg / 0.62);
                const dw = Math.round(sprite.width * scaleOut);
                const dh = Math.round(sprite.height * scaleOut);
                ctx.save();
                ctx.globalAlpha = alphaOut;
                ctx.drawImage(
                  sprite,
                  Math.round(reel.centerX - dw / 2),
                  Math.round(centerY - dh / 2),
                  dw,
                  dh
                );
                ctx.restore();
              }
              // Draw supernova shockwave ring & burst over the exploding cell
              ctx.save();
              ctx.globalCompositeOperation = 'screen';
              if (sprites.bonusSupernovaBurst) {
                const bScale = 0.45 + Math.sin(expProg * Math.PI) * 1.45;
                const bSz = Math.round(ROW_H * 1.38 * bScale);
                ctx.globalAlpha = Math.max(0, 1 - expProg * 0.85);
                ctx.translate(reel.centerX, centerY);
                ctx.rotate(expProg * 2.1);
                ctx.drawImage(sprites.bonusSupernovaBurst, -bSz / 2, -bSz / 2, bSz, bSz);
              }
              ctx.restore();
              continue;
            }

            // During ZAP_PAUSE phase, zapped tiles vibrate with electric/solar overcharge before exploding!
            const zapJitterX =
              isCascadeTargetCell && activeCascade?.phase === 'ZAP_PAUSE'
                ? (Math.random() - 0.5) * 9
                : 0;
            const zapJitterY =
              isCascadeTargetCell && activeCascade?.phase === 'ZAP_PAUSE'
                ? (Math.random() - 0.5) * 9
                : 0;

            const isWinningCell =
              !anySpinning &&
              !activeCascade &&
              visibleRow >= 0 &&
              winSet.has(`${c}-${visibleRow}`);

            const frameSprite = sprites[`frame_${sym.id}`];
            const popSprite = sprites[`pop_${sym.id}`];

            // If this symbol is a winning cell and has separate 3D Frame + Pop-Out Artifact layers,
            // animate the 3D object lifting up and bursting out off its tile frame!
            if (isWinningCell && frameSprite && popSprite) {
              const fw = Math.round(frameSprite.width * framePulse);
              const fh = Math.round(frameSprite.height * framePulse);
              const fx = Math.round(reel.centerX - fw / 2);
              const fy = Math.round(centerY - fh / 2);
              ctx.drawImage(frameSprite, fx, fy, fw, fh);

              const pw = Math.round(popSprite.width * popOutPulse);
              const ph = Math.round(popSprite.height * popOutPulse);
              const px = Math.round(reel.centerX - pw / 2);
              const py = Math.round(centerY - ph / 2 + popLiftY);
              ctx.drawImage(popSprite, px, py, pw, ph);
            } else {
              const sprite =
                isWinningCell || isCascadeTargetCell
                  ? sprites[`win_${sym.id}`] || sprites[`sym_${sym.id}`]
                  : sprites[`sym_${sym.id}`];

              if (!sprite) continue;

              const sw = sprite.width;
              const sh = sprite.height;

              // Check if this specific visible cell just slammed into place (within 260ms)
              let slamBornAt = 0;
              if (visibleRow >= 0 && reel.state !== 'SPINNING') {
                const illumEntry = illuminatedTiles.find(
                  (it) => it.col === c && it.row === visibleRow
                );
                if (illumEntry && illumEntry.slamBornAt) {
                  slamBornAt = illumEntry.slamBornAt;
                } else if (reel.slamCell && reel.slamCell.row === visibleRow) {
                  slamBornAt = reel.slamCell.bornAt;
                }
              }
              const slamElapsed = slamBornAt > 0 ? now - slamBornAt : 9999;

              if (slamElapsed >= 0 && slamElapsed < 280) {
                // Heavy Physical Slam-Crush Scale (1.36x -> 1.0x impact crush + seismic shockwave ring!)
                const slamProg = slamElapsed / 280;
                const slamScale = 1 + 0.36 * Math.pow(1 - slamProg, 1.6);
                const dw = Math.round(sw * slamScale);
                const dh = Math.round(sh * slamScale);
                const dx = Math.round(reel.centerX - dw / 2 + zapJitterX);
                const dy = Math.round(centerY - dh / 2 + zapJitterY);
                ctx.drawImage(sprite, dx, dy, dw, dh);

                // Expanding gold-cyan seismic shockwave ring on slam impact
                ctx.save();
                ctx.strokeStyle = `rgba(251, 191, 36, ${(0.92 * (1 - slamProg)).toFixed(2)})`;
                ctx.lineWidth = 4.5 * (1 - slamProg * 0.6);
                ctx.beginPath();
                ctx.arc(reel.centerX, centerY, 26 + slamProg * 72, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
              } else if (isWinningCell || (isCascadeTargetCell && activeCascade?.phase === 'ZAP_PAUSE')) {
                const zapScale =
                  isCascadeTargetCell && activeCascade?.phase === 'ZAP_PAUSE'
                    ? 1.08 + 0.08 * Math.sin(now * 0.045)
                    : popOutPulse;
                const dw = Math.round(sw * zapScale);
                const dh = Math.round(sh * zapScale);
                const dx = Math.round(reel.centerX - dw / 2 + zapJitterX);
                const dy = Math.round(centerY - dh / 2 + zapJitterY);
                ctx.drawImage(sprite, dx, dy, dw, dh);
              } else {
                // Direct hardware 1:1 bitblt for ultra-smooth 60/120 FPS spin without software resampling
                const dx = Math.round(reel.centerX - sw / 2 + zapJitterX);
                const dy = Math.round(centerY - sh / 2 + zapJitterY);
                ctx.drawImage(sprite, dx, dy);
              }
            }

            if (isWinningCell) {
              // Sparkling 4-point star glint that rotates and twinkles on winning symbols
              const glintTime = now * 0.006 + c * 1.6 + visibleRow * 2.3;
              const glintAlpha = 0.4 + 0.6 * Math.sin(glintTime);
              if (glintAlpha > 0.1) {
                const glintX = reel.centerX + 36;
                const glintY = centerY - 36 + popLiftY;
                const starSize = 7 + 5 * Math.sin(glintTime);
                ctx.save();
                ctx.translate(glintX, glintY);
                ctx.rotate(glintTime * 0.4);
                ctx.fillStyle = `rgba(255, 240, 160, ${glintAlpha.toFixed(2)})`;
                ctx.beginPath();
                ctx.moveTo(0, -starSize);
                ctx.quadraticCurveTo(0, 0, starSize, 0);
                ctx.quadraticCurveTo(0, 0, 0, starSize);
                ctx.quadraticCurveTo(0, 0, -starSize, 0);
                ctx.quadraticCurveTo(0, 0, 0, -starSize);
                ctx.fill();
                ctx.restore();
              }
            }
          }
        }
      });

      // 2026 Architectural Fluted Gold & Lapis Reel Divider Pillars
      if (sprites.reelDividerPillars) {
        ctx.drawImage(sprites.reelDividerPillars, 0, 0);
      }

      if (sprites.staticShade) {
        ctx.drawImage(sprites.staticShade, 0, 0);
      }

      // =========================================================================
      // 2026 GUARDIAN LIGHTNING & SOLAR FIRE TILE ILLUMINATION + 3-TILE SUPERNOVA
      // =========================================================================
      if (hasIlluminated) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // 1. If 2+ tiles are illuminated, draw crackling electric & solar tether arcs connecting them!
        if (illuminatedTiles.length >= 2) {
          for (let i = 0; i < illuminatedTiles.length - 1; i++) {
            const a = illuminatedTiles[i];
            const b = illuminatedTiles[i + 1];
            const ax = a.col * COL_W + COL_W / 2;
            const ay = a.row * ROW_H + ROW_H / 2;
            const bx = b.col * COL_W + COL_W / 2;
            const by = b.row * ROW_H + ROW_H / 2;

            // Outer golden-cyan plasma beam
            ctx.strokeStyle =
              illuminatedTiles.length >= 3
                ? 'rgba(251, 191, 36, 0.65)'
                : 'rgba(0, 240, 255, 0.55)';
            ctx.lineWidth = 10 + 3 * Math.sin(now * 0.025);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            const steps = 6;
            for (let s = 1; s < steps; s++) {
              const t = s / steps;
              const jx = ax + (bx - ax) * t + (Math.random() - 0.5) * 18;
              const jy = ay + (by - ay) * t + (Math.random() - 0.5) * 18;
              ctx.lineTo(jx, jy);
            }
            ctx.lineTo(bx, by);
            ctx.stroke();

            // Hot white-gold core filament
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }
        }

        // 2. Draw Electric & Fire Aura Sprite + Supernova Detonation around each Illuminated Tile
        illuminatedTiles.forEach((it) => {
          const cx = it.col * COL_W + COL_W / 2;
          const cy = it.row * ROW_H + ROW_H / 2;
          const ageMs = now - it.bornAt;
          const entryScale = Math.min(1, ageMs / 140);
          const pulse = 1 + 0.06 * Math.sin(now * 0.018 + it.order);

          if (sprites.tileElectricFireAura) {
            const auraSz = Math.round(ROW_H * 1.16 * entryScale * pulse);
            ctx.drawImage(
              sprites.tileElectricFireAura,
              Math.round(cx - auraSz / 2),
              Math.round(cy - auraSz / 2),
              auraSz,
              auraSz
            );
          } else {
            ctx.strokeStyle = it.order % 2 === 1 ? '#00f0ff' : '#fbbf24';
            ctx.lineWidth = 4;
            ctx.strokeRect(cx - COL_W * 0.44, cy - ROW_H * 0.44, COL_W * 0.88, ROW_H * 0.88);
          }

          // If 3rd tile hit -> Supernova Explosion Burst on all 3 tiles!
          if (it.explodeAt > 0 && now >= it.explodeAt) {
            const expElapsed = now - it.explodeAt;
            if (expElapsed < 1650) {
              const expProg = expElapsed / 1650;
              const burstScale = 0.55 + Math.sin(expProg * Math.PI) * 1.35;
              const burstAlpha = Math.max(0, 1 - expProg * 0.85);
              ctx.save();
              ctx.globalAlpha = burstAlpha;
              ctx.translate(cx, cy);
              ctx.rotate(expProg * 1.8);
              if (sprites.bonusSupernovaBurst) {
                const bSz = Math.round(ROW_H * 1.45 * burstScale);
                ctx.drawImage(sprites.bonusSupernovaBurst, -bSz / 2, -bSz / 2, bSz, bSz);
              }
              ctx.restore();
            }
          }
        });

        ctx.restore();

        // 3. Draw Crisp Charge Counter Badges on Illuminated Tiles ("⚡ 1/3", "⚡🔥 2/3 SUSPENSE!", "💥 3/3 BONUS!")
        ctx.save();
        illuminatedTiles.forEach((it) => {
          const cx = it.col * COL_W + COL_W / 2;
          const cy = it.row * ROW_H + ROW_H - 20;
          const isZapPause = activeCascade?.phase === 'ZAP_PAUSE';
          const isExploding = activeCascade?.phase === 'EXPLODING';
          const isTriple = illuminatedTiles.length >= 3;
          const badgeText = isExploding
            ? '💥 EXPLODING!'
            : isZapPause
            ? '⚡ ZAPPED!'
            : isTriple
            ? `💥 ${it.order}/3 BONUS!`
            : `⚡ ${it.order}/3 CHARGED`;
          const bw = isTriple || isExploding ? 114 : 104;
          const bh = 22;

          ctx.fillStyle =
            isTriple || isExploding || isZapPause
              ? 'rgba(180, 83, 9, 0.94)'
              : 'rgba(8, 25, 56, 0.92)';
          ctx.strokeStyle = isTriple || isExploding || isZapPause ? '#fde047' : '#00f0ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = "900 11px 'Cinzel', sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, cx, cy);
        });
        ctx.restore();
      }

      // =========================================================================
      // 2026 INTERACTIVE ACTIVE PAYLINES PREVIEW OVERLAY (1, 2, 5, 10, OR 15 LINES)
      // Whenever the player adjusts or taps the LINES selector, render all active
      // payline laser paths (1..selectedLines) directly across the 5x3 reel board
      // with numbered edge badges so they immediately see what the adjustment does!
      // =========================================================================
      if (hasLinesPreview) {
        const activeCount = Math.min(
          PAYLINES.length,
          Math.max(1, linesPreviewRef.current.selectedLines || 15)
        );
        const activePaylines = PAYLINES.slice(0, activeCount);
        const fadeAlpha =
          previewElapsed < 140
            ? previewElapsed / 140
            : previewElapsed > 2900
            ? Math.max(0, 1 - (previewElapsed - 2900) / 700)
            : 1;
        const pulse = 0.88 + 0.12 * Math.sin(now * 0.009);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Slightly dim the underlying symbol tiles so the payline paths pop with razor clarity
        ctx.fillStyle = `rgba(3, 7, 18, ${(0.34 * fadeAlpha).toFixed(3)})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);

        // Precompute vertical lane offsets per (col, row) cell so overlapping paylines fan out cleanly
        const cellLineMap = new Map();
        activePaylines.forEach((pl, idx) => {
          pl.rows.forEach((r, c) => {
            const key = `${c},${r}`;
            if (!cellLineMap.has(key)) cellLineMap.set(key, []);
            cellLineMap.get(key).push(idx);
          });
        });

        const getPointForLineCell = (lineIdx, c, r) => {
          const list = cellLineMap.get(`${c},${r}`) || [lineIdx];
          const posInCell = list.indexOf(lineIdx);
          const totalInCell = list.length;
          // Spread up to ±26px vertically inside the 170px row height when multiple lines share a tile
          const stepPx = totalInCell <= 1 ? 0 : Math.min(8.5, 52 / (totalInCell - 1));
          const offsetY = (posInCell - (totalInCell - 1) / 2) * stepPx;
          return {
            x: c * COL_W + COL_W / 2,
            y: r * ROW_H + ROW_H / 2 + offsetY,
          };
        };

        // 1. Draw each active payline path (from #1 up to #selectedLines)
        activePaylines.forEach((pl, idx) => {
          const isNewestLine = idx === activeCount - 1;
          const pts = pl.rows.map((r, c) => getPointForLineCell(idx, c, r));
          const startEdge = { x: 24, y: pts[0].y };
          const endEdge = { x: GAME_W - 24, y: pts[pts.length - 1].y };
          const fullPts = [startEdge, ...pts, endEdge];

          // Outer neon laser aura
          ctx.beginPath();
          fullPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.strokeStyle = pl.color;
          ctx.lineWidth = isNewestLine ? 12 : activeCount <= 5 ? 10 : 7.5;
          ctx.globalAlpha = (isNewestLine ? 0.42 : 0.26) * fadeAlpha * pulse;
          ctx.stroke();

          // Crisp colored core beam
          ctx.beginPath();
          fullPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.strokeStyle = pl.color;
          ctx.lineWidth = isNewestLine ? 5.2 : activeCount <= 5 ? 4.2 : 3.1;
          ctx.globalAlpha = (isNewestLine ? 0.98 : 0.88) * fadeAlpha;
          ctx.stroke();

          // Hot white inner filament
          ctx.beginPath();
          fullPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = isNewestLine ? 1.8 : 1.1;
          ctx.globalAlpha = (isNewestLine ? 0.92 : 0.65) * fadeAlpha;
          ctx.stroke();

          // Anchor nodes at each reel column center
          pts.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, isNewestLine ? 6.2 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.95 * fadeAlpha;
            ctx.fill();
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = pl.color;
            ctx.stroke();
          });
        });

        // 2. Draw numbered payline badges (#1 .. #N) on Left (odd lines) and Right (even lines) edges
        activePaylines.forEach((pl, idx) => {
          const isLeftBadge = idx % 2 === 0;
          const anchorPt = isLeftBadge
            ? getPointForLineCell(idx, 0, pl.rows[0])
            : getPointForLineCell(idx, COLS - 1, pl.rows[COLS - 1]);
          const bx = isLeftBadge ? 22 : GAME_W - 22;
          const by = Math.max(18, Math.min(GAME_H - 18, anchorPt.y));
          const bw = 32;
          const bh = 20;

          ctx.globalAlpha = 0.96 * fadeAlpha;
          ctx.fillStyle = '#090d16';
          ctx.strokeStyle = pl.color;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = "900 11px 'Cinzel', sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`#${pl.id}`, bx, by + 0.5);
        });

        // 3. Top-center HUD pill banner on the reel canvas confirming active payline count
        const bannerText = `${activeCount} ACTIVE PAYLINE${activeCount > 1 ? 'S' : ''} SELECTED`;
        const pillW = 290;
        const pillH = 30;
        const pillX = GAME_W / 2 - pillW / 2;
        const pillY = 10;

        ctx.globalAlpha = 0.95 * fadeAlpha;
        ctx.fillStyle = 'rgba(8, 15, 32, 0.92)';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 15);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.font = "900 13px 'Cinzel', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bannerText, GAME_W / 2, pillY + pillH / 2 + 0.5);

        ctx.restore();
      }

      // Draw Multi-Layered Payline & Scatter Win Lasers
      if (!anySpinning && wins && wins.length > 0) {
        const activeWin = wins[winIdx % wins.length];
        if (activeWin) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (activeWin.isScatter) {
            const rawScatterCells = activeWin.cells || [];
            const sPts = rawScatterCells.map(([c, r]) => ({
              x: c * COL_W + COL_W / 2,
              y: r * ROW_H + ROW_H / 2,
            }));

            if (sPts.length > 0) {
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
            }
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

            const winCells =
              activeWin.cells ||
              (activeWin.line
                ? Array.from({ length: activeWin.matchCount || 0 }, (_, c) => [c, activeWin.line.rows[c]])
                : []);

            winCells.forEach(([c, r]) => {
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
    engineRef.current = {
      startSpin,
      instantStop,
      markDirty,
      triggerTileCascade,
      fastForwardCascade,
    };

    const handleVisibility = () => {
      if (document.hidden) {
        gsap.ticker.remove(tick);
      } else {
        lastTime = performance.now();
        isDirty = true;
        gsap.ticker.add(tick);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isDisposed = true;
      gsap.ticker.remove(tick);
      document.removeEventListener('visibilitychange', handleVisibility);
      reels.forEach((r) => r.tweens.forEach((t) => t.kill()));
    };
  }, []);

  useEffect(() => {
    if (!spinTrigger || !engineRef.current) return;
    engineRef.current.startSpin(
      spinTrigger.targetGrid,
      spinTrigger.targetExpanded,
      Boolean(spinTrigger.isTurbo)
    );
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
});

export default PhaserReelEngine;
