$ErrorActionPreference = 'Stop'

$dbUser = if ($env:CITUS_POSTGRES_USER) { $env:CITUS_POSTGRES_USER } else { 'postgres' }
$dbName = if ($env:CITUS_POSTGRES_DB) { $env:CITUS_POSTGRES_DB } else { 'bigintensive' }

Write-Host 'Starting Citus services...'
docker compose up -d citus-coordinator citus-worker-1 citus-worker-2

Write-Host 'Initializing workers...'
docker compose exec -T citus-worker-1 psql -U $dbUser -d $dbName -f /citus-init/init-worker.sql
docker compose exec -T citus-worker-2 psql -U $dbUser -d $dbName -f /citus-init/init-worker.sql

Write-Host 'Initializing coordinator and registering workers...'
docker compose exec -T citus-coordinator psql -U $dbUser -d $dbName -f /citus-init/init-coordinator.sql

Write-Host 'Creating database tables...'
docker compose exec -T citus-coordinator psql -U $dbUser -d $dbName -f /citus-init/init-tables.sql

Write-Host 'Done. Current Citus nodes:'
docker compose exec -T citus-coordinator psql -U $dbUser -d $dbName -c "SELECT nodename, nodeport, noderole FROM pg_dist_node ORDER BY nodename;"
