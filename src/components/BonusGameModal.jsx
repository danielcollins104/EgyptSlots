import React, { useState, useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import { Sparkles, Flame, Compass, Gem, CheckCircle2, RotateCw } from 'lucide-react';
import { BONUS_CONFIG, BONUS_JACKPOT_TIERS } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import PsdGoldNumber from './PsdGoldNumber';

function buildVaultBoard(currentBet) {
  const styles = BONUS_CONFIG.vaultTileStyles;
  const pool = BONUS_CONFIG.vaultPrizeTemplates.map((tpl) => ({
    ...tpl,
    baseCoins: currentBet * tpl.betMult,
  }));

  // Shuffle Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.map((prize, idx) => {
    const style = styles[idx % styles.length];
    return {
      id: idx,
      ...style,
      prize,
      picked: false,
      awardedCoins: 0,
    };
  });
}

export default function BonusGameModal({
  bonusSession,
  currentBet,
  coinValue,
  currencyMode = 'GC',
  onCompleteBonus,
}) {
  const [activeTab, setActiveTab] = useState('vault'); // 'vault' | 'wheel'
  const [picksLeft, setPicksLeft] = useState(bonusSession?.initialPicks || 3);
  const [vaultMultiplier, setVaultMultiplier] = useState(bonusSession?.startingMultiplier || 1);
  const [vaultTiles, setVaultTiles] = useState([]);
  const [vaultWinCoins, setVaultWinCoins] = useState(0);
  const [wonJackpots, setWonJackpots] = useState([]);
  const [vaultBanner, setVaultBanner] = useState(BONUS_CONFIG.vaultDefaultBanner);

  // Fortune Wheel State
  const [wheelSpinsLeft, setWheelSpinsLeft] = useState(bonusSession?.wheelSpins || 1);
  const [wheelMultiplier, setWheelMultiplier] = useState(bonusSession?.startingMultiplier || 1);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelWinCoins, setWheelWinCoins] = useState(0);
  const [wheelBanner, setWheelBanner] = useState(BONUS_CONFIG.wheelDefaultBanner);
  const [activeWedgeIdx, setActiveWedgeIdx] = useState(null);

  const wheelCanvasRef = useRef(null);
  const wheelRotationRef = useRef({ deg: 0 });
  const wedges = BONUS_CONFIG.wheelWedges;

  useEffect(() => {
    if (!bonusSession) return;
    setActiveTab(bonusSession.defaultGame || 'vault');
    setPicksLeft(bonusSession.initialPicks || 3);
    setVaultMultiplier(bonusSession.startingMultiplier || 1);
    setVaultTiles(buildVaultBoard(currentBet));
    setVaultWinCoins(0);
    setWonJackpots([]);
    setVaultBanner(
      `UNLOCKED VIA ${bonusSession.triggerReason}! PICK ${
        bonusSession.initialPicks || 3
      } 3D TILES OR SPIN THE 3D WHEEL!`
    );

    setWheelSpinsLeft(bonusSession.wheelSpins || 1);
    setWheelMultiplier(bonusSession.startingMultiplier || 1);
    setWheelSpinning(false);
    setWheelWinCoins(0);
    setActiveWedgeIdx(null);
    wheelRotationRef.current.deg = 0;
  }, [bonusSession, currentBet]);

  // Draw the 3D Brushed-Gold & Cabochon-Gemstone Fortune Wheel onto Canvas
  useEffect(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.45;
    const sliceRad = (Math.PI * 2) / wedges.length;

    ctx.clearRect(0, 0, size, size);

    // Outer 3D Gold Bezel Rim
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;

    const rimGrad = ctx.createLinearGradient(-outerR, -outerR, outerR, outerR);
    rimGrad.addColorStop(0, '#fffbeb');
    rimGrad.addColorStop(0.25, '#fde047');
    rimGrad.addColorStop(0.55, '#d97706');
    rimGrad.addColorStop(0.85, '#78350f');
    rimGrad.addColorStop(1, '#fef08a');

    ctx.beginPath();
    ctx.arc(0, 0, outerR + 14, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.restore();

    // Draw the 12 Jewel-Toned Velvet Wedges
    wedges.forEach((w, i) => {
      const startAngle = -Math.PI / 2 - sliceRad / 2 + i * sliceRad;
      const endAngle = startAngle + sliceRad;
      const midAngle = (startAngle + endAngle) / 2;

      ctx.save();
      ctx.translate(cx, cy);

      const wGrad = ctx.createRadialGradient(0, 0, outerR * 0.15, 0, 0, outerR);
      wGrad.addColorStop(0, w.bgEnd);
      wGrad.addColorStop(0.7, w.bgStart);
      wGrad.addColorStop(1, '#090214');

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, outerR, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = wGrad;
      ctx.fill();

      // Brushed 24k Gold Rib Divider
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fde047';
      ctx.stroke();

      // Highlight active winning wedge
      if (activeWedgeIdx === i) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // Draw Perimeter Cabochon Gemstone on the outer gold bezel for this wedge
      const gx = Math.cos(midAngle) * (outerR + 7);
      const gy = Math.sin(midAngle) * (outerR + 7);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = w.gemColor;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#fffbeb';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-2, -2, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = w.gemHi;
      ctx.fill();
      ctx.restore();

      // Draw Wedge Text & Multiplier
      ctx.rotate(midAngle);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const displayMult =
        w.type === 'coins' ? `${w.mult * wheelMultiplier}× BET` : w.label;

      ctx.font = "900 13.5px 'Cinzel Decorative', 'Amarante', 'Cinzel', serif";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#090214';
      ctx.strokeText(displayMult, outerR - 18, 0);
      ctx.fillStyle = w.type === 'jackpot' || w.type === 'upgrade' ? '#fde047' : '#ffffff';
      ctx.fillText(displayMult, outerR - 18, 0);

      ctx.restore();
    });

    // Inner Gold Ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fde047';
    ctx.stroke();
    ctx.restore();
  }, [wedges, wheelMultiplier, activeWedgeIdx]);

  const jackpotsWithValues = useMemo(() => {
    return BONUS_JACKPOT_TIERS.map((tier) => ({
      ...tier,
      coins: tier.baseMultiplier * currentBet,
    }));
  }, [currentBet]);

  if (!bonusSession) return null;

  const totalCombinedBonusWin =
    (bonusSession.scatterWinCoins || 0) + vaultWinCoins + wheelWinCoins;

  const handlePickTile = (tileId) => {
    if (picksLeft <= 0) return;
    const target = vaultTiles.find((t) => t.id === tileId);
    if (!target || target.picked) return;

    const { prize } = target;
    let nextMult = vaultMultiplier;
    let nextPicks = picksLeft - 1;

    if (prize.kind === 'multiplier') {
      nextMult = vaultMultiplier + prize.multAdd;
      nextPicks += prize.extraPicks;
      soundEngine.playBonusPick(true);
    } else if (prize.kind === 'extra_picks') {
      nextPicks += prize.extraPicks;
      soundEngine.playBonusPick(true);
    } else if (prize.kind === 'jackpot') {
      soundEngine.playWin(true);
      setWonJackpots((prev) => [...prev, prize.jackpotId]);
    } else {
      soundEngine.playBonusPick(false);
    }

    const wonCoins =
      prize.kind === 'jackpot'
        ? prize.baseCoins
        : Math.round(prize.baseCoins * nextMult);

    setVaultMultiplier(nextMult);
    setPicksLeft(nextPicks);
    setVaultWinCoins((prev) => prev + wonCoins);

    setVaultTiles((prev) =>
      prev.map((t) =>
        t.id === tileId
          ? {
              ...t,
              picked: true,
              awardedCoins: wonCoins,
            }
          : t
      )
    );

    if (prize.kind === 'multiplier') {
      setVaultBanner(
        `${prize.label} VAULT MULTIPLIER UPGRADED TO ${nextMult}× + ${wonCoins.toLocaleString()} COINS!`
      );
    } else if (prize.kind === 'extra_picks') {
      setVaultBanner(
        `${BONUS_CONFIG.vaultExtraPicksBlessing} ${prize.label} + ${wonCoins.toLocaleString()} COINS!`
      );
    } else if (prize.kind === 'jackpot') {
      setVaultBanner(
        `JACKPOT UNLOCKED! ${prize.label} PAID ${wonCoins.toLocaleString()} COINS!`
      );
    } else {
      setVaultBanner(
        `REVEALED ${target.title.toUpperCase()}: +${wonCoins.toLocaleString()} COINS (${nextMult}× MULT)!`
      );
    }
  };

  const handleSpinWheel = () => {
    if (wheelSpinning || wheelSpinsLeft <= 0) return;
    setWheelSpinning(true);
    setActiveWedgeIdx(null);
    setWheelSpinsLeft((prev) => Math.max(0, prev - 1));
    soundEngine.playSpinStart();

    const chosenIdx = Math.floor(Math.random() * wedges.length);
    const sliceDeg = 360 / wedges.length;
    const currentDeg = wheelRotationRef.current.deg;
    const targetMod = (360 - chosenIdx * sliceDeg) % 360;
    const currentMod = ((currentDeg % 360) + 360) % 360;
    let deltaDeg = targetMod - currentMod;
    if (deltaDeg <= 0) deltaDeg += 360;

    const fullSpins = (5 + Math.floor(Math.random() * 2)) * 360;
    const finalDeg = currentDeg + fullSpins + deltaDeg;

    let lastTickStep = Math.floor(currentDeg / sliceDeg);

    gsap.to(wheelRotationRef.current, {
      deg: finalDeg,
      duration: 4.1,
      ease: 'power4.out',
      onUpdate: () => {
        const degNow = wheelRotationRef.current.deg;
        if (wheelCanvasRef.current) {
          wheelCanvasRef.current.style.transform = `rotate(${degNow}deg)`;
        }
        const stepNow = Math.floor(degNow / sliceDeg);
        if (stepNow !== lastTickStep) {
          lastTickStep = stepNow;
          soundEngine.playWheelTick(stepNow % 6);
        }
      },
      onComplete: () => {
        setWheelSpinning(false);
        setActiveWedgeIdx(chosenIdx);
        const wedge = wedges[chosenIdx];

        if (wedge.type === 'upgrade') {
          const nextWMult = wheelMultiplier * 2;
          setWheelMultiplier(nextWMult);
          setWheelSpinsLeft((prev) => prev + 1);
          soundEngine.playBonusTrigger();
          setWheelBanner(
            `${BONUS_CONFIG.wheelUpgradeBannerPrefix} ${nextWMult}× + 1 FREE RESPIN!`
          );
        } else if (wedge.type === 'jackpot') {
          const jpCoins = wedge.mult * currentBet;
          setWheelWinCoins((prev) => prev + jpCoins);
          setWonJackpots((prev) => [...prev, wedge.jackpotId]);
          soundEngine.playWin(true);
          setWheelBanner(
            `${BONUS_CONFIG.wheelJackpotBannerPrefix} ${wedge.label} AWARDED +${jpCoins.toLocaleString()} COINS!`
          );
        } else {
          const winAmt = wedge.mult * wheelMultiplier * currentBet;
          setWheelWinCoins((prev) => prev + winAmt);
          soundEngine.playWin(winAmt >= currentBet * 40);
          setWheelBanner(
            `WHEEL LANDED ON ${wedge.mult * wheelMultiplier}× BET: +${winAmt.toLocaleString()} COINS!`
          );
        }
      },
    });
  };

  return (
    <div className="bonus-modal-backdrop">
      <div className="bonus-modal-cabinet">
        {/* Top Header & 4 Progressive 3D Cabochon Jackpot Meters */}
        <div className="bonus-modal-header">
          <div className="bonus-header-title-row">
            <div className="bonus-title-badge">
              <Sparkles size={18} />
              <span>{BONUS_CONFIG.modalTitle}</span>
            </div>

            <div className="bonus-game-tabs">
              <button
                className={`bonus-tab-btn ${activeTab === 'vault' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(560);
                  setActiveTab('vault');
                }}
              >
                <Gem size={15} />
                <span>
                  {BONUS_CONFIG.game1TabLabel} ({picksLeft} Picks)
                </span>
              </button>
              <button
                className={`bonus-tab-btn ${activeTab === 'wheel' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(620);
                  setActiveTab('wheel');
                }}
              >
                <Compass size={15} />
                <span>
                  {BONUS_CONFIG.game2TabLabel} ({wheelSpinsLeft} Spins)
                </span>
              </button>
            </div>
          </div>

          <div className="bonus-jackpot-bar">
            {jackpotsWithValues.map((jp) => {
              const isHit = wonJackpots.includes(jp.id);
              return (
                <div
                  key={jp.id}
                  className={`bonus-jackpot-card jp-${jp.id} ${isHit ? 'jp-hit-glow' : ''}`}
                >
                  <img
                    src={jp.icon}
                    alt={jp.label}
                    className="jp-floating-3d-icon"
                    draggable={false}
                  />
                  <div className="jp-card-info">
                    <span className="jp-tier-label">{jp.label}</span>
                    <span className="jp-tier-coins">{jp.coins.toLocaleString()} COINS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GAME 1: 3D POP-OUT PICK VAULT (12 TILES) */}
        {activeTab === 'vault' && (
          <div className="bonus-vault-stage">
            <div className="bonus-stats-ribbon">
              <div className="bonus-stat-pill">
                <span>VAULT PICKS LEFT</span>
                <strong>{picksLeft}</strong>
              </div>
              <div className="bonus-stat-pill mult-pill">
                <span>ACTIVE VAULT MULTIPLIER</span>
                <strong>{vaultMultiplier}×</strong>
              </div>
              <div className="bonus-stat-pill">
                <span>SCATTER TRIGGER BONUS</span>
                <strong>+{(bonusSession.scatterWinCoins || 0).toLocaleString()}</strong>
              </div>
            </div>

            <div className="bonus-live-banner">
              <Flame size={16} />
              <span>{vaultBanner}</span>
            </div>

            <div className="vault-3d-grid">
              {vaultTiles.map((tile) => {
                const isRevealed = tile.picked || picksLeft === 0;
                const isUnpickedReveal = !tile.picked && picksLeft === 0;

                return (
                  <button
                    key={tile.id}
                    className={`vault-3d-tile ${tile.tileClass} ${
                      tile.picked ? 'tile-picked-win' : ''
                    } ${isUnpickedReveal ? 'tile-unpicked-dim' : ''}`}
                    onClick={() => handlePickTile(tile.id)}
                    disabled={tile.picked || picksLeft <= 0}
                  >
                    <div className="vault-tile-velvet-cushion">
                      <span className="corner-gem tl" />
                      <span className="corner-gem tr" />
                      <span className="corner-gem bl" />
                      <span className="corner-gem br" />
                    </div>

                    <div
                      className="vault-tile-pop-artifact"
                      style={{ '--tile-tilt': tile.tilt }}
                    >
                      <img
                        src={tile.art}
                        alt={tile.title}
                        className="vault-pop-img"
                        draggable={false}
                      />
                    </div>

                    {isRevealed ? (
                      <div className="vault-prize-overlay">
                        <span className="vault-prize-tag">{tile.prize.label}</span>
                        <div className="vault-prize-digits">
                          <PsdGoldNumber
                            value={
                              tile.picked
                                ? tile.awardedCoins
                                : tile.prize.baseCoins * vaultMultiplier
                            }
                            height={22}
                            gap={-2}
                          />
                        </div>
                        <span className="vault-coins-unit">COINS</span>
                      </div>
                    ) : (
                      <div className="vault-tile-caption">
                        <span>{tile.title}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* GAME 2: 3D CABOCHON FORTUNE WHEEL */}
        {activeTab === 'wheel' && (
          <div className="bonus-wheel-stage">
            <div className="bonus-stats-ribbon">
              <div className="bonus-stat-pill">
                <span>WHEEL SPINS LEFT</span>
                <strong>{wheelSpinsLeft}</strong>
              </div>
              <div className="bonus-stat-pill mult-pill">
                <span>WHEEL WEDGE MULTIPLIER</span>
                <strong>{wheelMultiplier}×</strong>
              </div>
              <div className="bonus-stat-pill">
                <span>WHEEL WINNINGS</span>
                <strong>+{wheelWinCoins.toLocaleString()} COINS</strong>
              </div>
            </div>

            <div className="bonus-live-banner">
              <Sparkles size={16} />
              <span>{wheelBanner}</span>
            </div>

            <div className="wheel-chamber-layout">
              <div className="wheel-canvas-container">
                <div className="wheel-top-pointer">▼</div>

                <canvas
                  ref={wheelCanvasRef}
                  width={420}
                  height={420}
                  className="kemet-wheel-canvas"
                />

                <button
                  className="wheel-center-scarab-btn"
                  onClick={handleSpinWheel}
                  disabled={wheelSpinning || wheelSpinsLeft <= 0}
                  title="Click to Spin the 3D Fortune Wheel!"
                >
                  <img
                    src={BONUS_CONFIG.wheelCenterIcon}
                    alt="Spin Wheel"
                    className="wheel-center-scarab-img"
                    draggable={false}
                  />
                  <span>{wheelSpinning ? 'SPINNING' : 'SPIN'}</span>
                </button>
              </div>

              <div className="wheel-controls-panel">
                <h3>{BONUS_CONFIG.wheelTitle}</h3>
                <p>{BONUS_CONFIG.wheelDescription}</p>

                <button
                  className="wheel-spin-cta-btn"
                  onClick={handleSpinWheel}
                  disabled={wheelSpinning || wheelSpinsLeft <= 0}
                >
                  <RotateCw size={18} className={wheelSpinning ? 'spin-icon-anim' : ''} />
                  <span>
                    {wheelSpinning
                      ? '3D FORTUNE WHEEL SPINNING...'
                      : wheelSpinsLeft > 0
                      ? `SPIN 3D FORTUNE WHEEL (${wheelSpinsLeft} LEFT)`
                      : 'ALL WHEEL SPINS COMPLETED'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer: Total Bonus Payout & Collect Button */}
        <div className="bonus-modal-footer">
          <div className="bonus-total-summary">
            <span className="bonus-total-label">
              TOTAL BONUS FEATURE WINNINGS ({currencyMode === 'SC' ? 'SWEEPS COINS' : 'GOLD COINS'}):
            </span>
            <div className="bonus-total-digits">
              <PsdGoldNumber value={totalCombinedBonusWin} height={32} gap={-2} />
            </div>
            <span className="bonus-total-usd">
              ({currencyMode === 'SC'
                ? `$${Number(totalCombinedBonusWin).toFixed(2)} USD PRIZE VALUE`
                : `$${(totalCombinedBonusWin * coinValue).toFixed(2)}`}
              )
            </span>
          </div>

          <div className="bonus-footer-actions">
            {picksLeft > 0 && activeTab === 'wheel' && (
              <button
                className="bonus-switch-game-btn"
                onClick={() => setActiveTab('vault')}
              >
                <Gem size={16} />
                <span>Use {picksLeft} Vault Picks</span>
              </button>
            )}
            {wheelSpinsLeft > 0 && activeTab === 'vault' && (
              <button
                className="bonus-switch-game-btn"
                onClick={() => setActiveTab('wheel')}
              >
                <Compass size={16} />
                <span>Use {wheelSpinsLeft} Wheel Spin!</span>
              </button>
            )}

            <button
              className="bonus-collect-btn"
              onClick={() => {
                soundEngine.playWin(true);
                onCompleteBonus(totalCombinedBonusWin);
              }}
              disabled={wheelSpinning}
            >
              <CheckCircle2 size={18} />
              <span>
                COLLECT {totalCombinedBonusWin.toLocaleString()} {currencyMode === 'SC' ? 'SC' : 'COINS'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
