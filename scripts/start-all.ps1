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

$citusCoordinatorPort = if ($env:CITUS_COORDINATOR_PORT) { $env:CITUS_COORDINATOR_PORT } else { '5432' }

if ($citusCoordinatorPort -eq '5432') {
  $portInUse = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue

  if ($null -ne $portInUse) {
    $citusCoordinatorPort = '55432'
    Write-Host 'Port 5432 is already in use; using 55432 for the Citus coordinator.'
  }
}

$env:CITUS_COORDINATOR_PORT = $citusCoordinatorPort

$backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { '3001' }
if ($backendPort -eq '3001') {
  $backendPortInUse = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
  if ($null -ne $backendPortInUse) {
    $backendPort = '53001'
    Write-Host 'Port 3001 is already in use; using 53001 for backend-api.'
  }
}
$env:BACKEND_PORT = $backendPort

$frontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { '5173' }
if ($frontendPort -eq '5173') {
  $frontendPortInUse = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
  if ($null -ne $frontendPortInUse) {
    $frontendPort = '55173'
    Write-Host 'Port 5173 is already in use; using 55173 for frontend-dashboard.'
  }
}
$env:FRONTEND_PORT = $frontendPort

try {
  docker info | Out-Null
}
catch {
  Write-Error "Docker daemon non raggiungibile. Avvia Docker Desktop e riprova."
  exit 1
}

Write-Host "Starting full platform (Spark, Jupyter, Citus, Kafka, Backend, Dashboard)..."
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
  Write-Host "-IncludeApp is now implicit: backend and dashboard are managed by docker compose."
}

Write-Host "Services status:"
docker compose ps

Write-Host "Platform startup completed."

Write-Host "Backend API URL: http://localhost:$backendPort"
Write-Host "Dashboard URL: http://localhost:$frontendPort"
