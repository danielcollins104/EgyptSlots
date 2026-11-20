# ============================================================================
# EgyptSlots — Live Crypto Gateway patch: apply + test + push
# Run from the patch folder. Example:
#   .\apply-and-push.ps1 -RepoPath "C:\Users\danie\.gemini\antigravity\scratch\EgyptSlots" -Push
# ============================================================================
param(
  [string]$RepoPath = "C:\Users\danie\.gemini\antigravity\scratch\EgyptSlots",
  [string]$Branch   = "feature/live-crypto-gateway",
  [switch]$Push,
  [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$patchRoot = $PSScriptRoot

function Fail($msg) { Write-Host "`n✗ $msg" -ForegroundColor Red; exit 1 }

Write-Host "`n=== EgyptSlots live-crypto patch ===" -ForegroundColor Cyan
Write-Host "Repo: $RepoPath`n"

# --- 0. Preflight ------------------------------------------------------------
if (-not (Test-Path (Join-Path $RepoPath 'server\apiRouter.js'))) { Fail "apiRouter.js not found — is RepoPath the EgyptSlots root?" }
if (-not (Test-Path (Join-Path $RepoPath '.git'))) { Fail ".git not found — clone first: git clone https://github.com/danielcollins104/EgyptSlots.git" }
if (Test-Path (Join-Path $RepoPath '.git\MERGE_HEAD')) { Fail "Repo is mid-merge — resolve before patching." }

# --- 1. Copy files -----------------------------------------------------------
$files = @(
  @{ Src = 'server\cryptoGateway.js';             Dst = 'server\cryptoGateway.js';             New = $true },
  @{ Src = 'server\apiRouter.js';                 Dst = 'server\apiRouter.js';                 New = $false },
  @{ Src = 'src\services\cryptoGatewayService.js';Dst = 'src\services\cryptoGatewayService.js';New = $true },
  @{ Src = 'src\components\CryptoGatewayDeposit.jsx'; Dst = 'src\components\CryptoGatewayDeposit.jsx'; New = $true },
  @{ Src = 'src\components\CryptoPayoutConsole.jsx';  Dst = 'src\components\CryptoPayoutConsole.jsx';  New = $true },
  @{ Src = 'src\polish\egyptPolish.css';          Dst = 'src\polish\egyptPolish.css';          New = $true },
  @{ Src = 'src\polish\egyptPerf.js';             Dst = 'src\polish\egyptPerf.js';             New = $true }
)
foreach ($f in $files) {
  $dst = Join-Path $RepoPath $f.Dst
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  Copy-Item (Join-Path $patchRoot $f.Src) $dst -Force
  Write-Host ("  {0} {1}" -f $(if ($f.New) { '+' } else { '~' }), $f.Dst) -ForegroundColor Green
}

# --- 2. Component hooks (manual, verified anchors; warn-not-fail) ------------
$pmPath = Join-Path $RepoPath 'src\components\PaymentModal.jsx'
$pm = Get-Content $pmPath -Raw
$warn = @()

if ($pm -notmatch "CryptoGatewayDeposit") {
  $warn += 'PaymentModal.jsx: mount <CryptoGatewayDeposit/> in the crypto rail (see INTEGRATION.md §3A)'
}
if ($pm -notmatch "cryptoGatewayService") {
  $warn += 'PaymentModal.jsx: call cryptoGatewayService.requestPayout in handleRedeemSubmit (INTEGRATION.md §3B)'
}
$acPath = Join-Path $RepoPath 'src\components\AdminPayoutCenter.jsx'
$ac = Get-Content $acPath -Raw
if ($ac -notmatch "CryptoPayoutConsole") {
  $warn += 'AdminPayoutCenter.jsx: render <CryptoPayoutConsole/> next to the payout queue (INTEGRATION.md §3C)'
}
# Polish hook into main.jsx (two small additive imports)
$mainPath = Join-Path $RepoPath 'src\main.jsx'
$main = Get-Content $mainPath -Raw
if ($main -notmatch 'egyptPolish\.css') {
  $main = $main -replace "(?m)^(import App from '\./App\.jsx';)", "`$1`nimport './polish/egyptPolish.css';"
  Set-Content $mainPath $main -NoNewline
  Write-Host '  ~ src\main.jsx (+ polish css import)' -ForegroundColor Green
}
if ($main -notmatch 'installEgyptPerf') {
  $main = Get-Content $mainPath -Raw
  $main = $main -replace "(?m)^(import App from '\./App\.jsx';)", "`$1`nimport { installEgyptPerf } from './polish/egyptPerf.js';"
  if ($main -match 'createRoot') {
    $main = $main -replace 'createRoot\(', 'installEgyptPerf(); createRoot('
  }
  Set-Content $mainPath $main -NoNewline
  Write-Host '  ~ src\main.jsx (+ perf boost)' -ForegroundColor Green
}

# --- 3. Syntax + tests --------------------------------------------------------
Write-Host "`n--- checks ---" -ForegroundColor Cyan
node --check (Join-Path $RepoPath 'server\apiRouter.js') 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'apiRouter.js failed node --check' }
Write-Host '  ✓ server/apiRouter.js parses' -ForegroundColor Green
node --check (Join-Path $RepoPath 'server\cryptoGateway.js') 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'cryptoGateway.js failed node --check' }
Write-Host '  ✓ server/cryptoGateway.js parses' -ForegroundColor Green

if (-not $SkipTests) {
  Push-Location $RepoPath
  try {
    npm run test:all
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'test:all failed — do not push until green' }
    Write-Host '  ✓ test:all green' -ForegroundColor Green
  } finally { Pop-Location }
}

# --- 4. Commit + push ---------------------------------------------------------
Push-Location $RepoPath
try {
  git add -A
  $staged = git diff --cached --name-only
  if (-not $staged) { Write-Host 'Nothing staged (already applied?)' -ForegroundColor Yellow }
  else {
    git checkout -b $Branch 2>$null
    git commit -m "feat(payments): live crypto gateway deposits + automated payouts (v3.1.0)

- server/cryptoGateway.js: NOWPayments-compatible client (invoices, HMAC IPN, payouts, address validators)
- apiRouter: /api/crypto/invoice, /gateway-ipn, /invoice-status, /payout-request, /payouts, /payouts/process
- idempotent crediting per payment id / txHash; admin console for auto-send + manual receipts
- client: CryptoGatewayDeposit panel, CryptoPayoutConsole, cryptoGatewayService
- polish: egyptPolish.css + egyptPerf.js visual/smoothness layer
"
    if ($Push) { git push -u origin $Branch }
    else { Write-Host "Committed on $Branch (re-run with -Push to push)" -ForegroundColor Yellow }
  }
} finally { Pop-Location }

if ($warn.Count) {
  Write-Host "`n--- 3 manual hooks left (copy from INTEGRATION.md §3) ---" -ForegroundColor Yellow
  $warn | ForEach-Object { Write-Host "  • $_" -ForegroundColor Yellow }
}
Write-Host "`nDone. Next: set the env vars from INTEGRATION.md §2 and wire the IPN URL." -ForegroundColor Cyan
