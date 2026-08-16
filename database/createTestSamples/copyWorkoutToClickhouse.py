import time
from datetime import datetime

import psycopg
import clickhouse_connect


# ============================================================
# CONFIGURAZIONE POSTGRESQL
# ============================================================

POSTGRES_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "nome_database",
    "user": "postgres",
    "password": "password",
}


# ============================================================
# CONFIGURAZIONE CLICKHOUSE
# ============================================================

CLICKHOUSE_CONFIG = {
    "host": "localhost",
    "port": 8123,
    "username": "default",
    "password": "password",
    "database": "sport",
}


# ============================================================
# CONFIGURAZIONE ETL
# ============================================================

# Numero di allenamenti PostgreSQL letti per volta
POSTGRES_BATCH_SIZE = 10_000

# Numero massimo di righe ClickHouse accumulate prima
# di fare un INSERT.
#
# ATTENZIONE:
# 10.000 allenamenti possono diventare molte più righe
# dopo l'espansione delle serie.
CLICKHOUSE_BATCH_SIZE = 100_000


# ============================================================
# CONNESSIONE POSTGRESQL
# ============================================================

def connect_postgres():

    return psycopg.connect(
        **POSTGRES_CONFIG
    )


# ============================================================
# CONNESSIONE CLICKHOUSE
# ============================================================

def connect_clickhouse():

    return clickhouse_connect.get_client(
        host=CLICKHOUSE_CONFIG["host"],
        port=CLICKHOUSE_CONFIG["port"],
        username=CLICKHOUSE_CONFIG["username"],
        password=CLICKHOUSE_CONFIG["password"],
        database=CLICKHOUSE_CONFIG["database"],
    )


# ============================================================
# CREAZIONE TABELLA CLICKHOUSE
# ============================================================

def create_clickhouse_table(ch):

    print("Controllo database e tabella ClickHouse...")

    ch.command(
        """
        CREATE DATABASE IF NOT EXISTS sport
        """
    )

    ch.command(
        """
        CREATE TABLE IF NOT EXISTS sport.allenamenti
        (
            allenamento_id UInt64,
            athlete_id UInt64,

            data_allenamento DateTime,

            serie_allenamento UInt8,
            ripetizioni_allenamento UInt8,
            recupero_allenamento UInt8,

            peso_allenamento Decimal(5, 2),

            created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree

        PARTITION BY toYYYYMM(data_allenamento)

        ORDER BY (
            data_allenamento,
            athlete_id,
            allenamento_id
        )
        """
    )

    print("Tabella ClickHouse pronta.")


# ============================================================
# RECUPERA ULTIMO ALLENAMENTO SINCRONIZZATO
# ============================================================

def get_last_allenamento_id(ch):

    result = ch.query(
        """
        SELECT max(allenamento_id)
        FROM sport.allenamenti
        """
    )

    value = result.result_rows[0][0]

    if value is None:
        return 0

    return int(value)


# ============================================================
# CONVERSIONE JSON → RIGHE CLICKHOUSE
# ============================================================

def convert_workout_to_rows(
    workout_id,
    athlete_id,
    workout_date,
    workout_structure,
    created_at
):

    rows = []

    # --------------------------------------------------------
    # Controllo struttura JSON
    # --------------------------------------------------------

    if not workout_structure:

        return rows

    if "esercizi" not in workout_structure:

        return rows

    exercises = workout_structure["esercizi"]

    # --------------------------------------------------------
    # Ogni esercizio
    # --------------------------------------------------------

    for exercise in exercises:

        numero_serie = exercise.get(
            "serie",
            0
        )

        ripetizioni = exercise.get(
            "ripetizioni",
            0
        )

        recupero = exercise.get(
            "recupero_secondi",
            0
        )

        peso = exercise.get(
            "carico_kg",
            0
        )

        # ----------------------------------------------------
        # Plank
        #
        # Nel generatore il plank non ha ripetizioni/carico.
        # Lo gestiamo comunque senza rompere l'ETL.
        # ----------------------------------------------------

        if numero_serie is None:
            numero_serie = 0

        if ripetizioni is None:
            ripetizioni = 0

        if recupero is None:
            recupero = 0

        if peso is None:
            peso = 0

        # ----------------------------------------------------
        # Una riga per ogni serie
        # ----------------------------------------------------

        for serie_numero in range(
            1,
            numero_serie + 1
        ):

            rows.append(
                (
                    int(workout_id),

                    int(athlete_id),

                    workout_date,

                    serie_numero,

                    int(ripetizioni),

                    int(recupero),

                    round(
                        float(peso),
                        2
                    ),

                    created_at
                )
            )

    return rows


# ============================================================
# INSERT BATCH CLICKHOUSE
# ============================================================

def insert_clickhouse_batch(
    ch,
    rows
):

    if not rows:
        return

    ch.insert(
        "sport.allenamenti",
        rows,

        column_names=[
            "allenamento_id",
            "athlete_id",
            "data_allenamento",
            "serie_allenamento",
            "ripetizioni_allenamento",
            "recupero_allenamento",
            "peso_allenamento",
            "created_at"
        ]
    )


# ============================================================
# SINCRONIZZAZIONE
# ============================================================

