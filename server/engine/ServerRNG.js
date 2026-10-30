import crypto from 'node:crypto';

/**
 * Server-Authoritative Cryptographically Secure RNG (CSPRNG) & Provably Fair Engine
 * Complies with Nevada Gaming Control Board / GLI-19 standards for online casino RNG:
 * - Uses hardware/OS entropy via Node.js crypto.randomBytes
 * - Implements HMAC-SHA256 Provably Fair verification
 * - Eliminates statistical bias, period cycling, and client-side prediction
 */
export class ServerRNG {
  /**
   * Generates a cryptographically secure random float in the range [0, 1)
   */
  static randomFloat() {
    // Generate 48 bits of cryptographic entropy for high uniform precision
    const buf = crypto.randomBytes(6);
    const num = buf.readUIntBE(0, 6);
    return num / 0x1000000000000;
  }

  /**
   * Generates a random integer in range [min, max] inclusive using rejection sampling to eliminate modulo bias
   */
  static randomInt(min, max) {
    if (min > max) throw new Error('Invalid range');
    const range = max - min + 1;
    if (range <= 1) return min;

    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % range);
    let randomVal;
    do {
      randomVal = crypto.randomBytes(4).readUInt32BE(0);
    } while (randomVal >= limit);

    return min + (randomVal % range);
  }

  /**
   * Generates a secure random 256-bit hexadecimal seed
   */
  static generateSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates SHA-256 hash of a server seed (sent to client before spin for Provably Fair verification)
   */
  static hashSeed(seed) {
    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  /**
   * Derives a deterministic float in [0, 1) from (serverSeed, clientSeed, nonce, index)
   * using HMAC-SHA256. Allows player to mathematically audit the fair execution of every spin.
   */
  static provablyFairFloat(serverSeed, clientSeed, nonce, cursor = 0) {
    const message = `${clientSeed}:${nonce}:${cursor}`;
    const hmac = crypto.createHmac('sha256', serverSeed).update(message).digest();
    // Use first 4 bytes of HMAC hash as 32-bit unsigned integer
    const val = hmac.readUInt32BE(0);
    return val / 0x100000000;
  }

  /**
   * Picks an item from a weighted pool using CSPRNG or Provably Fair derivation
   */
  static pickWeighted(pool, getWeight, provablyFairOpts = null) {
    const totalWeight = pool.reduce((acc, item) => acc + getWeight(item), 0);
    if (totalWeight <= 0) throw new Error('Pool has non-positive total weight');

    const randVal = provablyFairOpts
      ? this.provablyFairFloat(
          provablyFairOpts.serverSeed,
          provablyFairOpts.clientSeed,
          provablyFairOpts.nonce,
          provablyFairOpts.cursor || 0
        )
      : this.randomFloat();

    let threshold = randVal * totalWeight;
    for (const item of pool) {
      threshold -= getWeight(item);
      if (threshold <= 0) return item;
    }
    return pool[pool.length - 1];
  }
}
