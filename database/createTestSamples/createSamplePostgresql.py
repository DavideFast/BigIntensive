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

# Rilevazioni antropometriche per atleta
MIN_ANTHROPOMETRIC = 4
MAX_ANTHROPOMETRIC = 10

# Allenamenti di palestra per atleta
MIN_WORKOUTS = 10
MAX_WORKOUTS = 60

# Dimensione dei batch
BATCH_SIZE = 10_000

# Periodo dei dati
START_DATE = date(2021, 1, 1)
END_DATE = date(2026, 8, 16)

# Seed per rendere la generazione riproducibile
SEED = 42

random.seed(SEED)
fake = Faker("it_IT")
Faker.seed(SEED)


# ============================================================
# DATI ESERCIZI
# ============================================================

ESERCIZI = [
    # GAMBE
    ("Squat con bilanciere", "forza",
     "Squat con bilanciere libero"),
    ("Squat frontale", "forza",
     "Squat frontale con bilanciere"),
    ("Leg press", "forza",
     "Pressa per le gambe"),
    ("Affondi con manubri", "forza",
     "Affondi con manubri"),
    ("Affondi bulgari", "forza",
     "Squat bulgaro con manubri"),
    ("Stacco da terra", "forza",
     "Stacco da terra con bilanciere"),
    ("Stacco rumeno", "forza",
     "Stacco rumeno per catena posteriore"),
    ("Leg extension", "forza",
     "Estensione delle gambe alla macchina"),
    ("Leg curl", "forza",
     "Flessione delle gambe alla macchina"),
    ("Calf raise", "forza",
     "Sollevamento dei polpacci"),

    # PETTO
    ("Panca piana", "forza",
     "Distensione su panca piana con bilanciere"),
    ("Panca inclinata", "forza",
     "Distensione su panca inclinata"),
    ("Panca piana con manubri", "forza",
     "Distensione con manubri"),
    ("Chest press", "forza",
     "Spinta alla macchina per il petto"),
    ("Croci con manubri", "forza",
     "Aperture con manubri"),
    ("Croci ai cavi", "forza",
     "Aperture ai cavi"),

    # DORSO
    ("Trazioni alla sbarra", "forza",
     "Trazioni a corpo libero"),
    ("Lat machine", "forza",
     "Trazioni alla lat machine"),
    ("Rematore con bilanciere", "forza",
     "Rematore con bilanciere"),
    ("Rematore con manubrio", "forza",
     "Rematore con manubrio"),
    ("Pulley basso", "forza",
     "Trazione orizzontale alla macchina"),
    ("Pullover ai cavi", "forza",
     "Pullover ai cavi"),

    # SPALLE
    ("Military press", "forza",
     "Distensione sopra la testa"),
    ("Shoulder press", "forza",
     "Spinta per le spalle alla macchina"),
    ("Alzate laterali", "forza",
     "Alzate laterali con manubri"),
    ("Alzate frontali", "forza",
     "Alzate frontali con manubri"),
    ("Face pull", "forza",
     "Trazione ai cavi per deltoidi posteriori"),

    # BRACCIA
    ("Curl con bilanciere", "forza",
     "Curl per bicipiti con bilanciere"),
    ("Curl con manubri", "forza",
     "Curl alternato con manubri"),
    ("Hammer curl", "forza",
     "Curl a martello"),
    ("Push down", "forza",
     "Estensione dei tricipiti ai cavi"),
    ("French press", "forza",
     "Estensione dei tricipiti"),
    ("Dip alle parallele", "forza",
     "Dip per petto e tricipiti"),

    # CORE
    ("Crunch", "forza",
     "Crunch per la muscolatura addominale"),
    ("Plank", "forza",
     "Isometria per il core"),
    ("Russian twist", "forza",
     "Rotazioni del tronco"),
    ("Leg raise", "forza",
     "Sollevamento delle gambe"),
]


# ============================================================
# FUNZIONI UTILI
# ============================================================

def random_date(start, end):
    """Genera una data casuale compresa nell'intervallo."""
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def random_birth_date():
    """
    Genera una data di nascita plausibile.
    Età compresa indicativamente tra 18 e 55 anni.
    """
    today = END_DATE

    min_birth = date(today.year - 55, today.month, today.day)
    max_birth = date(today.year - 18, today.month, today.day)

    return random_date(min_birth, max_birth)


