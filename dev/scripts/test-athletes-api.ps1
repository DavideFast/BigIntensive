$ErrorActionPreference = 'Stop'

$apiBase = "http://localhost:3001"

Write-Host "=== BigIntensive Athletes API Test ==="
Write-Host ""

# 1. Get all athletes
Write-Host "1. Fetching all athletes..."
try {
  $response = Invoke-RestMethod -Method Get -Uri "$apiBase/athletes"
  Write-Host "[OK] Found $($response.total) athletes"
  $response.items | ForEach-Object {
    Write-Host "  - ID $($_.athlete_id): $($_.nome) $($_.cognome) (age: $($_.eta), sex: $($_.sesso), height: $($_.altezza_cm)cm, weight: $($_.peso_kg)kg)"
  }
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)"
}

Write-Host ""

# 2. Create a new athlete
Write-Host "2. Creating a new athlete..."
$newAthlete = @{
  nome = "Luca"
  cognome = "Ferrari"
  eta = 30
  sesso = "M"
  altezza_cm = 180
  peso_kg = 85.5
} | ConvertTo-Json

try {
  $response = Invoke-RestMethod -Method Post -Uri "$apiBase/athletes" -ContentType "application/json" -Body $newAthlete
  Write-Host "[OK] Created athlete with ID $($response.athlete_id)"
  Write-Host "  $($response.nome) $($response.cognome)"
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)"
}

Write-Host ""

# 3. Get athlete by ID
Write-Host "3. Fetching athlete by ID..."
try {
  $response = Invoke-RestMethod -Method Get -Uri "$apiBase/athletes/1"
  Write-Host "[OK] Found athlete:"
  Write-Host "  - $($response.nome) $($response.cognome) (ID: $($response.athlete_id))"
  Write-Host "  - Age: $($response.eta), Sex: $($response.sesso)"
  Write-Host "  - Height: $($response.altezza_cm)cm, Weight: $($response.peso_kg)kg"
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== Test Complete ==="
