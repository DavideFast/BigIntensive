$ErrorActionPreference = 'Stop'

param(
  [switch]$SkipCitusInit
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")

Set-Location $projectRoot

try {
  docker info | Out-Null
}
catch {
  Write-Error "Docker daemon non raggiungibile. Avvia Docker Desktop e riprova."
  exit 1
}

Write-Host "Starting full platform (Spark, Jupyter, Citus, Kafka)..."
docker compose up -d

if (-not $SkipCitusInit) {
  Write-Host "Initializing Citus cluster..."
  & (Join-Path $scriptDir "init-citus.ps1")
}
else {
  Write-Host "Skipping Citus initialization as requested."
}

Write-Host "Services status:"
docker compose ps

Write-Host "Platform startup completed."
