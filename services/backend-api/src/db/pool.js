import pg from "pg";

export function createDbPool() {
  return new pg.Pool({
    user: process.env.CITUS_POSTGRES_USER || "postgres",
    password: process.env.CITUS_POSTGRES_PASSWORD || "postgres",
    host: process.env.CITUS_HOST || "citus-coordinator",
    port: process.env.CITUS_PORT || 5432,
    database: process.env.CITUS_POSTGRES_DB || "bigintensive",
  });
}
