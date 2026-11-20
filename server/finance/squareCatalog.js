import crypto from 'node:crypto';
import { SWEEPSTAKES_CONFIG } from '../../src/config/sweepstakesConfig.js';

/** Every purchasable package, from the same server-side source of truth the cashier uses. */
export const allPackages = () => [
  ...(SWEEPSTAKES_CONFIG.storePackages || []),
  ...(SWEEPSTAKES_CONFIG.featuredRoyalPackage ? [SWEEPSTAKES_CONFIG.featuredRoyalPackage] : []),
  ...(SWEEPSTAKES_CONFIG.highRollerPackages || []),
  ...(SWEEPSTAKES_CONFIG.rescuePackages || []),
];

/**
 * Square Catalog sync. Creates or updates one Catalog ITEM (+ one FIXED-price ITEM_VARIATION)
 * per game package. Mapping (package_id -> catalog ids) is persisted in square_catalog_items so
 * re-runs UPDATE in place and never create duplicates. Product copy is honest: Gold Coins are
 * described as social-play items with no cash value — do not change wording to disguise the model.
 */
export function createSquareCatalog({ config, fetchImpl = globalThis.fetch, audit = null, packages = null }) {
  const c = config.providers.square;
  const base = c.environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  const headers = () => ({
    Authorization: `Bearer ${c.accessToken}`,
    'Content-Type': 'application/json',
    'Square-Version': c.apiVersion || '2024-10-17',
  });
  const api = async (method, path, body) => {
    const res = await fetchImpl(`${base}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(`Square catalog request failed (${res.status})`);
      e.details = json.errors;
      throw e;
    }
    return json;
  };

  return {
    configured: Boolean(c.accessToken && c.locationId),

    async sync(db) {
      if (!this.configured) throw new Error('Square catalog sync requires SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID credentials');
      const list = packages || allPackages();
      const stored = new Map(db.all('SELECT * FROM square_catalog_items').map((r) => [r.package_id, r]));

      // Refresh current versions for previously-synced items so updates don't version-conflict.
      const known = list.filter((p) => stored.has(p.id));
      if (known.length) {
        const got = await api('POST', '/v2/catalog/batch-retrieve', { object_ids: known.map((p) => stored.get(p.id).catalog_item_id) });
        for (const obj of got.objects || []) {
          const pkg = known.find((p) => stored.get(p.id).catalog_item_id === obj.id);
          if (!pkg) continue;
          const variation = (obj.item_data?.variations || []).find((v) => v.id === stored.get(pkg.id).variation_id);
          db.run('UPDATE square_catalog_items SET version = ?, variation_version = ? WHERE package_id = ?',
            obj.version ?? 0, variation?.version ?? 0, pkg.id);
          stored.get(pkg.id).version = obj.version ?? 0;
          stored.get(pkg.id).variation_version = variation?.version ?? 0;
        }
      }

      const objects = list.map((pkg) => {
        const s = stored.get(pkg.id);
        const priceCents = Math.round(pkg.priceUsd * 100);
        return {
          type: 'ITEM',
          id: s ? s.catalog_item_id : `#${pkg.id}`,
          ...(s ? { version: s.version } : {}),
          present_at_all_locations: true,
          item_data: {
            name: String(pkg.tierTitle || pkg.id).slice(0, 255),
            description: `${Number(pkg.goldCoins).toLocaleString('en-US')} Gold Coins for social play. Gold Coins have no cash value and cannot be redeemed.`.slice(0, 1024),
            variations: [{
              type: 'ITEM_VARIATION',
              id: s ? s.variation_id : `#${pkg.id}_var`,
              ...(s ? { version: s.variation_version } : {}),
              item_variation_data: {
                ...(s ? {} : { item_id: `#${pkg.id}` }),
                name: 'Standard',
                pricing_type: 'FIXED',
                price_money: { amount: priceCents, currency: 'USD' },
              },
            }],
          },
        };
      });

      const res = await api('POST', '/v2/catalog/batch-upsert', { idempotency_key: crypto.randomUUID(), batches: [{ objects }] });
      const idMap = new Map((res.id_mappings || []).map((m) => [m.client_object_id, m.object_id]));
      const now = new Date().toISOString();
      const synced = [];
      for (const pkg of list) {
        const s = stored.get(pkg.id);
        const itemId = s ? s.catalog_item_id : idMap.get(`#${pkg.id}`);
        const varId = s ? s.variation_id : idMap.get(`#${pkg.id}_var`);
        if (!itemId || !varId) throw new Error(`Square did not return catalog object ids for ${pkg.id}`);
        db.run(
          `INSERT INTO square_catalog_items (package_id, catalog_item_id, variation_id, version, variation_version, price_cents, synced_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(package_id) DO UPDATE SET catalog_item_id=excluded.catalog_item_id, variation_id=excluded.variation_id,
             price_cents=excluded.price_cents, synced_at=excluded.synced_at`,
          pkg.id, itemId, varId, s ? s.version : 0, s ? s.variation_version : 0, Math.round(pkg.priceUsd * 100), now
        );
        synced.push(pkg.id);
      }
      audit?.record({ action: 'SQUARE_CATALOG_SYNC', targetType: 'provider', targetId: 'square', details: { count: synced.length, packages: synced } });
      return { synced, count: synced.length, at: now };
    },
  };
}
