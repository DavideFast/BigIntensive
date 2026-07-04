export function createSmartwatchSessionStore() {
  const sessions = new Map();

  return {
    create({ athleteId, topic }) {
      const sessionId = Date.now();
      const session = {
        session_id: sessionId,
        athlete_id: String(athleteId),
        topic,
        status: "active",
        samples_sent: 0,
        started_at: new Date().toISOString(),
        ended_at: null,
      };

      sessions.set(sessionId, session);
      return session;
    },

    get(sessionId) {
      return sessions.get(Number(sessionId)) || null;
    },

    addSamples(sessionId, count) {
      const current = sessions.get(Number(sessionId));
      if (!current) {
        return null;
      }

      current.samples_sent += Number(count) || 0;
      return current;
    },

    close(sessionId) {
      const current = sessions.get(Number(sessionId));
      if (!current) {
        return null;
      }

      current.status = "ended";
      current.ended_at = new Date().toISOString();
      return current;
    },
  };
}
