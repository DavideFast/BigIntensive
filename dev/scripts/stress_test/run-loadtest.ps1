param(
  [ValidateSet("events", "force-plate")]
  [string]$Mode = "events",
  [int]$Vus = 80,
  [string]$Duration = "60s",
  [string]$BaseUrl = "http://backend:3001"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$devRoot = Resolve-Path (Join-Path $scriptDir "..")
$composeFile = Join-Path $devRoot "docker-compose.yml"
Set-Location $devRoot

$backendContainerIdRaw = docker compose -f $composeFile ps -q backend
$backendContainerId = if ($backendContainerIdRaw) { $backendContainerIdRaw.Trim() } else { "" }
if (-not $backendContainerId) {
  Write-Error "backend container not running. Start the dev stack first with 'docker compose up -d' from the dev folder."
  exit 1
}

Write-Host "=== BigIntensive Load Test (k6) ==="
Write-Host "Mode:      $Mode"
Write-Host "VUs:       $Vus"
Write-Host "Duration:  $Duration"
Write-Host "Base URL:  $BaseUrl"
Write-Host "Runner:    docker compose run --profile loadtest k6"
Write-Host ""

$cmd = @(
  "--profile", "loadtest",
  "run", "--rm",
  "-e", "BASE_URL=$BaseUrl",
  "-e", "ENDPOINT_MODE=$Mode",
  "k6",
  "run",
  "--vus", $Vus,
  "--duration", $Duration,
  "/scripts/load/k6-backend.js"
)

docker compose -f $composeFile @cmd
