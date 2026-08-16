import random
import json
from datetime import date, timedelta
from decimal import Decimal

import psycopg
from faker import Faker


# ============================================================
# CONFIGURAZIONE
# ============================================================

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "nome_database",
    "user": "postgres",
    "password": "password",
}

NUM_ATHLETES = 500_000

# Rilevazioni antropometriche
MIN_ANTHROPOMETRIC = 4
MAX_ANTHROPOMETRIC = 8

# Allenamenti per atleta
MIN_WORKOUTS = 150
MAX_WORKOUTS = 365

# Batch PostgreSQL
BATCH_SIZE = 10_000

# Periodo storico
START_DATE = date(2021, 1, 1)
END_DATE = date(2026, 8, 16)

# Seed
SEED = 42

random.seed(SEED)

fake = Faker("it_IT")
Faker.seed(SEED)


# ============================================================
# ESERCIZI
# ============================================================

ESERCIZI = [

    # -------------------------
    # GAMBE
    # -------------------------

    (
        "Squat con bilanciere",
        "Squat con bilanciere libero"
    ),

    (
        "Squat frontale",
        "Squat frontale con bilanciere"
    ),

    (
        "Leg press",
        "Pressa per le gambe"
    ),

    (
        "Affondi con manubri",
        "Affondi eseguiti con manubri"
    ),

    (
        "Affondi bulgari",
        "Squat bulgaro con manubri"
    ),

    (
        "Stacco da terra",
        "Stacco da terra con bilanciere"
    ),

    (
        "Stacco rumeno",
        "Stacco rumeno per la catena posteriore"
    ),

    (
        "Leg extension",
        "Estensione delle gambe alla macchina"
    ),

    (
        "Leg curl",
        "Flessione delle gambe alla macchina"
    ),

    (
        "Calf raise",
        "Sollevamento dei polpacci"
    ),

    # -------------------------
    # PETTO
    # -------------------------

    (
        "Panca piana",
        "Distensione su panca piana con bilanciere"
    ),

    (
        "Panca inclinata",
        "Distensione su panca inclinata con bilanciere"
    ),

    (
        "Panca piana con manubri",
        "Distensione su panca piana con manubri"
    ),

    (
        "Chest press",
        "Spinta alla macchina per il petto"
    ),

    (
        "Croci con manubri",
        "Aperture con manubri"
    ),

    (
        "Croci ai cavi",
        "Aperture ai cavi"
    ),

    # -------------------------
    # DORSO
    # -------------------------

    (
        "Trazioni alla sbarra",
        "Trazioni a corpo libero alla sbarra"
    ),

    (
        "Lat machine",
        "Trazioni alla lat machine"
    ),

    (
        "Rematore con bilanciere",
        "Rematore con bilanciere"
    ),

    (
        "Rematore con manubrio",
        "Rematore con manubrio"
    ),

    (
        "Pulley basso",
        "Trazione orizzontale alla macchina"
    ),

    (
        "Pullover ai cavi",
        "Pullover ai cavi"
    ),

    # -------------------------
    # SPALLE
    # -------------------------

    (
        "Military press",
        "Distensione sopra la testa con bilanciere"
    ),

    (
        "Shoulder press",
        "Spinta per le spalle alla macchina"
    ),

    (
        "Alzate laterali",
        "Alzate laterali con manubri"
    ),

    (
        "Alzate frontali",
        "Alzate frontali con manubri"
    ),

    (
        "Face pull",
        "Trazione ai cavi per deltoidi posteriori"
    ),

    # -------------------------
    # BRACCIA
    # -------------------------

    (
        "Curl con bilanciere",
        "Curl per bicipiti con bilanciere"
    ),

    (
        "Curl con manubri",
        "Curl alternato con manubri"
    ),

    (
        "Hammer curl",
        "Curl a martello con manubri"
    ),

    (
        "Push down",
        "Estensione dei tricipiti ai cavi"
    ),

    (
        "French press",
        "Estensione dei tricipiti"
    ),

    (
        "Dip alle parallele",
        "Dip a corpo libero per petto e tricipiti"
    ),

    # -------------------------
    # CORE
    # -------------------------

    (
        "Crunch",
        "Crunch per la muscolatura addominale"
    ),

    (
        "Plank",
        "Esercizio isometrico per il core"
    ),

    (
        "Russian twist",
        "Rotazioni del tronco"
    ),

    (
        "Leg raise",
        "Sollevamento delle gambe"
    ),
]


