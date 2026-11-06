// ============================================================================
// LIVE ON-CHAIN BLOCKCHAIN VERIFIER FOR SELF-CUSTODY CASINO WALLETS
// ============================================================================
// Queries live public blockchain RPCs & indexers (Solana Mainnet, Bitcoin
// Mainnet via Mempool.space / Blockstream, and Ethereum / Polygon / Arbitrum /
// Base JSON-RPCs) to cryptographically verify incoming player deposits to:
//   1. BTC: bc1qwhnp4ylpv2h2q5x0rr9zm3zpwfcw3rtdmz4q4q
//   2. ETH / ERC-20 / Polygon / Base: 0x6258e488F97617cc103838746955CB81a1d3E3af
//   3. SOL / Solana SPL USDT: Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f
//
// Features:
//   - Verifies by specific Transaction Hash / Signature (TXID) OR automatically
//     scans recent incoming transactions to the destination wallet since the
//     checkout window was opened.
//   - Prevents double-spending / replay attacks by tracking claimed TXIDs.
//   - Works on both Cloudflare Workers (/api/crypto/verify) and client-side
//     browser fallback (Capacitor Android, iOS, Electron).
// ============================================================================

export const OFFICIAL_WALLETS = {
  BTC: 'bc1qwhnp4ylpv2h2q5x0rr9zm3zpwfcw3rtdmz4q4q',
  BTC_LEGACY: '1BkPiLbKXJ4Fu43CEiQ1g3wAoctFJ2DvXy',
  ETH: '0x6258e488F97617cc103838746955CB81a1d3E3af',
  SOL: 'Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f',
};

// Official USDT / USDC Token Mint & Contract Addresses
const SOLANA_TOKEN_MINTS = {
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

// ERC-20 `Transfer(address indexed from, address indexed to, uint256 value)` topic0
const ERC20_TRANSFER_TOPIC0 =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const EVM_RPC_ENDPOINTS = [
  { name: 'Ethereum Mainnet', url: 'https://eth.llamarpc.com', usdtDecimals: 6 },
  { name: 'Ethereum PublicNode', url: 'https://ethereum-rpc.publicnode.com', usdtDecimals: 6 },
  { name: 'Polygon Mainnet', url: 'https://polygon-bor-rpc.publicnode.com', usdtDecimals: 6 },
  { name: 'Arbitrum One', url: 'https://arbitrum-one-rpc.publicnode.com', usdtDecimals: 6 },
  { name: 'Base Mainnet', url: 'https://base-rpc.publicnode.com', usdtDecimals: 6 },
];

const SOLANA_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
];

const BTC_API_ENDPOINTS = [
  'https://mempool.space/api',
  'https://blockstream.info/api',
];

// In-memory replay protection set (persisted per worker isolate / server process)
const claimedTransactionIds = new Set();

export function isTxAlreadyClaimed(txHash) {
  if (!txHash) return false;
  return claimedTransactionIds.has(String(txHash).trim().toLowerCase());
}

