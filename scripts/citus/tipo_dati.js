// Esempio dati orientato a un DB relazionale + Citus.
// Gli oggetti annidati diventano tabelle con chiavi esterne.

const struttura_esercizio = {
  esercizio_id: 1,
  nome_esercizio: "Panca piana",
  descrizione: "Esercizio multiarticolare per il petto",
};

const struttura_utente = {
  utente_id: 1,
  nome: "Mario",
  cognome: "Rossi",
  eta: 30,
  sesso: "M",
  altezza_cm: 180,
  peso_kg: 75.0,
};

const struttura_allenamento = {
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

const struttura_training_status = {
  atleta_id: 1,
  giorno: "2024-06-01",
  valore: 85,
};

// Struttura allenamento e dati smartwatch possono convivere con ClickHouse per analytics.
