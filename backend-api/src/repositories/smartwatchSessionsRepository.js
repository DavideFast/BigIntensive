export function createSmartwatchSessionsRepository(pool) {
  return {
    async create({ athleteId, topic }) {
      const result = await pool.query(
        `INSERT INTO smartwatch_sessions (athlete_id, topic)
         VALUES ($1, $2)
         RETURNING session_id, athlete_id, topic, status, samples_sent, started_at, ended_at, end_reason`,
        [athleteId, topic],
      );

      return result.rows[0] || null;
    },

    async getById(sessionId) {
      const result = await pool.query(
        `SELECT session_id, athlete_id, topic, status, samples_sent, started_at, ended_at, end_reason
         FROM smartwatch_sessions
         WHERE session_id = $1`,
        [sessionId],
      );

      return result.rows[0] || null;
    },

    async addSamples(sessionId, count) {
      const result = await pool.query(
        `UPDATE smartwatch_sessions
         SET samples_sent = samples_sent + $2
         WHERE session_id = $1
         RETURNING session_id, athlete_id, topic, status, samples_sent, started_at, ended_at, end_reason`,
        [sessionId, count],
      );

      return result.rows[0] || null;
    },

    async close(sessionId, reason) {
      const result = await pool.query(
        `UPDATE smartwatch_sessions
         SET status = 'ended', ended_at = CURRENT_TIMESTAMP, end_reason = $2
         WHERE session_id = $1
         RETURNING session_id, athlete_id, topic, status, samples_sent, started_at, ended_at, end_reason`,
        [sessionId, reason || null],
      );

      return result.rows[0] || null;
    },
  };
}
