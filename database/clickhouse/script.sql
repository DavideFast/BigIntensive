-- ============================================================
-- CONFIGURAZIONE
-- ============================================================

CREATE DATABASE IF NOT EXISTS bigintensive;


-- ============================================================
-- TABELLA FINALE
-- ============================================================

CREATE TABLE IF NOT EXISTS bigintensive.allenamenti
(
    allenamento_id UInt64,
    athlete_id UInt64,
    data_allenamento DateTime,

    nome_esercizio LowCardinality(String),

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
    FROM bigintensive.allenamenti_raw;


-- ============================================================
-- TRASFORMAZIONE
-- ============================================================

INSERT INTO bigintensive.allenamenti
(
    allenamento_id,
    athlete_id,
    data_allenamento,
    nome_esercizio,
    serie_allenamento,
    ripetizioni_allenamento,
    recupero_allenamento,
    peso_allenamento,
    created_at
)

SELECT
    expanded.allenamento_id,

    expanded.athlete_id,

    expanded.data_allenamento,

    expanded.exercise.1 AS nome_esercizio,

    serie_numero AS serie_allenamento,

    toUInt8(
        JSONExtractUInt(
            expanded.exercise.2,
            'ripetizioni'
        )
    ) AS ripetizioni_allenamento,

    toUInt8(
        JSONExtractUInt(
            expanded.exercise.2,
            'recupero_secondi'
        )
    ) AS recupero_allenamento,

    toDecimal32(
        JSONExtractFloat(
            expanded.exercise.2,
            'carico_kg'
        ),
        2
    ) AS peso_allenamento,

    expanded.created_at

FROM
(
    SELECT
        r.allenamento_id,
        r.athlete_id,
        r.data_allenamento,
        r.created_at,
        exercise
    FROM bigintensive.allenamenti_raw AS r

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
) AS expanded

ARRAY JOIN
    range(
        1,
        toUInt64(expanded.exercise.3) + 1
    ) AS serie_numero;


-- ============================================================
-- VERIFICA
-- ============================================================

SELECT
    count() AS righe_generate
FROM bigintensive.allenamenti;


-- ============================================================
-- SVUOTAMENTO STAGING
-- ============================================================

TRUNCATE TABLE bigintensive.allenamenti_raw;


-- ============================================================
-- CONTROLLO FINALE
-- ============================================================

SELECT
    count() AS raw_rimanenti
FROM bigintensive.allenamenti_raw;