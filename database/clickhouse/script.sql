-- ============================================================
-- CONFIGURAZIONE
-- ============================================================

CREATE DATABASE IF NOT EXISTS sport;


-- ============================================================
-- TABELLA FINALE
-- ============================================================

CREATE TABLE IF NOT EXISTS sport.allenamenti
(
    allenamento_id UInt64,
    athlete_id UInt64,
    data_allenamento DateTime,

    esercizio LowCardinality(String),

    serie_allenamento UInt8,
    ripetizioni_allenamento UInt8,
    recupero_allenamento UInt8,

    peso_allenamento Decimal(5, 2),

    created_at DateTime
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(data_allenamento)
ORDER BY
(
    data_allenamento,
    athlete_id,
    allenamento_id
);


-- ============================================================
-- CONTROLLO DATI RAW
-- ============================================================

SELECT
    count() AS allenamenti_da_processare,
    min(allenamento_id) AS primo_id,
    max(allenamento_id) AS ultimo_id
FROM sport.allenamenti_raw;


-- ============================================================
-- TRASFORMAZIONE
-- ============================================================

INSERT INTO sport.allenamenti
(
    allenamento_id,
    athlete_id,
    data_allenamento,
    esercizio,
    serie_allenamento,
    ripetizioni_allenamento,
    recupero_allenamento,
    peso_allenamento,
    created_at
)

SELECT
    r.allenamento_id,

    r.athlete_id,

    r.data_allenamento,

    exercise.1 AS esercizio,

    serie_numero AS serie_allenamento,

    toUInt8(
        JSONExtractUInt(
            exercise.2,
            'ripetizioni'
        )
    ) AS ripetizioni_allenamento,

    toUInt8(
        JSONExtractUInt(
            exercise.2,
            'recupero_secondi'
        )
    ) AS recupero_allenamento,

    toDecimal32(
        JSONExtractFloat(
            exercise.2,
            'carico_kg'
        ),
        2
    ) AS peso_allenamento,

    r.created_at

FROM sport.allenamenti_raw AS r

ARRAY JOIN
    arrayMap(
        x ->
        (
            JSONExtractString(x, 'nome'),

            x,

            JSONExtractUInt(
                x,
                'serie'
            )
        ),

        JSONExtractArrayRaw(
            r.struttura_allenamento,
            'esercizi'
        )
    ) AS exercise

ARRAY JOIN
    range(
        1,
        toUInt64(exercise.3) + 1
    ) AS serie_numero;


-- ============================================================
-- VERIFICA
-- ============================================================

SELECT
    count() AS righe_generate
FROM sport.allenamenti;


-- ============================================================
-- SVUOTAMENTO STAGING
-- ============================================================

TRUNCATE TABLE sport.allenamenti_raw;


-- ============================================================
-- CONTROLLO FINALE
-- ============================================================

SELECT
    count() AS raw_rimanenti
FROM sport.allenamenti_raw;