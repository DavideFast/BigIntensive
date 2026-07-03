const allenamento = {
  allenamento_id: 1,
  utente_id: 1,
  nome_allenamento: "Allenamento Petto",
  descrizione: "Sessione focalizzata sul petto",
  durata_min: 60,
  dettagli: [
    {
      esercizio_id: 1,
      ordine: 1,
      serie: 4,
      ripetizioni: 8,
      tempo_riposo_sec: 120,
      risultato: 82.5,
    },
    {
      esercizio_id: 2,
      ordine: 2,
      serie: 3,
      ripetizioni: 10,
      tempo_riposo_sec: 90,
      risultato: 65.0,
    },
  ],
};

const corsa_endurance = {
  atleta_id: 1,
  sessione_id: 101,
  campioni: [
    {
      secondo: 0,
      heart_rate_bpm: 120,
      cadence_spm: 158,
      speed_kmh: 9.8,
      altitude_m: 120.5,
    },
    {
      secondo: 30,
      heart_rate_bpm: 128,
      cadence_spm: 162,
      speed_kmh: 10.4,
      altitude_m: 121.0,
    },
  ],
  commento: "Progressione regolare",
};
