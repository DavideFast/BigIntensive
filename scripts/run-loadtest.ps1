param(
  [ValidateSet("events", "force-plate")]
  [string]$Mode = "events",
  [int]$Vus = 80,
  [string]$Duration = "60s",
  [string]$BaseUrl = "http://backend-api:3001",
  [string]$DockerNetwork = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$loadScriptsPath = Resolve-Path (Join-Path $scriptDir "load")
Set-Location $projectRoot

if (-not $DockerNetwork) {
  $backendContainerIdRaw = docker compose ps -q backend-api
  $backendContainerId = if ($backendContainerIdRaw) { $backendContainerIdRaw.Trim() } else { "" }
  if (-not $backendContainerId) {
    Write-Error "backend-api container not running. Start the stack first with .\\scripts\\start-all.ps1"
    exit 1
  }

  $DockerNetwork = (docker inspect -f "{{range `$k,`$v := .NetworkSettings.Networks}}{{`$k}}{{end}}" $backendContainerId).Trim()
}

if (-not $DockerNetwork) {
  Write-Error "Unable to detect Docker network for backend-api. Pass -DockerNetwork explicitly."
  exit 1
}

Write-Host "=== BigIntensive Load Test (k6) ==="
Write-Host "Mode:      $Mode"
Write-Host "VUs:       $Vus"
Write-Host "Duration:  $Duration"
Write-Host "Base URL:  $BaseUrl"
Write-Host "Network:   $DockerNetwork"
Write-Host ""

$volumeArg = "${loadScriptsPath}:/scripts/load"

$cmd = @(
  "run", "--rm",
  "--network", $DockerNetwork,
  "-v", $volumeArg,
  "grafana/k6:0.53.0",
  "run",
  "--vus", $Vus,
  "--duration", $Duration,
  "-e", "BASE_URL=$BaseUrl",
  "-e", "ENDPOINT_MODE=$Mode",
  "/scripts/load/k6-backend.js"
)

docker @cmd
