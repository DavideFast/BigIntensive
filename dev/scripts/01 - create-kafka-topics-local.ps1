[CmdletBinding()]
param(
  [string]$ComposeFile,
  [string]$BootstrapServer = 'kafka:19092',
  [string]$TopicsFile
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir '..\..')

if (-not $ComposeFile) {
  $ComposeFile = Join-Path $projectRoot 'dev\docker-compose.yml'
}

if (-not $TopicsFile) {
  $TopicsFile = Join-Path $projectRoot 'streaming\kafka\topics.json'
}

if (-not (Test-Path -LiteralPath $TopicsFile -PathType Leaf)) {
  throw "Topic catalog not found: $TopicsFile"
}

if (-not (Test-Path -LiteralPath $ComposeFile -PathType Leaf)) {
  throw "Compose file not found: $ComposeFile"
}

$catalog = Get-Content -LiteralPath $TopicsFile -Raw | ConvertFrom-Json

foreach ($topic in $catalog.topics) {
  $partitions = if ($null -ne $topic.partitions) { $topic.partitions } else { $catalog.defaultPartitions }
  $replicationFactor = if ($null -ne $topic.replicationFactor) { $topic.replicationFactor } else { $catalog.defaultReplicationFactor }
  $arguments = @(
    'compose', '-f', $ComposeFile, 'exec', '-T', 'kafka',
    '/opt/bitnami/kafka/bin/kafka-topics.sh',
    '--bootstrap-server', $BootstrapServer,
    '--create', '--if-not-exists',
    '--topic', $topic.name,
    '--partitions', $partitions,
    '--replication-factor', $replicationFactor
  )

  foreach ($property in $topic.config.psobject.Properties) {
    $arguments += '--config', "$($property.Name)=$($property.Value)"
  }

  Write-Host "Creating topic: $($topic.name)"
  & docker @arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create Kafka topic: $($topic.name)"
  }
}

Write-Host "All local Kafka topics are ready for bootstrap server: $BootstrapServer"