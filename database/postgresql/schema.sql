-- Tabella atleta
CREATE TABLE athletes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    data_di_nascita DATE NOT NULL,
    sesso VARCHAR(10) CHECK (sesso IN ('M', 'F')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  
);

-- Tabella valori antropometrici
CREATE TABLE anthropometric_values  (
    athlete_id INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
    altezza_cm INT CHECK (altezza_cm > 50 AND altezza_cm < 300),
    peso_kg DECIMAL(5, 2) CHECK (peso_kg > 10 AND peso_kg < 500),
    data_rilevazione DATE NOT NULL,
    PRIMARY KEY (athlete_id, data_rilevazione)
);


-- Tabella allenamenti
CREATE TABLE allenamenti (
    id SERIAL PRIMARY KEY,
    athlete_id INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE ,
    data_allenamento DATE NOT NULL,
    tipo_allenamento VARCHAR(50) CHECK (tipo_allenamento IN ('forza', 'endurance', 'mobilità')),
    durata_minuti INT CHECK (durata_minuti > 0),
    struttura_allenamento JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Riepilogo corse
CREATE TABLE riepilogo_corse (
    id SERIAL PRIMARY KEY,
    athlete_id INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE ,
    data_corsa DATE NOT NULL,
    distanza_km DECIMAL(5, 2) CHECK (distanza_km > 0),
    durata_minuti INT CHECK (durata_minuti > 0),
    velocita_media DECIMAL(5, 2) CHECK (velocita_media > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella esercizi

CREATE TABLE esercizi (
    id SERIAL PRIMARY KEY,
    nome_esercizio VARCHAR(150) NOT NULL,
    tipo_esercizio VARCHAR(50) CHECK (tipo_esercizio IN ('forza', 'endurance', 'mobilità')),
    descrizione TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risultati del training status

CREATE TABLE training_status_results (
    id SERIAL PRIMARY KEY,
    athlete_id INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    result_date DATE NOT NULL,
    valore DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);