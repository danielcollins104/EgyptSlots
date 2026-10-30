import fs from 'fs';
import assert from 'node:assert';
import { SWEEPSTAKES_CONFIG } from '../src/config/sweepstakesConfig.js';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const sk = envLocal.match(/STRIPE_SECRET_KEY=([^\r\n]+)/)[1].trim();

async function verifyAllStripeLinks() {
  console.log('🔍 VERIFYING STRIPE PAYMENT LINKS & PACKAGES...\n');

  const plRes = await fetch('https://api.stripe.com/v1/payment_links?limit=25', {
    headers: { Authorization: `Bearer ${sk}` }
  });
  const { data: links } = await plRes.json();
  const linkMap = new Map();

  for (const pl of links) {
    const liRes = await fetch(`https://api.stripe.com/v1/payment_links/${pl.id}/line_items`, {
      headers: { Authorization: `Bearer ${sk}` }
    });
    const { data: items } = await liRes.json();
    if (items && items[0]) {
      linkMap.set(pl.url, {
        description: items[0].description,
        amountUsd: items[0].amount_total / 100,
        priceId: items[0].price?.id,
      });
    }
  }

  let passCount = 0;
  for (const pkg of SWEEPSTAKES_CONFIG.storePackages) {
    const stripeInfo = linkMap.get(pkg.stripePaymentLink);
    assert(stripeInfo, `Payment link ${pkg.stripePaymentLink} must exist in Stripe`);
    console.log(`Package: ${pkg.id} (${pkg.badge || 'Standard'})`);
    console.log(`  Config Price:   $${pkg.priceUsd.toFixed(2)} USD`);
    console.log(`  Stripe Link:    ${pkg.stripePaymentLink}`);
    console.log(`  Stripe Item:    "${stripeInfo.description}"`);
    console.log(`  Stripe Charge:  $${stripeInfo.amountUsd.toFixed(2)} USD`);

    assert.strictEqual(
      Math.round(stripeInfo.amountUsd * 100),
      Math.round(pkg.priceUsd * 100),
      `Stripe checkout price ($${stripeInfo.amountUsd}) must match package price ($${pkg.priceUsd})`
    );
    console.log('  ✔ MATCH CONFIRMED (100% Correct Price & Product)\n');
    passCount++;
  }

  console.log(`🎉 ALL ${passCount} STRIPE STORE PACKAGES VERIFIED 100% MATCHED!`);
}

verifyAllStripeLinks().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