def generate_height(sex):
    """Altezza plausibile in cm."""
    if sex == "M":
        return max(155, min(205, int(random.gauss(178, 8))))
    else:
        return max(145, min(195, int(random.gauss(165, 7))))


def generate_weight(sex, height):
    """
    Genera un peso plausibile in relazione all'altezza.
    """
    if sex == "M":
        bmi = random.gauss(24.5, 3.2)
    else:
        bmi = random.gauss(22.5, 3.0)

    weight = bmi * ((height / 100) ** 2)

    return round(max(45, min(150, weight)), 2)


def generate_anthropometric_values(sex, birth_date):
    """
    Genera più rilevazioni antropometriche per lo stesso atleta.
    """
    number = random.randint(
        MIN_ANTHROPOMETRIC,
        MAX_ANTHROPOMETRIC
    )

    # Altezza praticamente stabile
    height = generate_height(sex)

    first_date = max(
        START_DATE,
        date(birth_date.year + 18, 1, 1)
    )

    if first_date >= END_DATE:
        return []

    dates = []

    for _ in range(number):
        d = random_date(first_date, END_DATE)

        if d not in dates:
            dates.append(d)

    dates.sort()

    initial_weight = generate_weight(sex, height)

    result = []

    for i, d in enumerate(dates):
        # Piccola variazione del peso nel tempo
        variation = random.gauss(0, 2.5)

        if i > 0:
            initial_weight += random.gauss(0, 1.2)

        weight = round(
            max(40, min(180, initial_weight + variation)),
            2
        )

        result.append(
            (height, weight, d)
        )

    return result


def generate_strength_workout(athlete_id, workout_date):
    """
    Genera un allenamento ESCLUSIVAMENTE di palestra.
    """

    # Selezioniamo 4-8 esercizi
    number_exercises = random.randint(4, 8)

    selected = random.sample(
        ESERCIZI,
        number_exercises
    )

    exercises = []

    for name, tipo, description in selected:

        # Plank viene gestito diversamente
        if name == "Plank":
            exercise = {
                "nome": name,
                "serie": random.randint(3, 5),
                "durata_secondi": random.choice(
                    [30, 45, 60, 75, 90]
                )
            }

        else:
            exercise = {
                "nome": name,
                "serie": random.randint(3, 5),
                "ripetizioni": random.randint(6, 15),
                "carico_kg": round(
                    random.uniform(5, 120),
                    1
                )
            }

        exercises.append(exercise)

    struttura = {
        "tipo": "forza",
        "categoria": random.choice([
            "ipertrofia",
            "forza",
            "full_body",
            "parte_superiore",
            "parte_inferiore"
        ]),
        "esercizi": exercises
    }

    durata = random.randint(45, 120)

    return (
        athlete_id,
        workout_date,
        "forza",
        durata,
        json.dumps(struttura, ensure_ascii=False)
    )


# ============================================================
# CREAZIONE ESERCIZI
# ============================================================

def insert_exercises(conn):
    print("Inserimento esercizi...")

    with conn.cursor() as cur:

        for nome, tipo, descrizione in ESERCIZI:

            cur.execute(
                """
                INSERT INTO esercizi
                    (nome_esercizio, tipo_esercizio, descrizione)
                VALUES
                    (%s, %s, %s)
                """,
                (nome, tipo, descrizione)
            )

    conn.commit()

    print(f"Inseriti {len(ESERCIZI)} esercizi.")


# ============================================================
# CREAZIONE ATLETI
# ============================================================

