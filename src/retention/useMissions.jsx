import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine.js';
import {
  MISSIONS_CONFIG,
  loadMissionsState,
  saveMissionsState,
  recordSpin as recordSpinCore,
  claimMission as claimMissionCore,
  claimTrio as claimTrioCore,
  getMissionsView,
} from './missions.js';

/**
 * useMissions — daily retention hook for App.jsx.
 *
 *   const missions = useMissions({
 *     userId: currentUser?.id,
 *     onAward: ({ gc, sc }) => creditWallet(gc, sc),  // SAME credit path as handleClaimDailyBonus
 *   });
 *   // inside the spin-evaluated effect (near the FLOW MOMENTUM block):
 *   missions.recordSpin({ mode: currencyMode, winAmount: totalCoinsWon, betAmount: currentBet, bonusTriggered });
 *   // in JSX, next to the daily claim button:
 *   <MissionsPanel api={missions} />
 */
export function useMissions({ userId = null, onAward = null, storage = undefined } = {}) {
  const userKey = userId || 'guest';
  const initialLoadRef = useRef(null);
  if (initialLoadRef.current === null) {
    initialLoadRef.current = loadMissionsState(userKey, storage);
  }
  const [state, setState] = useState(initialLoadRef.current.state);
  const [comebackDue, setComebackDue] = useState(initialLoadRef.current.comebackDue);
  const loadedUserRef = useRef(userKey);
  const onAwardRef = useRef(onAward);
  onAwardRef.current = onAward;

  useEffect(() => {
    if (loadedUserRef.current === userKey) return;
    loadedUserRef.current = userKey;
    const { state: s, comebackDue: cb } = loadMissionsState(userKey, storage);
    setState(s);
    setComebackDue(cb);
  }, [userKey, storage]);

  const commit = useCallback((next) => {
    setState(next);
    saveMissionsState(userKey, next, storage);
  }, [userKey, storage]);

  const recordSpin = useCallback((result) => {
    setState((prev) => {
      const { state: next, events } = recordSpinCore(prev, result);
      if (events.length > 0) {
        try { soundEngine.playFlowStreak?.(3); } catch (_) {}
      }
      saveMissionsState(userKey, next, storage);
      return next;
    });
  }, [userKey, storage]);

  const award = useCallback((reward) => {
    if (onAwardRef.current) {
      try { onAwardRef.current(reward); } catch (e) { console.error('[missions] onAward failed:', e); }
    }
  }, []);

  const claim = useCallback((missionId) => {
    const res = claimMissionCore(state, missionId);
    if (res.error) return res;
    commit(res.state);
    try { soundEngine.playBonusTrigger?.(); } catch (_) {}
    award(res.reward);
    return res;
  }, [state, commit, award]);

  const claimTrio = useCallback(() => {
    const res = claimTrioCore(state);
    if (res.error) return res;
    commit(res.state);
    try { soundEngine.playWinCelebration?.('super'); } catch (_) {}
    award(res.reward);
    return res;
  }, [state, commit, award]);

  const dismissComeback = useCallback(() => setComebackDue(false), []);

  const view = useMemo(() => getMissionsView(state), [state]);

  return { view, recordSpin, claim, claimTrio, comebackDue, dismissComeback, config: MISSIONS_CONFIG };
}

export default useMissions;
