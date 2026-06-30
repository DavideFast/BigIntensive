param(
  [ValidateSet("events", "force-plate")]
  [string]$Mode = "events",
  [int]$Vus = 80,
  [string]$Duration = "60s",
  [string]$BaseUrl = "http://backend-api:3001"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$loadScriptsPath = Resolve-Path (Join-Path $scriptDir "load")
$dockerNetwork = "bigintensive-spark_spark-net"

Set-Location $projectRoot

try {
  docker network inspect $dockerNetwork | Out-Null
}
catch {
  Write-Error "Docker network '$dockerNetwork' not found. Start the stack first with .\\scripts\\start-all.ps1"
  exit 1
}

Write-Host "=== BigIntensive Load Test (k6) ==="
Write-Host "Mode:      $Mode"
Write-Host "VUs:       $Vus"
Write-Host "Duration:  $Duration"
Write-Host "Base URL:  $BaseUrl"
Write-Host "Network:   $dockerNetwork"
Write-Host ""

$volumeArg = "${loadScriptsPath}:/scripts/load"

$cmd = @(
  "run", "--rm",
  "--network", $dockerNetwork,
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
