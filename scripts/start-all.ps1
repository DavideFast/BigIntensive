param(
  [switch]$SkipCitusInit,
  [switch]$IncludeApp
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")

Set-Location $projectRoot

$rootEnvFile = Join-Path $projectRoot '.env'
$rootEnvExample = Join-Path $projectRoot '.env.example'

if (-not (Test-Path $rootEnvFile) -and (Test-Path $rootEnvExample)) {
  Write-Host 'Creating root .env from .env.example...'
  Copy-Item $rootEnvExample $rootEnvFile
}

try {
  docker info | Out-Null
}
catch {
  Write-Error "Docker daemon non raggiungibile. Avvia Docker Desktop e riprova."
  exit 1
}

Write-Host "Starting full platform (Spark, Jupyter, Citus, Kafka)..."
docker compose up -d

if ($LASTEXITCODE -ne 0) {
  throw "docker compose up -d failed; stopping before Citus initialization."
}

if (-not $SkipCitusInit) {
  Write-Host "Initializing Citus cluster..."
  & (Join-Path $scriptDir "init-citus.ps1")
}
else {
  Write-Host "Skipping Citus initialization as requested."
}

if ($IncludeApp) {
  Write-Host "Starting backend API and dashboard in background..."

  Start-Process powershell -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    (Join-Path $scriptDir 'start-backend.ps1')
  ) -WorkingDirectory $scriptDir | Out-Null

  Start-Process powershell -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    (Join-Path $scriptDir 'start-dashboard.ps1')
  ) -WorkingDirectory $scriptDir | Out-Null
}

Write-Host "Services status:"
docker compose ps

Write-Host "Platform startup completed."

if ($IncludeApp) {
  Write-Host "Backend and dashboard were launched in separate PowerShell windows."
}