# ============================================================
# GRUPPI MUSCOLARI
# ============================================================

GRUPPI_ESERCIZI = {
    "gambe": [
        "Squat con bilanciere",
        "Squat frontale",
        "Leg press",
        "Affondi con manubri",
        "Affondi bulgari",
        "Stacco da terra",
        "Stacco rumeno",
        "Leg extension",
        "Leg curl",
        "Calf raise",
    ],

    "petto": [
        "Panca piana",
        "Panca inclinata",
        "Panca piana con manubri",
        "Chest press",
        "Croci con manubri",
        "Croci ai cavi",
    ],

    "dorso": [
        "Trazioni alla sbarra",
        "Lat machine",
        "Rematore con bilanciere",
        "Rematore con manubrio",
        "Pulley basso",
        "Pullover ai cavi",
    ],

    "spalle": [
        "Military press",
        "Shoulder press",
        "Alzate laterali",
        "Alzate frontali",
        "Face pull",
    ],

    "braccia": [
        "Curl con bilanciere",
        "Curl con manubri",
        "Hammer curl",
        "Push down",
        "French press",
        "Dip alle parallele",
    ],

    "core": [
        "Crunch",
        "Plank",
        "Russian twist",
        "Leg raise",
    ],
}


# ============================================================
# PARAMETRI ESERCIZI
# ============================================================

CARICHI_BASE = {

    "Squat con bilanciere": (40, 140),
    "Squat frontale": (30, 110),
    "Leg press": (80, 250),
    "Affondi con manubri": (8, 35),
    "Affondi bulgari": (8, 30),
    "Stacco da terra": (50, 160),
    "Stacco rumeno": (40, 130),
    "Leg extension": (20, 80),
    "Leg curl": (20, 80),
    "Calf raise": (30, 120),

    "Panca piana": (30, 120),
    "Panca inclinata": (25, 100),
    "Panca piana con manubri": (12, 45),
    "Chest press": (30, 100),
    "Croci con manubri": (6, 25),
    "Croci ai cavi": (5, 25),

    "Trazioni alla sbarra": (0, 20),
    "Lat machine": (30, 100),
    "Rematore con bilanciere": (30, 100),
    "Rematore con manubrio": (12, 45),
    "Pulley basso": (30, 100),
    "Pullover ai cavi": (15, 60),

    "Military press": (20, 70),
    "Shoulder press": (20, 70),
    "Alzate laterali": (4, 18),
    "Alzate frontali": (4, 18),
    "Face pull": (10, 40),

    "Curl con bilanciere": (15, 60),
    "Curl con manubri": (6, 25),
    "Hammer curl": (6, 25),
    "Push down": (15, 60),
    "French press": (15, 50),
    "Dip alle parallele": (0, 20),
}


# ============================================================
# FUNZIONI GENERICHE
# ============================================================

def random_date(start, end):
    """Data casuale inclusiva tra start ed end."""

    if start > end:
        return None

    days = (end - start).days

    return start + timedelta(
        days=random.randint(0, days)
    )


def random_birth_date():
    """Età compresa tra 18 e 55 anni."""

    min_birth = date(
        END_DATE.year - 55,
        END_DATE.month,
        END_DATE.day
    )

    max_birth = date(
        END_DATE.year - 18,
        END_DATE.month,
        END_DATE.day
    )

    return random_date(
        min_birth,
        max_birth
    )


# ============================================================
# ANTROPOMETRIA
# ============================================================

