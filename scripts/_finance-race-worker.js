// Worker used by test-finance.js: independent DB connections racing to debit the same wallet.
import { parentPort, workerData } from 'node:worker_threads';
import { createFinance } from '../server/finance/index.js';

const f = createFinance({ dbFile: workerData.file, config: { game: { minSpinIntervalMs: 0 } } });
let ok = 0;
let rejected = 0;
for (let i = 0; i < 8; i++) {
  try {
    f.db.tx(() => {
      f.ledger.post({ userId: workerData.userId, type: 'RACE_BET', currency: 'SC', amount: -100, idempotencyKey: `race:${workerData.id}:${i}` });
    });
    ok++;
  } catch (e) {
    if (e.code === 'INSUFFICIENT_FUNDS') rejected++; else throw e;
  }
}
f.db.close();
parentPort.postMessage({ ok, rejected });
