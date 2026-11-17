// Creates a staff account (SUPPORT | FINANCE | ADMIN). Never exposed over HTTP.
// Usage: DC_STAFF_PASSWORD='...14+ chars...' node scripts/create-staff.js you@company.com ADMIN "Your Name"
import { createFinance } from '../server/finance/index.js';

const [email, role, name] = process.argv.slice(2);
const password = process.env.DC_STAFF_PASSWORD;
if (!email || !role || !password) {
  console.error("Usage: DC_STAFF_PASSWORD='...' node scripts/create-staff.js <email> <SUPPORT|FINANCE|ADMIN> [name]");
  process.exit(1);
}
const f = createFinance();
const id = f.accounts.createStaff({ email, password, name, role });
console.log(`Created ${role} account ${email} (${id}). Staff sessions last 2h; sensitive actions require password step-up.`);