def generate_height(sex):

    if sex == "M":

        height = random.gauss(
            178,
            7
        )

        return int(
            max(
                155,
                min(205, height)
            )
        )

    height = random.gauss(
        165,
        7
    )

    return int(
        max(
            145,
            min(195, height)
        )
    )


def generate_weight(sex, height):

    if sex == "M":

        bmi = random.gauss(
            24.5,
            3
        )

    else:

        bmi = random.gauss(
            22.5,
            3
        )

    weight = bmi * (
        (height / 100) ** 2
    )

    return round(
        max(
            45,
            min(150, weight)
        ),
        2
    )


def generate_anthropometric_values(
    sex,
    birth_date
):

    number = random.randint(
        MIN_ANTHROPOMETRIC,
        MAX_ANTHROPOMETRIC
    )

    height = generate_height(sex)

    first_date = max(
        START_DATE,
        date(
            birth_date.year + 18,
            birth_date.month,
            birth_date.day
        )
    )

    if first_date >= END_DATE:
        return []

    # random.sample evita automaticamente
    # date duplicate
    total_days = (
        END_DATE - first_date
    ).days

    if total_days < number:
        number = total_days

    timestamps = sorted(
        random.sample(
            range(
                total_days + 1
            ),
            number
        )
    )

    initial_weight = generate_weight(
        sex,
        height
    )

    result = []

    for i, offset in enumerate(timestamps):

        measurement_date = (
            first_date +
            timedelta(days=offset)
        )

        if i > 0:

            initial_weight += random.gauss(
                0,
                1.2
            )

        weight = (
            initial_weight +
            random.gauss(0, 1.5)
        )

        weight = round(
            max(
                40,
                min(180, weight)
            ),
            2
        )

        result.append(
            (
                height,
                Decimal(str(weight)),
                measurement_date
            )
        )

    return result


# ============================================================
# GENERAZIONE DI UN ESERCIZIO
# ============================================================

def generate_exercise_data(
    exercise_name,
    sex
):

    # PLANK
    if exercise_name == "Plank":

        return {
            "nome": exercise_name,
            "serie": random.randint(3, 5),
            "durata_secondi": random.choice(
                [30, 45, 60, 75, 90]
            )
        }

    # RANGE CARICO
    min_weight, max_weight = CARICHI_BASE[
        exercise_name
    ]

    # Le donne hanno mediamente carichi inferiori
    if sex == "F":

        min_weight *= 0.70
        max_weight *= 0.70

    weight = random.uniform(
        min_weight,
        max_weight
    )

    return {
        "nome": exercise_name,
        "serie": random.randint(3, 5),
        "ripetizioni": random.randint(6, 15),
        "carico_kg": round(
            weight,
            1
        )
    }


# ============================================================
# ALLENAMENTO
# ============================================================

def generate_strength_workout(
    athlete_id,
    workout_date,
    sex
):

    categoria = random.choice([
        "full_body",
        "parte_superiore",
        "parte_inferiore",
        "ipertrofia",
        "forza"
    ])

    if categoria == "full_body":

        groups = random.sample(
            list(GRUPPI_ESERCIZI.keys()),
            4
        )

    elif categoria == "parte_superiore":

        groups = random.sample(
            [
                "petto",
                "dorso",
                "spalle",
                "braccia",
                "core"
            ],
            3
        )

    elif categoria == "parte_inferiore":

        groups = random.sample(
            [
                "gambe",
                "core"
            ],
            2
        )

    else:

        groups = random.sample(
            list(GRUPPI_ESERCIZI.keys()),
            random.randint(2, 4)
        )

    candidate_exercises = []

    for group in groups:

        candidate_exercises.extend(
            GRUPPI_ESERCIZI[group]
        )

    number_exercises = random.randint(
        5,
        min(8, len(candidate_exercises))
    )

    selected = random.sample(
        candidate_exercises,
        number_exercises
    )

    exercises = []

    for exercise_name in selected:

        exercises.append(
            generate_exercise_data(
                exercise_name,
                sex
            )
        )

    struttura = {

        "tipo": "palestra",

        "categoria": categoria,

        "esercizi": exercises
    }

    durata = random.randint(
        45,
        120
    )

    return (
        athlete_id,
        workout_date,
        "forza",
        durata,
        json.dumps(
            struttura,
            ensure_ascii=False
        )
    )


