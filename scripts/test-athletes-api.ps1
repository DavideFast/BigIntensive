$ErrorActionPreference = 'Stop'

$apiBase = "http://localhost:3001"

Write-Host "=== BigIntensive Athletes API Test ==="
Write-Host ""

# 1. Get all athletes
Write-Host "1. Fetching all athletes..."
try {
  $response = Invoke-RestMethod -Method Get -Uri "$apiBase/athletes"
  Write-Host "✓ Found $($response.total) athletes"
  $response.items | ForEach-Object {
    Write-Host "  - ID $($_.athlete_id): $($_.nome) $($_.cognome) (eta: $($_.eta), sesso: $($_.sesso), altezza: $($_.altezza_cm)cm, peso: $($_.peso_kg)kg)"
  }
} catch {
  Write-Host "✗ Error: $($_.Exception.Message)"
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
  Write-Host "✓ Created athlete with ID $($response.athlete_id)"
  Write-Host "  $($response.nome) $($response.cognome)"
} catch {
  Write-Host "✗ Error: $($_.Exception.Message)"
}

Write-Host ""

# 3. Get athlete by ID
Write-Host "3. Fetching athlete by ID..."
try {
  $response = Invoke-RestMethod -Method Get -Uri "$apiBase/athletes/1"
  Write-Host "✓ Found athlete:"
  Write-Host "  - $($response.nome) $($response.cognome) (ID: $($response.athlete_id))"
  Write-Host "  - Età: $($response.eta), Sesso: $($response.sesso)"
  Write-Host "  - Altezza: $($response.altezza_cm)cm, Peso: $($response.peso_kg)kg"
} catch {
  Write-Host "✗ Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== Test Complete ==="
