import { loadConfig } from './config.js';
import { Db } from './db.js';
import { Ledger, AuditLog } from './ledger.js';
import { Accounts } from './accounts.js';
import { PaymentService } from './payments.js';
import { CryptoGateway } from './crypto.js';
import { RedemptionService } from './redemptions.js';
import { SpinService } from './spin.js';
import { AdminService } from './admin.js';
import { createSquareCatalog } from './squareCatalog.js';

/**
 * Composition root for the server-authoritative finance backend.
 * @param {object} [opts] { env, config (overrides), dbFile, fetchImpl, rpcFactory }
 */
export function createFinance(opts = {}) {
  const config = loadConfig(opts.env || process.env, opts.config || {});
  const db = new Db(opts.dbFile ?? config.dbPath);
  const ledger = new Ledger(db, config.ledgerSecret);
  const audit = new AuditLog(db, config.ledgerSecret);
  const accounts = new Accounts({ db, ledger, audit, config });
  const payments = new PaymentService({ db, ledger, audit, accounts, config, fetchImpl: opts.fetchImpl });
  const gateway = new CryptoGateway({ db, payments, audit, config, rpcFactory: opts.rpcFactory });
  const redemptions = new RedemptionService({ db, ledger, audit, accounts, config, gateway });
  const spins = new SpinService({ db, ledger, accounts, config });
  const admin = new AdminService({ db, ledger, audit, accounts, payments, redemptions, gateway, config });
  const squareCatalog = createSquareCatalog({ config, fetchImpl: opts.fetchImpl, audit });
  return { config, db, ledger, audit, accounts, payments, gateway, redemptions, spins, admin, squareCatalog };
}
