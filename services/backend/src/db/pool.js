import pg from "pg";
const { createClient } = require("@clickhouse/client");

export function createDbPool() {
  return new pg.Pool({
    user: process.env.CITUS_POSTGRES_USER || "postgres",
    password: process.env.CITUS_POSTGRES_PASSWORD || "postgres",
    host: process.env.CITUS_HOST || "citus-coordinator",
    port: process.env.CITUS_PORT || 5432,
    database: process.env.CITUS_POSTGRES_DB || "bigintensive",
  });
}

export const createClickhouseClient = createClient({
  host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
});
