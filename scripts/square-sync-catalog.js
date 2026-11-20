// Sync game packages into the Square Catalog (uses SQUARE_* env; sandbox unless SQUARE_ENVIRONMENT=production).
import { createFinance } from '../server/finance/index.js';

const f = createFinance();
try {
  const res = await f.squareCatalog.sync(f.db);
  console.log(`[square:sync] ${res.count} packages synced (${f.config.providers.square.environment}) at ${res.at}`);
} finally {
  f.db.close();
}
