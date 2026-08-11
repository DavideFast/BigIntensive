$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dashboardRoot = Resolve-Path (Join-Path $scriptDir "..\frontend-dashboard")

Set-Location $dashboardRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm non trovato. Installa Node.js LTS e riprova."
  exit 1
}

if (-not (Test-Path (Join-Path $dashboardRoot "node_modules"))) {
  Write-Host "Installing frontend dependencies..."
  npm install
}

Write-Host "Starting React dashboard on http://localhost:5173"
npm run dev
