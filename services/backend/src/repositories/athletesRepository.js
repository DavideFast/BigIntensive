export function createAthletesRepository(pool) {
  return {
    async list() {
      const result = await pool.query(
        "SELECT athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at FROM athletes ORDER BY created_at DESC",
      );
      return result.rows;
    },

    async getById(id) {
      const result = await pool.query(
        "SELECT athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at FROM athletes WHERE athlete_id = $1",
        [id],
      );
      return result.rows[0] || null;
    },

    async create({ nome, cognome, eta, sesso, altezza_cm, peso_kg }) {
      const result = await pool.query(
        "INSERT INTO athletes (nome, cognome, eta, sesso, altezza_cm, peso_kg) VALUES ($1, $2, $3, $4, $5, $6) RETURNING athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at",
        [nome, cognome, eta, sesso, altezza_cm, peso_kg],
      );
      return result.rows[0];
    },

    async update(id, fields) {
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (fields.nome !== undefined) {
        updates.push(`nome = $${paramIndex++}`);
        values.push(fields.nome);
      }
      if (fields.cognome !== undefined) {
        updates.push(`cognome = $${paramIndex++}`);
        values.push(fields.cognome);
      }
      if (fields.eta !== undefined) {
        updates.push(`eta = $${paramIndex++}`);
        values.push(fields.eta);
      }
      if (fields.sesso !== undefined) {
        updates.push(`sesso = $${paramIndex++}`);
        values.push(fields.sesso);
      }
      if (fields.altezza_cm !== undefined) {
        updates.push(`altezza_cm = $${paramIndex++}`);
        values.push(fields.altezza_cm);
      }
      if (fields.peso_kg !== undefined) {
        updates.push(`peso_kg = $${paramIndex++}`);
        values.push(fields.peso_kg);
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);

      const query = `UPDATE athletes SET ${updates.join(", ")} WHERE athlete_id = $${paramIndex} RETURNING athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, updated_at`;
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    },
  };
}
