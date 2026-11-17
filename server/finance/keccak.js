/**
 * Minimal Keccak-256 (the Ethereum variant, NOT NIST SHA3) - used only for EIP-55 address checksums.
 * Zero dependencies. Verified against known vectors in the test suite.
 */
const MASK = (1n << 64n) - 1n;
const rotl = (x, n) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK);

const ROT = Array.from({ length: 5 }, () => new Array(5).fill(0));
{
  let x = 1;
  let y = 0;
  for (let t = 0; t < 24; t++) {
    ROT[x][y] = (((t + 1) * (t + 2)) / 2) % 64;
    [x, y] = [y, (2 * x + 3 * y) % 5];
  }
}

const RC = [];
{
  const lfsr = (t) => {
    let R = 1;
    for (let i = 1; i <= t % 255; i++) {
      R <<= 1;
      if (R & 0x100) R ^= 0x171;
    }
    return R & 1;
  };
  for (let ir = 0; ir < 24; ir++) {
    let c = 0n;
    for (let j = 0; j < 7; j++) if (lfsr(j + 7 * ir)) c |= 1n << BigInt((1 << j) - 1);
    RC.push(c);
  }
}

function keccakF(s) {
  for (let round = 0; round < 24; round++) {
    const C = [];
    for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20];
    for (let x = 0; x < 5; x++) {
      const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) s[x + 5 * y] ^= D;
    }
    const B = new Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x][y]);
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) s[x + 5 * y] = B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & MASK & B[((x + 2) % 5) + 5 * y]);
    }
    s[0] ^= RC[round];
  }
}

export function keccak256(input) {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  const rate = 136;
  const padLen = rate - (data.length % rate);
  const padded = Buffer.alloc(data.length + padLen);
  data.copy(padded);
  padded[data.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;
  const s = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) s[i] ^= padded.readBigUInt64LE(off + i * 8);
    keccakF(s);
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) out.writeBigUInt64LE(s[i], i * 8);
  return out.toString('hex');
}

/** True if `addr` is a well-formed EVM address; mixed-case must satisfy the EIP-55 checksum. */
export function isValidEvmAddress(addr) {
  if (typeof addr !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return false;
  const body = addr.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  const h = keccak256(body.toLowerCase());
  for (let i = 0; i < 40; i++) {
    const ch = body[i];
    if (/[a-f]/i.test(ch)) {
      const up = parseInt(h[i], 16) >= 8;
      if ((ch === ch.toUpperCase()) !== up) return false;
    }
  }
  return true;
}
