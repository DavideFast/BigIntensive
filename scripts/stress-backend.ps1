param(
  [string]$ApiBase = "",
  [string]$Endpoint = "/events",
  [int]$TotalRequests = 500,
  [int]$Concurrency = 50,
  [int]$TimeoutSec = 10,
  [switch]$SkipHealthCheck
)

$ErrorActionPreference = 'Stop'

if (-not $ApiBase) {
  $backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { '3001' }
  $ApiBase = "http://localhost:$backendPort"
}

if ($TotalRequests -lt 1) {
  throw "TotalRequests must be >= 1"
}

if ($Concurrency -lt 1) {
  throw "Concurrency must be >= 1"
}

$uri = "$($ApiBase.TrimEnd('/'))$Endpoint"

if (-not $SkipHealthCheck) {
  try {
    $health = Invoke-RestMethod -Method Get -Uri "$($ApiBase.TrimEnd('/'))/health" -TimeoutSec $TimeoutSec
    Write-Host "[OK] Backend health: $($health.status)"
  }
  catch {
    throw "Backend health check failed on $ApiBase: $($_.Exception.Message). If backend uses another host port, pass -ApiBase explicitly (e.g. http://localhost:53001)."
  }
}

Write-Host ""
Write-Host "=== Backend Load Test ==="
Write-Host "Target:      $uri"
Write-Host "Requests:    $TotalRequests"
Write-Host "Concurrency: $Concurrency"
Write-Host "TimeoutSec:  $TimeoutSec"
Write-Host ""

$jobs = @()
$results = New-Object System.Collections.Generic.List[object]
$batchStopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Receive-CompletedJobs {
  param(
    [ref]$JobsRef,
    [ref]$ResultsRef
  )

  $completed = @($JobsRef.Value | Where-Object { $_.State -ne 'Running' })
  if ($completed.Count -eq 0) {
    return
  }

  foreach ($job in $completed) {
    $jobResults = @(Receive-Job -Job $job -ErrorAction SilentlyContinue)
    foreach ($item in $jobResults) {
      $ResultsRef.Value.Add($item)
    }

    if ($job.State -eq 'Failed') {
      $ResultsRef.Value.Add([pscustomobject]@{
        requestId = -1
        success = $false
        statusCode = 0
        latencyMs = 0
        error = ($job.ChildJobs[0].JobStateInfo.Reason | Out-String).Trim()
      })
    }

    Remove-Job -Job $job -Force
  }

  $JobsRef.Value = @($JobsRef.Value | Where-Object { $_.State -eq 'Running' })
}

for ($i = 1; $i -le $TotalRequests; $i++) {
  while ($jobs.Count -ge $Concurrency) {
    Receive-CompletedJobs -JobsRef ([ref]$jobs) -ResultsRef ([ref]$results
    )
    if ($jobs.Count -ge $Concurrency) {
      Start-Sleep -Milliseconds 80
    }
  }

  $jobs += Start-Job -ScriptBlock {
    param($TargetUri, $RequestId, $ReqTimeout)

    $started = [System.Diagnostics.Stopwatch]::StartNew()

    $payload = @{
      topic = "load-events"
      source = "stress-backend.ps1"
      status = "queued"
      payload = "sim-request-$RequestId"
    } | ConvertTo-Json -Compress

    try {
      Invoke-RestMethod -Method Post -Uri $TargetUri -ContentType "application/json" -Body $payload -TimeoutSec $ReqTimeout | Out-Null

      [pscustomobject]@{
        requestId = $RequestId
        success = $true
        statusCode = 201
        latencyMs = [int]$started.Elapsed.TotalMilliseconds
        error = ""
      }
    }
    catch {
      $status = 0
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $status = [int]$_.Exception.Response.StatusCode
      }

      [pscustomobject]@{
        requestId = $RequestId
        success = $false
        statusCode = $status
        latencyMs = [int]$started.Elapsed.TotalMilliseconds
        error = $_.Exception.Message
      }
    }
  } -ArgumentList $uri, $i, $TimeoutSec
}

while ($jobs.Count -gt 0) {
  Receive-CompletedJobs -JobsRef ([ref]$jobs) -ResultsRef ([ref]$results
  )
  if ($jobs.Count -gt 0) {
    Start-Sleep -Milliseconds 80
  }
}

$batchStopwatch.Stop()

$all = @($results)
$successes = @($all | Where-Object { $_.success })
$failures = @($all | Where-Object { -not $_.success })
$latencies = @($successes | ForEach-Object { $_.latencyMs } | Sort-Object)

$avg = 0
$p95 = 0
$min = 0
$max = 0

if ($latencies.Count -gt 0) {
  $avg = [math]::Round((($latencies | Measure-Object -Average).Average), 2)
  $min = $latencies[0]
  $max = $latencies[$latencies.Count - 1]
  $idx = [math]::Max(0, [int]([math]::Ceiling($latencies.Count * 0.95) - 1))
  $p95 = $latencies[$idx]
}

$throughput = 0
if ($batchStopwatch.Elapsed.TotalSeconds -gt 0) {
  $throughput = [math]::Round($all.Count / $batchStopwatch.Elapsed.TotalSeconds, 2)
}

Write-Host ""
Write-Host "=== Summary ==="
Write-Host "Total executed: $($all.Count)"
Write-Host "Success:        $($successes.Count)"
Write-Host "Failed:         $($failures.Count)"
Write-Host "Duration (s):   $([math]::Round($batchStopwatch.Elapsed.TotalSeconds, 2))"
Write-Host "Req/s:          $throughput"
Write-Host "Latency min:    $min ms"
Write-Host "Latency avg:    $avg ms"
Write-Host "Latency p95:    $p95 ms"
Write-Host "Latency max:    $max ms"

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "=== Failure sample (max 10) ==="
  $failures | Select-Object -First 10 requestId, statusCode, latencyMs, error | Format-Table -AutoSize
}