def insert_athletes(conn):
    print(f"Generazione di {NUM_ATHLETES:,} atleti...")

    athlete_cache = []

    with conn.cursor() as cur:

        for athlete_id in range(1, NUM_ATHLETES + 1):

            sesso = random.choice(["M", "F"])

            nome = fake.first_name_male() \
                if sesso == "M" \
                else fake.first_name_female()

            cognome = fake.last_name()

            birth_date = random_birth_date()

            athlete_cache.append(
                (
                    athlete_id,
                    nome,
                    cognome,
                    birth_date,
                    sesso
                )
            )

            if len(athlete_cache) >= BATCH_SIZE:

                with cur.copy(
                    """
                    COPY athletes
                    (id, nome, cognome, data_di_nascita, sesso)
                    FROM STDIN
                    """
                ) as copy:

                    for row in athlete_cache:
                        copy.write_row(row)

                conn.commit()

                print(
                    f"Atleti inseriti: "
                    f"{athlete_id:,}/{NUM_ATHLETES:,}"
                )

                athlete_cache.clear()

        # Ultimo batch
        if athlete_cache:

            with cur.copy(
                """
                COPY athletes
                (id, nome, cognome, data_di_nascita, sesso)
                FROM STDIN
                """
            ) as copy:

                for row in athlete_cache:
                    copy.write_row(row)

            conn.commit()

    # Aggiorniamo la sequence del SERIAL
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT setval(
                pg_get_serial_sequence('athletes', 'id'),
                (SELECT MAX(id) FROM athletes)
            )
            """
        )

    conn.commit()

    print("Atleti completati.")


# ============================================================
# DATI ANTROPOMETRICI
# ============================================================

def insert_anthropometric_values(conn):
    print("Generazione dati antropometrici...")

    batch = []

    with conn.cursor() as cur:

        # Recuperiamo solamente i dati necessari
        cur.execute(
            """
            SELECT id, data_di_nascita, sesso
            FROM athletes
            ORDER BY id
            """
        )

        while True:

            rows = cur.fetchmany(BATCH_SIZE)

            if not rows:
                break

            for athlete_id, birth_date, sex in rows:

                values = generate_anthropometric_values(
                    sex,
                    birth_date
                )

                for height, weight, measurement_date in values:

                    batch.append(
                        (
                            athlete_id,
                            height,
                            Decimal(str(weight)),
                            measurement_date
                        )
                    )

                if len(batch) >= BATCH_SIZE:

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

                    conn.commit()
                    batch.clear()

            print(
                f"Processati fino all'atleta "
                f"{rows[-1][0]:,}/{NUM_ATHLETES:,}"
            )

        if batch:

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

            conn.commit()

    print("Dati antropometrici completati.")


# ============================================================
# ALLENAMENTI
# ============================================================

def insert_workouts(conn):
    print("Generazione allenamenti di palestra...")

    batch = []

    with conn.cursor() as cur:

        cur.execute(
            """
            SELECT id, data_di_nascita
            FROM athletes
            ORDER BY id
            """
        )

        processed = 0

        while True:

            rows = cur.fetchmany(BATCH_SIZE)

            if not rows:
                break

            for athlete_id, birth_date in rows:

                # Numero casuale di allenamenti
                num_workouts = random.randint(
                    MIN_WORKOUTS,
                    MAX_WORKOUTS
                )

                # L'atleta non può allenarsi prima dei 18 anni
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

                for _ in range(num_workouts):

                    workout_date = random_date(
                        training_start,
                        END_DATE
                    )

                    workout = generate_strength_workout(
                        athlete_id,
                        workout_date
                    )

                    batch.append(workout)

                    if len(batch) >= BATCH_SIZE:

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

                        conn.commit()
                        batch.clear()

            processed += len(rows)

            print(
                f"Atleti processati: "
                f"{processed:,}/{NUM_ATHLETES:,}"
            )

        if batch:

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

            conn.commit()

    print("Allenamenti completati.")


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 60)
    print("GENERATORE DATASET ATLETI")
    print("=" * 60)

    print(f"Atleti:       {NUM_ATHLETES:,}")
    print("Corsa:        NO")
    print("Training:     NO")
    print("Palestra:     SI")
    print(f"Seed:         {SEED}")
    print("=" * 60)

    with psycopg.connect(**DB_CONFIG) as conn:

        # 1. Catalogo esercizi
        insert_exercises(conn)

        # 2. 500.000 atleti
        insert_athletes(conn)

        # 3. Misurazioni antropometriche
        insert_anthropometric_values(conn)

        # 4. Solo allenamenti di palestra
        insert_workouts(conn)

    print()
    print("=" * 60)
    print("GENERAZIONE COMPLETATA")
    print("=" * 60)
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
