import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SYMBOLS } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';

// Native internal resolution (exact 5:3 aspect ratio matching 1315x789 PSD reel_net)
// Running at 850x510 cuts GPU fill-rate by 60% while looking razor-sharp!
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
 * Pre-renders a symbol onto a fixed-size offscreen canvas at startup, optionally
 * with a baked-in neon glow halo so the 60fps loop NEVER uses ctx.shadowBlur!
 */
function createBakedSprite(sourceImgOrCanvas, targetW, targetH, filterStr = '', glowColor = '') {
  const pad = glowColor ? 24 : 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetW + pad * 2);
  canvas.height = Math.round(targetH + pad * 2);
  const ctx = canvas.getContext('2d');

  if (filterStr) {
    ctx.filter = filterStr;
  }
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 16;
  }
  ctx.drawImage(sourceImgOrCanvas, pad, pad, targetW, targetH);
  return canvas;
}

/**
 * Pre-renders the 1x3 Tall Expanding Guardian Column (Anubis or Bastet) into a single
 * static sprite at startup so expanding columns cost only 1 drawImage call per frame!
 */
function createBakedTallColumnSprite(bgImg, charImg, fireImg, isBastet) {
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
    const cw = isBastet ? COL_W * 1.12 : COL_W * 1.24;
    const ch = isBastet ? GAME_H * 0.95 : GAME_H * 1.2;
    const cyOff = isBastet ? 0 : 16;
    ctx.drawImage(charImg, cx - cw / 2, cy - ch / 2 + cyOff, cw, ch);
  }

  if (!isBastet && fireImg) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(fireImg, cx + COL_W * 0.28 - 25, cy - GAME_H * 0.26 - 50, 50, 100);
    ctx.restore();
  }

  // Bake the neon plaque right into the tall column sprite
  const bw = COL_W * 0.88;
  const bh = 28;
  const bx = cx - bw / 2;
  const by = cy + GAME_H * 0.36;
  const plaqueGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
  plaqueGrad.addColorStop(0, '#ff007f');
  plaqueGrad.addColorStop(0.5, '#7209b7');
  plaqueGrad.addColorStop(1, '#00b4d8');
  ctx.fillStyle = plaqueGrad;
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = "900 11.5px 'Amarante', 'Cinzel', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isBastet ? 'BASTET 1×3 WILD' : 'ANUBIS 1×3 WILD', cx, by + bh / 2);

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
    const sprites = {}; // Pre-baked exact-size sprites
    let isDisposed = false;

    const spawnParticles = (x, y, count = 18, colorHex = '#00ffff') => {
      const palette = [colorHex, '#ff00ff', '#00ffff', '#39ff14', '#ffea00'];
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

    // Pre-bake static background + 3D top/bottom column shade into ONE static canvas!
    const buildStaticBackdrop = (netImg) => {
      const bgCan = document.createElement('canvas');
      bgCan.width = GAME_W;
      bgCan.height = GAME_H;
      const bCtx = bgCan.getContext('2d');
      if (netImg) {
        bCtx.save();
        bCtx.globalAlpha = 0.58;
        bCtx.drawImage(netImg, 0, 0, GAME_W, GAME_H);
        bCtx.restore();
      }
      sprites.staticBg = bgCan;

      // Pre-bake top/bottom 3D cylinder shadow overlay once
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

    // Load & pre-bake all sprites ONCE
    (async () => {
      const [
        netImg,
        wildGlowImg,
        tallBgImg,
        handFireImg,
        rawAnubisImg,
        rawBastetImg,
      ] = await Promise.all([
        loadImage('/assets/psd/reel_net.png'),
        loadImage('/assets/psd/wild_glow_01.png'),
        loadImage('/assets/psd/anubis_tall_bg.png'),
        loadImage('/assets/psd/anubis_hand_fire.png'),
        loadImage('/assets/characters/anubis_frame.png'),
        loadImage('/assets/neon/character_bastet_neon.jpg'),
      ]);

      if (isDisposed) return;

      if (netImg) buildStaticBackdrop(netImg);

      const keyedBastet = rawBastetImg ? createNeonKeyedCanvas(rawBastetImg, 26, 44) : null;
      const neonAnubis = rawAnubisImg
        ? createBakedSprite(
            rawAnubisImg,
            rawAnubisImg.width,
            rawAnubisImg.height,
            'hue-rotate(22deg) saturate(2.3) brightness(1.1)'
          )
        : null;

      sprites.tallAnubisCol = createBakedTallColumnSprite(
        tallBgImg,
        neonAnubis,
        handFireImg,
        false
      );
      sprites.tallBastetCol = createBakedTallColumnSprite(
        tallBgImg,
        keyedBastet,
        null,
        true
      );

      await Promise.all(
        SYMBOLS.map(async (sym) => {
          const rawImg = await loadImage(sym.image);
          if (!rawImg || isDisposed) return;

          const baseSize = Math.round(sym.isGeneratedNeon ? ROW_H * 0.92 : ROW_H * 1.24);
          let source = rawImg;
          if (sym.isGeneratedNeon) {
            source = createNeonKeyedCanvas(rawImg, 28, 42);
          }

          // If it's the wild symbol and we have wild_glow_01, composite it right into the sprite!
          if (sym.id === 'wild' && wildGlowImg) {
            const comp = document.createElement('canvas');
            comp.width = baseSize;
            comp.height = baseSize;
            const cCtx = comp.getContext('2d');
            cCtx.drawImage(wildGlowImg, 0, 0, baseSize, baseSize);
            if (sym.neonFilter) cCtx.filter = sym.neonFilter;
            cCtx.drawImage(source, 0, 0, baseSize, baseSize);
            sprites[`sym_${sym.id}`] = comp;
            sprites[`win_${sym.id}`] = createBakedSprite(comp, baseSize, baseSize, '', '#00ffff');
          } else {
            const normalSprite = createBakedSprite(
              source,
              baseSize,
              baseSize,
              sym.isGeneratedNeon ? '' : sym.neonFilter || '',
              ''
            );
            const winSprite = createBakedSprite(
              normalSprite,
              baseSize,
              baseSize,
              '',
              '#ff00ff'
            );
            sprites[`sym_${sym.id}`] = normalSprite;
            sprites[`win_${sym.id}`] = winSprite;
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
          targetGrid[c].some((s) => s.isWild || s.id === 'anubis' || s.id === 'eye')
        ) {
          specialCountSoFar++;
        }

        const spinDurationSec = 0.52 + c * 0.23 + (reel.anticipation ? 0.36 : 0);
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

      const hasSpecial =
        reel.willExpand ||
        reel.targetSymbols.some((s) => s.isWild || s.id === 'anubis');

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
                reel.colIndex >= 3 ? '#ff00ff' : '#00ffff'
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

              spawnParticles(reel.centerX, GAME_H * 0.3, 14, '#00ffff');
              spawnParticles(reel.centerX, GAME_H * 0.7, 14, '#ff00ff');

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

    // Ultra-fast 60/120 FPS Render Loop (ZERO ctx.shadowBlur, ZERO per-column ctx.clip!)
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
      const winPulseScale = 1 + 0.08 * Math.sin(now * 0.0085);

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
          ctx.fillStyle = 'rgba(0, 255, 255, 0.14)';
          ctx.fillRect(reel.x, 0, COL_W, GAME_H);
          ctx.strokeStyle = '#00ffff';
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

            const sprite = isWinningCell
              ? sprites[`win_${sym.id}`] || sprites[`sym_${sym.id}`]
              : sprites[`sym_${sym.id}`];

            if (!sprite) continue;

            const sw = sprite.width;
            const sh = sprite.height;

            if (isWinningCell) {
              const dw = sw * winPulseScale;
              const dh = sh * winPulseScale;
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
      });

      // Draw pre-baked 3D top/bottom cylinder shading in 1 single pass
      if (sprites.staticShade) {
        ctx.drawImage(sprites.staticShade, 0, 0);
      }

      // Draw Multi-Layered Payline Lasers (using semi-transparent strokes, NO shadowBlur!)
      if (!anySpinning && wins && wins.length > 0) {
        const activeWin = wins[winIdx % wins.length];
        if (activeWin) {
          const pts = activeWin.line.rows.map((r, c) => ({
            x: c * COL_W + COL_W / 2,
            y: r * ROW_H + ROW_H / 2,
          }));

          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Outer Neon Halo
          ctx.beginPath();
          pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.strokeStyle = activeWin.line.color;
          ctx.lineWidth = 14;
          ctx.globalAlpha = 0.32;
          ctx.stroke();

          // Mid Laser Beam
          ctx.beginPath();
          pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.strokeStyle = activeWin.line.color;
          ctx.lineWidth = 6;
          ctx.globalAlpha = 0.95;
          ctx.stroke();

          // White-Hot Core
          ctx.beginPath();
          pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.2;
          ctx.globalAlpha = 0.95;
          ctx.stroke();

          // Nodes on winning cells
          activeWin.cells.forEach(([c, r]) => {
            const cx = c * COL_W + COL_W / 2;
            const cy = r * ROW_H + ROW_H / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = activeWin.line.color;
            ctx.stroke();
          });

          ctx.restore();
        }
      }

      // Draw lightweight neon spark particles (NO shadowBlur!)
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
