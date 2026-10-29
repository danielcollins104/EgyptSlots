// ============================================================================
// MODULAR SLOT MATH ENGINE (`src/engine/math/SlotMathEngine.js`)
// ============================================================================
// Phase 1 — Math Core:
// 1. Fully decoupled from presentation.
// 2. Evaluates 15 paylines + Scatters with 2× Wild multipliers.
// 3. Mathematical Losses-Disguised-as-Wins (LDW) classification.
// 4. Physical near-miss detection hooks.
// 5. Emits lifecycle events on the SlotEventBus.
// ============================================================================

import { MATH_PAYTABLE, MATH_PAYLINES, WIN_CATEGORIES } from './paytableConfig.js';
import { spinPhysicalReels } from './ReelStripModel.js';
import { slotEventBus } from './EventBus.js';

export class SlotMathEngine {
  constructor(options = {}) {
    this.paytable = options.paytable || MATH_PAYTABLE;
    this.paylines = options.paylines || MATH_PAYLINES;
    this.eventBus = options.eventBus || slotEventBus;
  }

  /**
   * Generates a new random physical spin outcome from reel strips.
   * @param {number} betLevel - Current bet level (1 to 10)
   * @param {Function} [randomFn=Math.random] - RNG function
   * @returns {SlotOutcome}
   */
  spin(betLevel = 1, randomFn = Math.random) {
    const { stops, grid, peeksAbove, peeksBelow } = spinPhysicalReels(randomFn);
    return this.evaluateGrid(grid, betLevel, { stops, peeksAbove, peeksBelow });
  }

