$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Resolve-Path (Join-Path $scriptDir "..\backend-api")

Set-Location $backendRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm non trovato. Installa Node.js LTS e riprova."
  exit 1
}

if (-not (Test-Path (Join-Path $backendRoot "node_modules"))) {
  Write-Host "Installing backend dependencies..."
  npm install
}

if (-not (Test-Path (Join-Path $backendRoot ".env")) -and (Test-Path (Join-Path $backendRoot ".env.example"))) {
  Copy-Item (Join-Path $backendRoot ".env.example") (Join-Path $backendRoot ".env")
}

Write-Host "Starting Express backend on http://localhost:3001"
npm run dev
