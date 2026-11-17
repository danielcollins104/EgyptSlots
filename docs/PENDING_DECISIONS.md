# Pending decisions (NOT implemented — waiting for the owner's go-ahead)

## SC-bundling / "purchase necessary" risk — chosen direction: **Option 2 (reduced, de-emphasised SC bonus)**
Decided 2026-11-16. **Do not implement until the owner says so.**

Problem: packages currently grant SC >= the USD price (e.g. $4.99 -> 5.00 SC; custom packs up to +25%), and the copy markets
"Free Redeemable SC", "Save $X", "+5% BONUS SC". Regulators may read this as buying redeemable prize value.

Planned work when approved:
1. Price Gold Coin packages on their own value; make the SC bonus materially smaller than the price and never > 1:1
   (drop the VIP "+% SC" tiers and the custom-amount SC formula in `calculateCustomPackage`).
2. Make the bonus ratio configurable per package on the server (`resolvePackage` in `server/finance/payments.js`) so counsel can
   lower it or set it to 0 (Option 1, fully decoupled) without code changes.
3. Rewrite purchase-screen copy: "Gold Coin package — includes free bonus Sweeps Coins, no purchase necessary"; remove
   "Free Redeemable SC", "Save $X", "+% bonus SC", "1 SC = $1" from purchase surfaces (`sweepstakesConfig.js`, `CashierModal.jsx`, `LowBalanceOfferModal`).
4. Add an equal free-entry request (mail-in/web form) granting the same SC as the smallest package, per-person limited, via the server promo path
   (today the daily AMOE gives 0.20 SC vs 5.00 SC for a $4.99 pack — a parity gap regulators check).
5. Have gaming counsel review the final ratio together with the Minnesota situation and the blocked-state list.

Reminder: the assistant should bring this up again (a reminder timer was set; if the session ended, raise it at the next session).
