const struttura_esercizio = {
  esercizio_id: 1,
  nome_esercizio: "Panca piana",
  descrizione: "Esercizio per il petto",
};

const struttura_utente = {
  utente_id: 1,
  nome: "Mario",
  cognome: "Rossi",
  eta: 30,
  sesso: "M",
  altezza_cm: 180,
  peso_kg: 75,
};

const struttura_allenamento = {
  allenamento_id: 1,
  nome_allenamento: "Allenamento Petto",
  descrizione: "Allenamento per il petto",
  durata: "60min",
  esercizi: [1, 2, 3],
  tempo_riposo: [2, 3, 4],
  serie: [3, 4, 5],
  ripetizioni: [10, 12, 15],
  risultato: [val1, val2, val3],
  utente: struttura_utente,
};

const corsa = {
  corsa_id: 1,
  distanza: [1, 1, 1, 2],
  tempo: [10, 20, 30, 40],
  velocita: [6, 5, 4, 3],
  frequenza_cardiaca: [120, 130, 140, 150],
  commento: "Buona corsa",
};

const struttura_training_status = {
  atleta_id: 1,
  giorno: "2024-06-01",
  valore: 85,
};

//Struttura allenamento e dati smartwatch andranno dentro clickhouse
