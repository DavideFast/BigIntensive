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
# CONFIGURAZIONE
# ============================================================

BATCH_SIZE = 50_000


# ============================================================
# CONNESSIONI
# ============================================================

def connect_postgres():

    return psycopg.connect(
        **POSTGRES_CONFIG
    )


def connect_clickhouse():

    return clickhouse_connect.get_client(
        host=CLICKHOUSE_CONFIG["host"],
        port=CLICKHOUSE_CONFIG["port"],
        username=CLICKHOUSE_CONFIG["username"],
        password=CLICKHOUSE_CONFIG["password"],
        database=CLICKHOUSE_CONFIG["database"],
    )


# ============================================================
# CREA TABELLA CLICKHOUSE
# ============================================================

def create_clickhouse_table(ch):

    print("Controllo tabella ClickHouse...")

    ch.command(
        """
        CREATE DATABASE IF NOT EXISTS sport
        """
    )

    ch.command(
        """
        CREATE TABLE IF NOT EXISTS sport.allenamenti
        (
            id UInt32,
            athlete_id UInt32,
            data_allenamento Date,
            tipo_allenamento LowCardinality(String),
            durata_minuti UInt16,
            struttura_allenamento String,
            created_at DateTime
        )
        ENGINE = MergeTree
        ORDER BY (
            athlete_id,
            data_allenamento,
            id
        )
        """
    )

    print("Tabella pronta.")


# ============================================================
# ULTIMO ID PRESENTE IN CLICKHOUSE
# ============================================================

def get_last_id(ch):

    result = ch.query(
        """
        SELECT max(id)
        FROM sport.allenamenti
        """
    )

    value = result.result_rows[0][0]

    if value is None:
        return 0

    return int(value)


# ============================================================
# SINCRONIZZAZIONE
# ============================================================

def sync_allenamenti(pg, ch):

    print()
    print("=" * 60)
    print("SINCRONIZZAZIONE ALLENAMENTI")
    print("=" * 60)

    last_id = get_last_id(ch)

    print(
        f"Ultimo ID presente in ClickHouse: "
        f"{last_id:,}"
    )

    total = 0

    with pg.cursor() as cur:

        while True:

            cur.execute(
                """
                SELECT
                    id,
                    athlete_id,
                    data_allenamento,
                    tipo_allenamento,
                    durata_minuti,
                    struttura_allenamento::text,
                    created_at
                FROM allenamenti
                WHERE id > %s
                ORDER BY id
                LIMIT %s
                """,
                (
                    last_id,
                    BATCH_SIZE
                )
            )

            rows = cur.fetchall()

            if not rows:
                break

            # -----------------------------------------------
            # INSERIMENTO BATCH IN CLICKHOUSE
            # -----------------------------------------------

            ch.insert(
                "sport.allenamenti",
                rows
            )

            # -----------------------------------------------
            # AGGIORNA ULTIMO ID
            # -----------------------------------------------

            last_id = rows[-1][0]

            total += len(rows)

            print(
                f"Copiati: "
                f"{total:,} "
                f"| ultimo ID: "
                f"{last_id:,}"
            )

    print()
    print(
        f"Sincronizzazione terminata."
    )

    print(
        f"Nuovi allenamenti copiati: "
        f"{total:,}"
    )

    return total


# ============================================================
# MAIN
# ============================================================

def main():

    start = time.time()

    print()
    print("=" * 60)
    print("POSTGRESQL → CLICKHOUSE")
    print("SOLO ALLENAMENTI")
    print("=" * 60)

    print(
        "Inizio:",
        datetime.now()
    )

    pg = connect_postgres()
    ch = connect_clickhouse()

    try:

        # 1. Crea la tabella se non esiste
        create_clickhouse_table(ch)

        # 2. Trasferisce solamente i nuovi allenamenti
        sync_allenamenti(
            pg,
            ch
        )

    finally:

        pg.close()
        ch.close()

    elapsed = time.time() - start

    print()
    print("=" * 60)
    print("OPERAZIONE COMPLETATA")
    print("=" * 60)

    print(
        f"Tempo: "
        f"{elapsed / 60:.2f} minuti"
    )

    print(
        "Fine:",
        datetime.now()
    )


if __name__ == "__main__":
    main()