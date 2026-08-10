CREATE EXTENSION IF NOT EXISTS citus;
SELECT citus_set_coordinator_host('citus-coordinator', 5432);
