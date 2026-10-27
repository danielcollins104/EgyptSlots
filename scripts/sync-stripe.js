// Automated Stripe Price & Product Sync Script
// Fetches your Stripe products and automatically inserts their price IDs into sweepstakesConfig.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const secretKey = process.argv[2] || process.env.STRIPE_SECRET_KEY;

if (!secretKey || !secretKey.startsWith('sk_')) {
  console.error('\x1b[31mError: Please provide your Stripe Secret Key.\x1b[0m');
  console.log('Usage: node scripts/sync-stripe.js sk_test_YOUR_SECRET_KEY');
  process.exit(1);
}

async function syncStripe() {
  console.log('\x1b[36m[Stripe Sync] Connecting to Stripe API...\x1b[0m');

  const res = await fetch('https://api.stripe.com/v1/products?limit=25&active=true', {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('\x1b[31mStripe API Error:\x1b[0m', errText);
    process.exit(1);
  }

  const { data: products } = await res.json();
  console.log(`\x1b[32m[Stripe Sync] Found ${products.length} products in your Stripe catalog.\x1b[0m`);

  const configPath = path.join(__dirname, '..', 'src', 'config', 'sweepstakesConfig.js');
  let configContent = fs.readFileSync(configPath, 'utf8');

  let updatedCount = 0;

  for (const prod of products) {
    const packageId = prod.metadata?.package_id;
    const defaultPrice = prod.default_price;

    if (!defaultPrice) continue;

    console.log(` -> Matched: "${prod.name}" => ${defaultPrice} (Package: ${packageId || 'custom'})`);

    // Replace or insert stripePriceId into the corresponding package entry
    if (packageId) {
      const matchPkg = new RegExp(`(id:\\s*['"]${packageId}['"][\\s\\S]*?freeSweepsCoins:[^,\\n]+,?)(\\s*(?:stripePriceId:[^,\\n]+,?)?)`, 'g');
      if (matchPkg.test(configContent)) {
        configContent = configContent.replace(
          new RegExp(`(id:\\s*['"]${packageId}['"][\\s\\S]*?freeSweepsCoins:[^,\\n]+,?)(\\s*stripePriceId:\\s*['"][^'"]+['"],?)?`, 'g'),
          `$1\n      stripePriceId: '${defaultPrice}',`
        );
        updatedCount++;
      }
    }
  }

  fs.writeFileSync(configPath, configContent, 'utf8');
  console.log(`\x1b[32m✔ Successfully updated ${updatedCount} packages in sweepstakesConfig.js with their live Stripe Price IDs!\x1b[0m`);
}

syncStripe().catch((err) => {
  console.error('Fatal sync error:', err);
});