# ============================================================
# ESERCIZI
# ============================================================

def insert_exercises(conn):

    print("Inserimento esercizi...")

    with conn.cursor() as cur:

        with cur.copy(
            """
            COPY esercizi
            (
                nome_esercizio,
                descrizione
            )
            FROM STDIN
            """
        ) as copy:

            for nome, descrizione in ESERCIZI:

                copy.write_row(
                    (
                        nome,
                        descrizione
                    )
                )

    conn.commit()

    print(
        f"Inseriti {len(ESERCIZI)} esercizi."
    )


# ============================================================
# ATLETI
# ============================================================

def insert_athletes(conn):

    print(
        f"Generazione di "
        f"{NUM_ATHLETES:,} atleti..."
    )

    batch = []

    with conn.cursor() as cur:

        for athlete_id in range(
            1,
            NUM_ATHLETES + 1
        ):

            sesso = random.choice(
                ["M", "F"]
            )

            if sesso == "M":

                nome = fake.first_name_male()

            else:

                nome = fake.first_name_female()

            cognome = fake.last_name()

            birth_date = random_birth_date()

            batch.append(
                (
                    athlete_id,
                    nome,
                    cognome,
                    birth_date,
                    sesso
                )
            )

            if len(batch) >= BATCH_SIZE:

                copy_athletes(
                    cur,
                    batch
                )

                conn.commit()

                print(
                    f"Atleti inseriti: "
                    f"{athlete_id:,}/"
                    f"{NUM_ATHLETES:,}"
                )

                batch.clear()

        if batch:

            copy_athletes(
                cur,
                batch
            )

            conn.commit()

    # Aggiorna sequence SERIAL
    with conn.cursor() as cur:

        cur.execute(
            """
            SELECT setval(
                pg_get_serial_sequence(
                    'athletes',
                    'id'
                ),
                (
                    SELECT MAX(id)
                    FROM athletes
                )
            )
            """
        )

    conn.commit()

    print("Atleti completati.")


def copy_athletes(cur, batch):

    with cur.copy(
        """
        COPY athletes
        (
            id,
            nome,
            cognome,
            data_di_nascita,
            sesso
        )
        FROM STDIN
        """
    ) as copy:

        for row in batch:

            copy.write_row(row)


# ============================================================
# ANTROPOMETRIA
# ============================================================

def insert_anthropometric_values(conn):

    print(
        "Generazione dati antropometrici..."
    )

    batch = []

    with conn.cursor() as cur:

        cur.execute(
            """
            SELECT
                id,
                data_di_nascita,
                sesso
            FROM athletes
            ORDER BY id
            """
        )

        processed = 0

        while True:

            rows = cur.fetchmany(
                BATCH_SIZE
            )

            if not rows:
                break

            for (
                athlete_id,
                birth_date,
                sex
            ) in rows:

                values = (
                    generate_anthropometric_values(
                        sex,
                        birth_date
                    )
                )

                for (
                    height,
                    weight,
                    measurement_date
                ) in values:

                    batch.append(
                        (
                            athlete_id,
                            height,
                            weight,
                            measurement_date
                        )
                    )

                    if len(batch) >= BATCH_SIZE:

                        copy_anthropometry(
                            cur,
                            batch
                        )

                        conn.commit()

                        batch.clear()

            processed += len(rows)

            print(
                f"Antropometria: "
                f"{processed:,}/"
                f"{NUM_ATHLETES:,}"
            )

        if batch:

            copy_anthropometry(
                cur,
                batch
            )

            conn.commit()