  /**
   * Evaluates any 5×3 grid of symbol IDs or symbol objects.
   *
   * @param {(string|object)[][]} grid - 5 columns × 3 rows of symbols
   * @param {number} [betLevel=1] - Multiplier level
   * @param {object} [stripMetadata={}] - Optional stops and peek symbols for near-miss analysis
   * @returns {SlotOutcome}
   */
  evaluateGrid(grid, betLevel = 1, stripMetadata = {}) {
    const COLS = 5;
    const ROWS = 3;
    const totalLines = this.paylines.length;
    const totalBet = totalLines * betLevel;

    // Normalize grid symbols to string IDs and object descriptors
    const rawGrid = grid.map((col) =>
      col.map((cell) => {
        const id = typeof cell === 'string' ? cell : cell?.id || 'neon_10';
        const isWild = id === 'wild' || id === 'anubis' || id === 'wild_expand' || Boolean(cell?.isWild);
        const isBonus = id === 'bonus_chest' || id === 'bonus_crest' || Boolean(cell?.isBonus);
        const isExpanding = id === 'anubis' || id === 'wild_expand' || Boolean(cell?.isExpanding);
        return {
          id,
          name: cell?.name || this.paytable[id]?.name || id,
          isWild,
          isBonus,
          isExpanding,
          payouts: cell?.payouts || this.paytable[id]?.payouts || {},
        };
      })
    );

    const winningLines = [];
    const winningCells = new Set();
    let lineWinsTotal = 0;
    let wildCountOnGrid = 0;
    let scatterCount = 0;
    const scatterPositions = [];

    // Count visible Wilds & Scatters on the 5×3 grid
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const cell = rawGrid[c][r];
        if (cell.isWild) wildCountOnGrid++;
        if (cell.isBonus) {
          scatterCount++;
          scatterPositions.push({ col: c, row: r });
        }
      }
    }

    // 1. Evaluate 15 Left-to-Right Paylines
    for (const line of this.paylines) {
      const lineCells = line.rows.map((row, col) => ({
        col,
        row,
        cell: rawGrid[col][row],
      }));

      // Scatters do not form line wins
      if (lineCells[0].cell.isBonus) continue;

      // Check consecutive pure Wilds starting from column 0
      let pureWildCount = 0;
      for (let c = 0; c < COLS; c++) {
        if (lineCells[c].cell.isWild) {
          pureWildCount++;
        } else {
          break;
        }
      }

      // Check regular symbol match starting from column 0
      let matchSymbolId = null;
      let regularMatchCount = 0;
      let hasWildInRegular = false;

      // Find first non-wild symbol along the line
      for (let c = 0; c < COLS; c++) {
        const cell = lineCells[c].cell;
        if (!cell.isWild && !cell.isBonus) {
          matchSymbolId = cell.id;
          break;
        }
      }

      if (matchSymbolId) {
        for (let c = 0; c < COLS; c++) {
          const cell = lineCells[c].cell;
          if (cell.id === matchSymbolId) {
            regularMatchCount++;
          } else if (cell.isWild) {
            regularMatchCount++;
            hasWildInRegular = true;
          } else {
            break;
          }
        }
      }

      const firstWildCell = lineCells[0]?.cell;
      const wildPaytable = firstWildCell?.payouts || this.paytable[firstWildCell?.id]?.payouts || this.paytable.wild?.payouts || {};
      const pureWildPay = (wildPaytable[pureWildCount] || 0) * betLevel;

      const matchCell = lineCells.find((c) => c.cell.id === matchSymbolId)?.cell;
      const targetSymbolPaytable = matchCell?.payouts || this.paytable[matchSymbolId]?.payouts;
      const basePay = targetSymbolPaytable?.[regularMatchCount] || 0;
      const regularMultiplier = hasWildInRegular ? 2 : 1;
      const regularPay = basePay * regularMultiplier * betLevel;

      if (pureWildPay > 0 && pureWildPay >= regularPay) {
        // Pure Wild win took priority
        lineWinsTotal += pureWildPay;
        const winCells = [];
        for (let c = 0; c < pureWildCount; c++) {
          winningCells.add(`${c}-${line.rows[c]}`);
          winCells.push([c, line.rows[c]]);
        }
        winningLines.push({
          line,
          symbolId: firstWildCell?.id || 'wild',
          symbolName: firstWildCell?.name || '3D Jeweled Pyramid Wild',
          matchCount: pureWildCount,
          isWild: true,
          multiplier: 1,
          lineWin: pureWildPay,
          cells: winCells,
        });
      } else if (regularPay > 0) {
        // Regular line win
        lineWinsTotal += regularPay;
        const winCells = [];
        for (let c = 0; c < regularMatchCount; c++) {
          winningCells.add(`${c}-${line.rows[c]}`);
          winCells.push([c, line.rows[c]]);
        }
        winningLines.push({
          line,
          symbolId: matchSymbolId,
          symbolName: matchCell?.name || this.paytable[matchSymbolId]?.name || matchSymbolId,
          matchCount: regularMatchCount,
          isWild: hasWildInRegular,
          multiplier: regularMultiplier,
          lineWin: regularPay,
          cells: winCells,
        });
      }
    }

    // 2. Evaluate Scatters (3+ anywhere awards payout + triggers 3D Bonus Game)
    let scatterWin = 0;
    const isBonusTriggered = scatterCount >= 3;
    if (isBonusTriggered) {
      const scatterCell = rawGrid.flat().find((c) => c.isBonus);
      const scatterPaytable = scatterCell?.payouts || this.paytable[scatterCell?.id]?.payouts || this.paytable.bonus_chest?.payouts || this.paytable.bonus_crest?.payouts;
      const baseScatterPay = scatterPaytable?.[Math.min(5, scatterCount)] || 0;
      scatterWin = baseScatterPay * betLevel;
      for (const pos of scatterPositions) {
        winningCells.add(`${pos.col}-${pos.row}`);
      }
    }

    const totalWin = lineWinsTotal + scatterWin;
    const payoutRatio = totalBet > 0 ? totalWin / totalBet : 0;

    // 3. Losses-Disguised-as-Wins (LDW) Mathematical Classification
    let winCategory;
    let celebrationTier;

    if (totalWin === 0) {
      winCategory = WIN_CATEGORIES.LOSS;
      celebrationTier = 'none';
    } else if (totalWin < totalBet) {
      // LOSS DISGUISED AS WIN: The player won coins, but net returned less than spin bet!
      winCategory = WIN_CATEGORIES.LDW;
      celebrationTier = 'ldw_subtle';
    } else if (totalWin < 2 * totalBet) {
      winCategory = WIN_CATEGORIES.WIN_SMALL;
      celebrationTier = 'standard';
    } else if (totalWin < 10 * totalBet) {
      winCategory = WIN_CATEGORIES.WIN_MEDIUM;
      celebrationTier = 'super';
    } else if (totalWin < 25 * totalBet) {
      winCategory = WIN_CATEGORIES.WIN_BIG;
      celebrationTier = 'big';
    } else {
      winCategory = WIN_CATEGORIES.WIN_MEGA;
      celebrationTier = 'mega';
    }

    // 4. Physical Near-Miss Detection Hooks
    const nearMiss = this._detectNearMisses({
      scatterCount,
      winningLines,
      peeksAbove: stripMetadata.peeksAbove,
      peeksBelow: stripMetadata.peeksBelow,
      grid: rawGrid,
    });

    // 5. 3D Bonus Collector Meter charges earned on this spin (calibrated 1 charge per special spin)
    const meterChargesEarned = (wildCountOnGrid > 0 ? 1 : 0) + (scatterCount > 0 ? 1 : 0);

    const outcome = {
      grid,
      rawGrid,
      stops: stripMetadata.stops || null,
      betLevel,
      totalBet,
      lineWinsTotal,
      scatterWin,
      totalWin,
      payoutRatio,
      netProfit: totalWin - totalBet,
      isWin: totalWin > 0,
      isNetWin: totalWin >= totalBet,
      isLDW: winCategory === WIN_CATEGORIES.LDW,
      winCategory,
      celebrationTier,
      winningLines,
      winningCells: Array.from(winningCells),
      scatterCount,
      scatterPositions,
      isBonusTriggered,
      meterChargesEarned,
      nearMiss,
    };

    // Emit lifecycle events on the bus
    this.eventBus.emit('outcome:evaluated', outcome);

    if (nearMiss.isNearMiss) {
      this.eventBus.emit('near_miss:detected', nearMiss);
    }
    if (outcome.isLDW) {
      this.eventBus.emit('win:ldw', outcome);
    }
    if (winCategory === WIN_CATEGORIES.WIN_BIG) {
      this.eventBus.emit('win:big', outcome);
    }
    if (winCategory === WIN_CATEGORIES.WIN_MEGA) {
      this.eventBus.emit('win:mega', outcome);
    }
    if (isBonusTriggered) {
      this.eventBus.emit('feature:bonus_triggered', outcome);
    }

    return outcome;
  }

  /**
   * Internal hook to detect near-misses (e.g. 2 Scatters on screen with 3rd on adjacent peek stop).
   */
  _detectNearMisses({ scatterCount, winningLines, peeksAbove, peeksBelow }) {
    const nearMiss = {
      isNearMiss: false,
      type: null, // 'bonus_scatters' | 'five_of_a_kind'
      reelsInvolved: [],
      description: null,
    };

    // A) Bonus Near-Miss: exactly 2 scatters visible on screen, and 3rd scatter was 1 stop away
    if (scatterCount === 2 && peeksAbove && peeksBelow) {
      for (let c = 2; c < 5; c++) {
        if (peeksAbove[c] === 'bonus_crest' || peeksBelow[c] === 'bonus_crest') {
          nearMiss.isNearMiss = true;
          nearMiss.type = 'bonus_scatters';
          nearMiss.reelsInvolved = [c];
          nearMiss.description = `2 Scatters on reels; 3rd Scatter stopped 1 position off on Reel ${c + 1}!`;
          break;
        }
      }
    }

    // B) 5-of-a-Kind Near-Miss: 4-of-a-kind on high symbol, 5th reel stopped 1 away
    if (!nearMiss.isNearMiss && peeksAbove && peeksBelow) {
      const fourOfAKind = winningLines.find((w) => w.matchCount === 4 && !w.isWild);
      if (fourOfAKind) {
        const targetSym = fourOfAKind.symbolId;
        if (peeksAbove[4] === targetSym || peeksBelow[4] === targetSym) {
          nearMiss.isNearMiss = true;
          nearMiss.type = 'five_of_a_kind';
          nearMiss.reelsInvolved = [4];
          nearMiss.description = `4-of-a-kind on ${fourOfAKind.symbolName}; 5th matching symbol 1 stop off on Reel 5!`;
        }
      }
    }

    return nearMiss;
  }
}

export const slotMathEngine = new SlotMathEngine();
