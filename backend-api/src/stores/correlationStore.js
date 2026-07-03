export function createCorrelationStore() {
  const matrices = new Map();

  return {
    list() {
      return [...matrices.values()];
    },

    get(atleta) {
      return matrices.get(String(atleta)) || null;
    },

    set(atleta, payload) {
      matrices.set(String(atleta), payload);
      return payload;
    },

    delete(atleta) {
      return matrices.delete(String(atleta));
    },
  };
}