def sync_allenamenti(
    pg,
    ch
):

    print()
    print("=" * 70)
    print("SINCRONIZZAZIONE ALLENAMENTI")
    print("=" * 70)

    # --------------------------------------------------------
    # Ultimo ID già presente
    # --------------------------------------------------------

    last_id = get_last_allenamento_id(
        ch
    )

    print(
        f"Ultimo allenamento ClickHouse: "
        f"{last_id:,}"
    )

    total_workouts = 0
    total_rows = 0

    clickhouse_rows = []

    # --------------------------------------------------------
    # Cursor PostgreSQL
    # --------------------------------------------------------

    with pg.cursor() as cur:

        while True:

            print()
            print(
                f"Lettura PostgreSQL "
                f"da ID > {last_id:,}"
            )

            cur.execute(
                """
                SELECT
                    id,
                    athlete_id,
                    data_allenamento,
                    struttura_allenamento,
                    created_at
                FROM allenamenti
                WHERE id > %s
                ORDER BY id
                LIMIT %s
                """,
                (
                    last_id,
                    POSTGRES_BATCH_SIZE
                )
            )

            workouts = cur.fetchall()

            # ------------------------------------------------
            # Nessun altro dato
            # ------------------------------------------------

            if not workouts:

                break

            # ------------------------------------------------
            # Convertiamo gli allenamenti
            # ------------------------------------------------

            for (
                workout_id,
                athlete_id,
                workout_date,
                workout_structure,
                created_at
            ) in workouts:

                rows = convert_workout_to_rows(
                    workout_id,
                    athlete_id,
                    workout_date,
                    workout_structure,
                    created_at
                )

                clickhouse_rows.extend(
                    rows
                )

                total_workouts += 1

                # --------------------------------------------
                # Quando raggiungiamo il batch CH
                # --------------------------------------------

                if len(clickhouse_rows) >= CLICKHOUSE_BATCH_SIZE:

                    print(
                        f"  Inserimento "
                        f"{len(clickhouse_rows):,} "
                        f"righe in ClickHouse..."
                    )

                    insert_clickhouse_batch(
                        ch,
                        clickhouse_rows
                    )

                    total_rows += len(
                        clickhouse_rows
                    )

                    clickhouse_rows.clear()

                    print(
                        f"  Righe ClickHouse "
                        f"totali: "
                        f"{total_rows:,}"
                    )

            # ------------------------------------------------
            # Tutti gli allenamenti del batch sono stati
            # trasformati.
            #
            # L'ultimo ID diventa il nuovo checkpoint.
            # ------------------------------------------------

            last_id = workouts[-1][0]

            print(
                f"Allenamenti elaborati: "
                f"{total_workouts:,}"
            )

            print(
                f"Ultimo ID elaborato: "
                f"{last_id:,}"
            )

    # --------------------------------------------------------
    # Ultimo batch ClickHouse
    # --------------------------------------------------------

    if clickhouse_rows:

        print(
            f"Inserimento ultimo batch: "
            f"{len(clickhouse_rows):,} righe..."
        )

        insert_clickhouse_batch(
            ch,
            clickhouse_rows
        )

        total_rows += len(
            clickhouse_rows
        )

        clickhouse_rows.clear()

    # --------------------------------------------------------
    # RISULTATO
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("SINCRONIZZAZIONE COMPLETATA")
    print("=" * 70)

    print(
        f"Allenamenti PostgreSQL elaborati: "
        f"{total_workouts:,}"
    )

    print(
        f"Righe ClickHouse generate: "
        f"{total_rows:,}"
    )

    print(
        f"Ultimo ID: "
        f"{last_id:,}"
    )

    print("=" * 70)


# ============================================================
# MAIN
# ============================================================

def main():

    start_time = time.time()

    print()
    print("=" * 70)
    print("POSTGRESQL → CLICKHOUSE")
    print("ETL ALLENAMENTI")
    print("=" * 70)

    print(
        "Inizio:",
        datetime.now()
    )

    pg = None
    ch = None

    try:

        # ----------------------------------------------------
        # Connessioni
        # ----------------------------------------------------

        print(
            "Connessione PostgreSQL..."
        )

        pg = connect_postgres()

        print(
            "Connessione ClickHouse..."
        )

        ch = connect_clickhouse()

        # ----------------------------------------------------
        # Tabella ClickHouse
        # ----------------------------------------------------

        create_clickhouse_table(
            ch
        )

        # ----------------------------------------------------
        # Sincronizzazione
        # ----------------------------------------------------

        sync_allenamenti(
            pg,
            ch
        )

    except Exception as e:

        print()
        print("=" * 70)
        print("ERRORE DURANTE LA SINCRONIZZAZIONE")
        print("=" * 70)

        print(
            type(e).__name__,
            ":",
            e
        )

        raise

    finally:

        if pg is not None:
            pg.close()

        if ch is not None:
            ch.close()

    elapsed = (
        time.time() -
        start_time
    )

    print()
    print("=" * 70)
    print("OPERAZIONE TERMINATA")
    print("=" * 70)

    print(
        f"Durata: "
        f"{elapsed / 60:.2f} minuti"
    )

    print(
        "Fine:",
        datetime.now()
    )


# ============================================================
# AVVIO
# ============================================================

if __name__ == "__main__":

    main()