export function markTxClaimed(txHash) {
  if (!txHash) return;
  claimedTransactionIds.add(String(txHash).trim().toLowerCase());
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function solanaRpcCall(method, params = []) {
  let lastErr = null;
  for (const rpcUrl of SOLANA_RPC_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) {
          return data.result;
        }
        lastErr = new Error(data?.error?.message || 'Solana RPC error');
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Unable to reach Solana Mainnet RPC');
}

async function evmRpcCall(rpcUrl, method, params = []) {
  const res = await fetchWithTimeout(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'EVM RPC Error');
  return data.result;
}

// ============================================================================
// 1. BITCOIN (BTC) ON-CHAIN VERIFIER (`bc1qwhnp4ylpv2h2q5x0rr9zm3zpwfcw3rtdmz4q4q`)
// ============================================================================
export async function verifyBitcoinPayment({
  expectedAmountBtc = 0,
  txHash = '',
  minTimestampSec = 0,
}) {
  const targetAddr = OFFICIAL_WALLETS.BTC.toLowerCase();
  const legacyAddr = OFFICIAL_WALLETS.BTC_LEGACY.toLowerCase();
  const cleanTx = String(txHash || '').trim();
  const minExpectedSats = Math.max(500, Math.floor(Number(expectedAmountBtc) * 1e8 * 0.92)); // 8% slippage/fee tolerance

  for (const apiBase of BTC_API_ENDPOINTS) {
    try {
      let candidateTxs = [];
      if (cleanTx) {
        const res = await fetchWithTimeout(`${apiBase}/tx/${encodeURIComponent(cleanTx)}`);
        if (res.ok) {
          const txObj = await res.json();
          if (txObj && txObj.txid) candidateTxs = [txObj];
        }
      } else {
        const res = await fetchWithTimeout(`${apiBase}/address/${OFFICIAL_WALLETS.BTC}/txs`);
        if (res.ok) {
          const txList = await res.json();
          if (Array.isArray(txList)) candidateTxs = txList.slice(0, 15);
        }
      }

      for (const tx of candidateTxs) {
        const txid = tx.txid;
        if (isTxAlreadyClaimed(txid)) continue;

        // Check timestamp if scanning recent address transactions (allow mempool unconfirmed or recent block)
        const blockTime = tx.status?.block_time || Math.floor(Date.now() / 1000);
        if (!cleanTx && minTimestampSec > 0 && tx.status?.confirmed && blockTime < minTimestampSec - 3600) {
          continue;
        }

        // Sum all outputs (vout) sent to our BTC address
        let receivedSats = 0;
        for (const out of tx.vout || []) {
          const outAddr = String(out.scriptpubkey_address || '').toLowerCase();
          if (outAddr === targetAddr || outAddr === legacyAddr) {
            receivedSats += Number(out.value) || 0;
          }
        }

        if (receivedSats >= minExpectedSats) {
          const receivedBtc = Number((receivedSats / 1e8).toFixed(8));
          return {
            verified: true,
            chain: 'Bitcoin Mainnet',
            symbol: 'BTC',
            txHash: txid,
            explorerUrl: `https://mempool.space/tx/${txid}`,
            recipient: OFFICIAL_WALLETS.BTC,
            amountReceived: receivedBtc,
            confirmed: Boolean(tx.status?.confirmed),
            statusText: tx.status?.confirmed
              ? 'Confirmed in Bitcoin Block'
              : 'Verified in Bitcoin Mempool (0-Conf Instant Credit)',
          };
        }
      }
    } catch (err) {
      // Try next BTC explorer API
    }
  }

  return {
    verified: false,
    chain: 'Bitcoin Mainnet',
    symbol: 'BTC',
    recipient: OFFICIAL_WALLETS.BTC,
    message: cleanTx
      ? `Transaction ${cleanTx.slice(0, 12)}... was not found or did not send at least ${expectedAmountBtc} BTC to ${OFFICIAL_WALLETS.BTC}.`
      : `No incoming Bitcoin transfer of ~${expectedAmountBtc} BTC detected yet at ${OFFICIAL_WALLETS.BTC} (checked Mempool & Mainnet blocks).`,
  };
}

// ============================================================================
// 2. SOLANA (SOL & SPL USDT) ON-CHAIN VERIFIER (`Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f`)
// ============================================================================
export async function verifySolanaPayment({
  symbol = 'SOL', // 'SOL' | 'USDT'
  expectedAmount = 0,
  txHash = '',
  minTimestampSec = 0,
}) {
  const targetOwner = OFFICIAL_WALLETS.SOL;
  const cleanSig = String(txHash || '').trim();
  const minExpected = Math.max(0.0001, Number(expectedAmount) * 0.92); // 8% tolerance

  try {
    let signaturesToInspect = [];
    if (cleanSig) {
      signaturesToInspect = [{ signature: cleanSig, blockTime: Math.floor(Date.now() / 1000) }];
    } else {
      const sigList = await solanaRpcCall('getSignaturesForAddress', [
        targetOwner,
        { limit: 12, commitment: 'confirmed' },
      ]);
      if (Array.isArray(sigList)) {
        signaturesToInspect = sigList.filter((s) => !s.err);
      }
    }

    for (const sigInfo of signaturesToInspect) {
      const sig = sigInfo.signature;
      if (isTxAlreadyClaimed(sig)) continue;

      if (!cleanSig && minTimestampSec > 0 && sigInfo.blockTime && sigInfo.blockTime < minTimestampSec - 3600) {
        continue;
      }

      const txData = await solanaRpcCall('getTransaction', [
        sig,
        { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
      ]);

      if (!txData || txData.meta?.err) continue;

      // A. Check Native SOL Balance Delta for our wallet
      const accountKeys = txData.transaction?.message?.accountKeys || [];
      const walletIndex = accountKeys.findIndex((k) => {
        const pubkey = typeof k === 'string' ? k : k?.pubkey;
        return pubkey === targetOwner;
      });

      if (symbol === 'SOL' && walletIndex !== -1) {
        const preLamports = txData.meta?.preBalances?.[walletIndex] ?? 0;
        const postLamports = txData.meta?.postBalances?.[walletIndex] ?? 0;
        const deltaSol = (postLamports - preLamports) / 1e9;
        if (deltaSol >= minExpected) {
          return {
            verified: true,
            chain: 'Solana Mainnet',
            symbol: 'SOL',
            txHash: sig,
            explorerUrl: `https://solscan.io/tx/${sig}`,
            recipient: targetOwner,
            amountReceived: Number(deltaSol.toFixed(6)),
            confirmed: true,
            statusText: 'Confirmed on Solana Mainnet',
          };
        }
      }

      // B. Check SPL Token Balance Delta (USDT / USDC on Solana)
      if (symbol === 'USDT' || symbol === 'USDC') {
        const preTokens = txData.meta?.preTokenBalances || [];
        const postTokens = txData.meta?.postTokenBalances || [];

        let receivedTokenAmount = 0;
        for (const post of postTokens) {
          const isValidMint =
            post.mint === SOLANA_TOKEN_MINTS.USDT || post.mint === SOLANA_TOKEN_MINTS.USDC;
          if (post.owner === targetOwner && isValidMint) {
            const postUi = Number(post.uiTokenAmount?.uiAmount ?? 0);
            const matchingPre = preTokens.find(
              (p) => p.accountIndex === post.accountIndex && p.mint === post.mint
            );
            const preUi = Number(matchingPre?.uiTokenAmount?.uiAmount ?? 0);
            if (postUi > preUi) {
              receivedTokenAmount += postUi - preUi;
            }
          }
        }

        if (receivedTokenAmount >= minExpected) {
          return {
            verified: true,
            chain: 'Solana Mainnet (SPL)',
            symbol: 'USDT',
            txHash: sig,
            explorerUrl: `https://solscan.io/tx/${sig}`,
            recipient: targetOwner,
            amountReceived: Number(receivedTokenAmount.toFixed(2)),
            confirmed: true,
            statusText: 'Confirmed SPL USDT Transfer on Solana Mainnet',
          };
        }
      }
    }
  } catch (err) {
    // Handled below
  }

  return {
    verified: false,
    chain: 'Solana Mainnet',
    symbol,
    recipient: targetOwner,
    message: cleanSig
      ? `Solana signature ${cleanSig.slice(0, 12)}... was not found or did not transfer ${expectedAmount} ${symbol} to ${targetOwner}.`
      : `No incoming ${symbol} transfer of ~${expectedAmount} ${symbol} detected yet at ${targetOwner} on Solana Mainnet.`,
  };
}

// ============================================================================
// 3. ETHEREUM / ERC-20 / POLYGON / BASE ON-CHAIN VERIFIER (`0x6258e488F97617cc103838746955CB81a1d3E3af`)
// ============================================================================
export async function verifyEvmPayment({
  symbol = 'ETH', // 'ETH' | 'USDT-ERC20'
  expectedAmount = 0,
  txHash = '',
}) {
  const targetAddr = OFFICIAL_WALLETS.ETH.toLowerCase();
  const paddedTargetTopic = '0x000000000000000000000000' + targetAddr.slice(2);
  const cleanTx = String(txHash || '').trim();
  const minExpected = Math.max(0.00005, Number(expectedAmount) * 0.92);

  // If the customer pasted a 0x Transaction Hash, verify it directly across Ethereum, Polygon, Arbitrum, and Base!
  if (cleanTx && cleanTx.startsWith('0x') && cleanTx.length === 66) {
    if (isTxAlreadyClaimed(cleanTx)) {
      return {
        verified: false,
        chain: 'EVM Mainnet',
        symbol,
        recipient: OFFICIAL_WALLETS.ETH,
        message: 'This transaction hash has already been claimed and credited.',
      };
    }

    for (const net of EVM_RPC_ENDPOINTS) {
      try {
        const [tx, receipt] = await Promise.all([
          evmRpcCall(net.url, 'eth_getTransactionByHash', [cleanTx]),
          evmRpcCall(net.url, 'eth_getTransactionReceipt', [cleanTx]),
        ]);

        if (!tx) continue;
        if (receipt && receipt.status === '0x0') {
          return {
            verified: false,
            chain: net.name,
            symbol,
            recipient: OFFICIAL_WALLETS.ETH,
            message: `Transaction ${cleanTx.slice(0, 12)}... reverted on ${net.name}.`,
          };
        }

        // Check Native ETH transfer
        const toAddr = String(tx.to || '').toLowerCase();
        if (toAddr === targetAddr && tx.value && tx.value !== '0x0') {
          const wei = BigInt(tx.value);
          const ethAmount = Number(wei) / 1e18;
          if (ethAmount >= minExpected) {
            return {
              verified: true,
              chain: net.name,
              symbol: 'ETH',
              txHash: cleanTx,
              explorerUrl: net.name.includes('Polygon')
                ? `https://polygonscan.com/tx/${cleanTx}`
                : net.name.includes('Arbitrum')
                ? `https://arbiscan.io/tx/${cleanTx}`
                : net.name.includes('Base')
                ? `https://basescan.org/tx/${cleanTx}`
                : `https://etherscan.io/tx/${cleanTx}`,
              recipient: OFFICIAL_WALLETS.ETH,
              amountReceived: Number(ethAmount.toFixed(6)),
              confirmed: Boolean(receipt && receipt.status === '0x1'),
              statusText: `Verified on ${net.name}`,
            };
          }
        }

        // Check ERC-20 Transfer logs (USDT / USDC) in transaction receipt
        if (receipt && Array.isArray(receipt.logs)) {
          for (const log of receipt.logs) {
            const topics = log.topics || [];
            if (
              String(topics[0] || '').toLowerCase() === ERC20_TRANSFER_TOPIC0 &&
              String(topics[2] || '').toLowerCase() === paddedTargetTopic
            ) {
              const rawVal = BigInt(log.data || '0x0');
              // USDT/USDC on Ethereum/Polygon/Arbitrum/Base uses 6 decimals (or 18 on BSC)
              const tokenAmount6 = Number(rawVal) / 1e6;
              const tokenAmount18 = Number(rawVal) / 1e18;
              const actualAmount = tokenAmount6 >= minExpected && tokenAmount6 < 1e9 ? tokenAmount6 : tokenAmount18;

              if (actualAmount >= minExpected) {
                return {
                  verified: true,
                  chain: net.name,
                  symbol: 'USDT-ERC20',
                  txHash: cleanTx,
                  explorerUrl: net.name.includes('Polygon')
                    ? `https://polygonscan.com/tx/${cleanTx}`
                    : `https://etherscan.io/tx/${cleanTx}`,
                  recipient: OFFICIAL_WALLETS.ETH,
                  amountReceived: Number(actualAmount.toFixed(2)),
                  confirmed: true,
                  statusText: `Confirmed ERC-20 Transfer on ${net.name}`,
                };
              }
            }
          }
        }
      } catch (err) {
        // Continue checking next EVM network
      }
    }

    return {
      verified: false,
      chain: 'Ethereum / Polygon / Base',
      symbol,
      recipient: OFFICIAL_WALLETS.ETH,
      message: `Transaction ${cleanTx.slice(0, 14)}... was not found on Ethereum, Polygon, Arbitrum, or Base, or did not transfer ${expectedAmount} ${symbol} to ${OFFICIAL_WALLETS.ETH}.`,
    };
  }

  // If no txHash was provided, scan recent ERC-20 Transfer logs to our wallet over the last ~150 blocks
  for (const net of EVM_RPC_ENDPOINTS.slice(0, 3)) {
    try {
      const blockNumberHex = await evmRpcCall(net.url, 'eth_blockNumber', []);
      const latestBlock = parseInt(blockNumberHex, 16);
      const fromBlockHex = '0x' + Math.max(0, latestBlock - 120).toString(16);

      const logs = await evmRpcCall(net.url, 'eth_getLogs', [
        {
          fromBlock: fromBlockHex,
          toBlock: 'latest',
          topics: [ERC20_TRANSFER_TOPIC0, null, paddedTargetTopic],
        },
      ]);

      if (Array.isArray(logs) && logs.length > 0) {
        for (let i = logs.length - 1; i >= 0; i--) {
          const log = logs[i];
          const txid = log.transactionHash;
          if (isTxAlreadyClaimed(txid)) continue;

          const rawVal = BigInt(log.data || '0x0');
          const tokenAmount = Number(rawVal) / 1e6;
          if (tokenAmount >= minExpected) {
            return {
              verified: true,
              chain: net.name,
              symbol: 'USDT-ERC20',
              txHash: txid,
              explorerUrl: net.name.includes('Polygon')
                ? `https://polygonscan.com/tx/${txid}`
                : `https://etherscan.io/tx/${txid}`,
              recipient: OFFICIAL_WALLETS.ETH,
              amountReceived: Number(tokenAmount.toFixed(2)),
              confirmed: true,
              statusText: `Confirmed on ${net.name}`,
            };
          }
        }
      }
    } catch (err) {
      // Continue
    }
  }

  return {
    verified: false,
    chain: 'Ethereum / Polygon / Base',
    symbol,
    recipient: OFFICIAL_WALLETS.ETH,
    message:
      symbol === 'ETH'
        ? `Please paste your 0x Transaction Hash from MetaMask / Coinbase Wallet so we can verify your ${expectedAmount} ETH transfer on-chain.`
        : `No incoming ${expectedAmount} USDT transfer detected in the last 120 blocks for ${OFFICIAL_WALLETS.ETH}. You can also paste your 0x Transaction Hash to verify immediately.`,
  };
}

// ============================================================================
// 4. UNIFIED MULTI-CHAIN VERIFICATION & LIVE WALLET BALANCE INSPECTOR
// ============================================================================
export async function verifyCryptoDeposit({
  symbol = 'USDT',
  expectedAmount = 0,
  txHash = '',
  minTimestampSec = 0,
}) {
  const upper = String(symbol || 'USDT').toUpperCase();

  let result;
  if (upper === 'BTC') {
    result = await verifyBitcoinPayment({
      expectedAmountBtc: expectedAmount,
      txHash,
      minTimestampSec,
    });
  } else if (upper === 'SOL' || upper === 'USDT') {
    result = await verifySolanaPayment({
      symbol: upper,
      expectedAmount,
      txHash,
      minTimestampSec,
    });
  } else if (upper === 'ETH' || upper === 'USDT-ERC20') {
    result = await verifyEvmPayment({
      symbol: upper,
      expectedAmount,
      txHash,
    });
  } else {
    throw new Error(`Unsupported crypto symbol: ${symbol}`);
  }

  if (result.verified && result.txHash) {
    markTxClaimed(result.txHash);
  }

  return result;
}

/**
 * Fetches live on-chain balances for all 3 self-custody casino wallets
 */
export async function getLiveWalletBalancesStatus() {
  const status = {
    timestamp: new Date().toISOString(),
    wallets: {
      BTC: { address: OFFICIAL_WALLETS.BTC, chain: 'Bitcoin Mainnet', confirmedBtc: 0, unconfirmedBtc: 0, txCount: 0, online: false },
      ETH: { address: OFFICIAL_WALLETS.ETH, chain: 'Ethereum Mainnet', balanceEth: 0, online: false },
      SOL: { address: OFFICIAL_WALLETS.SOL, chain: 'Solana Mainnet', balanceSol: 0, online: false },
    },
  };

  await Promise.allSettled([
    // 1. BTC via mempool.space
    (async () => {
      const res = await fetchWithTimeout(`${BTC_API_ENDPOINTS[0]}/address/${OFFICIAL_WALLETS.BTC}`);
      if (res.ok) {
        const data = await res.json();
        const funded = data.chain_stats?.funded_txo_sum || 0;
        const spent = data.chain_stats?.spent_txo_sum || 0;
        const mempoolFunded = data.mempool_stats?.funded_txo_sum || 0;
        const mempoolSpent = data.mempool_stats?.spent_txo_sum || 0;
        status.wallets.BTC.confirmedBtc = Number(((funded - spent) / 1e8).toFixed(8));
        status.wallets.BTC.unconfirmedBtc = Number(((mempoolFunded - mempoolSpent) / 1e8).toFixed(8));
        status.wallets.BTC.txCount = (data.chain_stats?.tx_count || 0) + (data.mempool_stats?.tx_count || 0);
        status.wallets.BTC.online = true;
      }
    })(),

    // 2. ETH via Ethereum Mainnet RPC
    (async () => {
      const hexBal = await evmRpcCall(EVM_RPC_ENDPOINTS[0].url, 'eth_getBalance', [
        OFFICIAL_WALLETS.ETH,
        'latest',
      ]);
      if (hexBal) {
        status.wallets.ETH.balanceEth = Number((Number(BigInt(hexBal)) / 1e18).toFixed(6));
        status.wallets.ETH.online = true;
      }
    })(),

    // 3. SOL via Solana Mainnet RPC
    (async () => {
      const solRes = await solanaRpcCall('getBalance', [
        OFFICIAL_WALLETS.SOL,
        { commitment: 'confirmed' },
      ]);
      if (solRes && typeof solRes.value === 'number') {
        status.wallets.SOL.balanceSol = Number((solRes.value / 1e9).toFixed(6));
        status.wallets.SOL.online = true;
      }
    })(),
  ]);

  return status;
}