def copy_anthropometry(
    cur,
    batch
):

    with cur.copy(
        """
        COPY anthropometric_values
        (
            athlete_id,
            altezza_cm,
            peso_kg,
            data_rilevazione
        )
        FROM STDIN
        """
    ) as copy:

        for row in batch:

            copy.write_row(row)


# ============================================================
# ALLENAMENTI
# ============================================================

def insert_workouts(conn):

    print(
        "Generazione allenamenti "
        "di palestra..."
    )

    batch = []

    with conn.cursor() as cur:

        cur.execute(
            """
            SELECT
                id,
                data_di_nascita,
                sesso
            FROM athletes
            ORDER BY id
            """
        )

        processed = 0

        while True:

            rows = cur.fetchmany(
                BATCH_SIZE
            )

            if not rows:
                break

            for (
                athlete_id,
                birth_date,
                sex
            ) in rows:

                # Numero allenamenti
                num_workouts = random.randint(
                    MIN_WORKOUTS,
                    MAX_WORKOUTS
                )

                training_start = max(
                    START_DATE,
                    date(
                        birth_date.year + 18,
                        birth_date.month,
                        birth_date.day
                    )
                )

                if training_start >= END_DATE:
                    continue

                # Creiamo un insieme di date
                # per impedire più allenamenti
                # nello stesso giorno.
                available_days = (
                    END_DATE -
                    training_start
                ).days + 1

                num_workouts = min(
                    num_workouts,
                    available_days
                )

                workout_offsets = sorted(
                    random.sample(
                        range(
                            available_days
                        ),
                        num_workouts
                    )
                )

                for offset in workout_offsets:

                    workout_date = (
                        training_start +
                        timedelta(days=offset)
                    )

                    workout = (
                        generate_strength_workout(
                            athlete_id,
                            workout_date,
                            sex
                        )
                    )

                    batch.append(
                        workout
                    )

                    if len(batch) >= BATCH_SIZE:

                        copy_workouts(
                            cur,
                            batch
                        )

                        conn.commit()

                        batch.clear()

            processed += len(rows)

            print(
                f"Allenamenti: "
                f"{processed:,}/"
                f"{NUM_ATHLETES:,}"
            )

        if batch:

            copy_workouts(
                cur,
                batch
            )

            conn.commit()

    print(
        "Allenamenti completati."
    )


def copy_workouts(
    cur,
    batch
):

    with cur.copy(
        """
        COPY allenamenti
        (
            athlete_id,
            data_allenamento,
            tipo_allenamento,
            durata_minuti,
            struttura_allenamento
        )
        FROM STDIN
        """
    ) as copy:

        for row in batch:

            copy.write_row(row)


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("=" * 65)
    print("GENERATORE DATASET ATLETI")
    print("=" * 65)

    print(
        f"Atleti:              "
        f"{NUM_ATHLETES:,}"
    )

    print(
        "Allenamenti:         "
        "SOLO PALESTRA"
    )

    print(
        "Riepilogo corse:     "
        "NON GENERATO"
    )

    print(
        "Training status:     "
        "NON GENERATO"
    )

    print(
        "Tipo allenamento:    "
        "forza"
    )

    print(
        f"Seed:                "
        f"{SEED}"
    )

    print("=" * 65)
    print()

    with psycopg.connect(
        **DB_CONFIG
    ) as conn:

        # 1
        insert_exercises(conn)

        # 2
        insert_athletes(conn)

        # 3
        insert_anthropometric_values(
            conn
        )

        # 4
        insert_workouts(conn)

    print()
    print("=" * 65)
    print("GENERAZIONE COMPLETATA")
    print("=" * 65)
    print()
    print("Tabelle popolate:")
    print("  ✓ athletes")
    print("  ✓ anthropometric_values")
    print("  ✓ allenamenti")
    print("  ✓ esercizi")
    print()
    print("Tabelle NON popolate:")
    print("  - riepilogo_corse")
    print("  - training_status_results")
    print()


if __name__ == "__main__":
    main()