#!/usr/bin/env python3
"""
Generate realistic fake training data for BigIntensive.
Populates:
  - ClickHouse: cardio (corsa_endurance_campioni), exercise details (allenamento_dettagli), coach feedback
  - Citus: injury history (injury_history)
90 days of data for 1000 athletes.
"""

import os
import random
import math
from datetime import datetime, timedelta
import psycopg2
import clickhouse_driver

# Database connections
CITUS_HOST = os.getenv("CITUS_HOST", "localhost")
CITUS_PORT = int(os.getenv("CITUS_PORT", 5432))
CITUS_USER = os.getenv("CITUS_USER", "postgres")
CITUS_PASSWORD = os.getenv("CITUS_PASSWORD", "postgres")
CITUS_DB = os.getenv("CITUS_DB", "bigintensive")

CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", 9000))
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")

# Data generation parameters
NUM_ATHLETES = 1000
DAYS = 90
START_DATE = datetime.now() - timedelta(days=DAYS)

def connect_citus():
    """Connect to Citus PostgreSQL"""
    return psycopg2.connect(
        host=CITUS_HOST,
        port=CITUS_PORT,
        user=CITUS_USER,
        password=CITUS_PASSWORD,
        database=CITUS_DB
    )

def connect_clickhouse():
    """Connect to ClickHouse"""
    return clickhouse_driver.Client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        user=CLICKHOUSE_USER,
        password=CLICKHOUSE_PASSWORD,
        database="bigintensive"
    )

def generate_athletes():
    """Generate N realistic athletes with random names and attributes"""
    first_names = [
        "Marco", "Giulia", "Alessandro", "Luca", "Marta", "Davide", "Elena", "Andrea",
        "Francesco", "Chiara", "Lorenzo", "Alessia", "Matteo", "Sofia", "Riccardo",
        "Valentina", "Giovanni", "Federica", "Carlo", "Martina", "Paolo", "Giuliana",
        "Roberto", "Silvia", "Antonio", "Francesca", "Domenico", "Roberta", "Giuseppe",
        "Antonietta", "Vincenzo", "Stefania", "Pietro", "Monica", "Luigi", "Patrizia",
        "Salvatore", "Teresa", "Carmelo", "Paola", "Gennaro", "Vittoria", "Vito",
        "Giovanna", "Nicola", "Rita", "Pasquale", "Adriana", "Giancarlo", "Benedetta"
    ]
    
    last_names = [
        "Rossi", "Bianchi", "Verdi", "Ferri", "Leone", "Moretti", "Vanni", "Gallo",
        "Romano", "Giordano", "Conti", "Rizzo", "Colombo", "Riccardi", "Martinelli",
        "Barbieri", "Rolla", "Graziani", "Fontana", "Benedetti", "Gatti", "Rinaldi",
        "De Luca", "Costa", "Ferrara", "Lombardi", "Sala", "Santoro", "Palumbo",
        "Sorrentino", "Gentile", "Mantovani", "Villa", "Rossi", "Ferretti", "Marzi",
        "Palmieri", "Pini", "Russo", "Ferrari", "Esposito", "Baldi", "Sartori"
    ]
    
    athletes = []
    for i in range(NUM_ATHLETES):
        nome = random.choice(first_names)
        cognome = random.choice(last_names)
        eta = random.randint(18, 60)
        sesso = random.choice(['M', 'F'])
        altezza_cm = random.randint(155, 195) if sesso == 'F' else random.randint(165, 205)
        peso_kg = round(random.uniform(50, 120) if sesso == 'F' else random.uniform(70, 140), 1)
        
        athletes.append((nome, cognome, eta, sesso, altezza_cm, peso_kg))
    
    return athletes

def generate_cardio_session(athlete_id, session_date, session_num):
    """
    Generate a realistic cardio (running) session with 30-60 minute duration.
    Heart rate: warm-up (120-140), main work (150-180), cool-down (110-130)
    """
    duration_min = random.randint(30, 60)
    duration_sec = duration_min * 60
    
    # Session starts at random time between 6 AM and 7 PM
    hour = random.randint(6, 19)
    minute = random.randint(0, 59)
    session_ts = datetime.combine(session_date, datetime.min.time()).replace(hour=hour, minute=minute)
    
    session_id = int(session_ts.timestamp())  # Use timestamp as session_id
    
    samples = []
    base_hr = random.randint(60, 75)  # Resting HR varies by athlete
    base_speed = random.uniform(8, 15)  # km/h
    base_cadence = random.randint(170, 185)  # steps/min
    base_altitude = random.randint(0, 500)
    base_temp = random.uniform(15, 25)
    
    # Warm-up phase (0-10%)
    warmup_sec = int(duration_sec * 0.1)
    for sec in range(0, warmup_sec, 10):
        ts = session_ts + timedelta(seconds=sec)
        hr = base_hr + random.randint(20, 40)
        speed = base_speed * random.uniform(0.7, 0.85)
        cadence = base_cadence * random.uniform(0.9, 0.98)
        altitude = base_altitude + random.randint(-20, 20)
        temp = base_temp + random.uniform(-1, 1)
        samples.append((athlete_id, session_id, sec // 10, hr, cadence, speed, altitude, temp, ts))
    
    # Main work phase (10-85%)
    work_start = warmup_sec
    work_end = int(duration_sec * 0.85)
    for sec in range(work_start, work_end, 10):
        ts = session_ts + timedelta(seconds=sec)
        hr = base_hr + random.randint(50, 90)
        speed = base_speed * random.uniform(0.95, 1.15)
        cadence = base_cadence * random.uniform(0.95, 1.05)
        altitude = base_altitude + random.randint(-30, 30)
        temp = base_temp + random.uniform(-2, 2)
        samples.append((athlete_id, session_id, sec // 10, hr, cadence, speed, altitude, temp, ts))
    
    # Cool-down phase (85-100%)
    cooldown_start = work_end
    for sec in range(cooldown_start, duration_sec, 10):
        ts = session_ts + timedelta(seconds=sec)
        hr = base_hr + random.randint(10, 35)
        speed = base_speed * random.uniform(0.6, 0.75)
        cadence = base_cadence * random.uniform(0.85, 0.95)
        altitude = base_altitude + random.randint(-20, 20)
        temp = base_temp + random.uniform(-1, 1)
        samples.append((athlete_id, session_id, sec // 10, hr, cadence, speed, altitude, temp, ts))
    
    return samples

def generate_exercise_session(athlete_id, session_date, exercise_id, allenamento_id):
    """Generate exercise metrics (strength/power session)"""
    # 2-5 exercises per session, 3-4 sets per exercise, 6-12 reps
    num_exercises = random.randint(2, 5)
    details = []
    
    session_ts = datetime.combine(session_date, datetime.min.time()).replace(
        hour=random.randint(6, 19), minute=random.randint(0, 59)
    )
    
    for order in range(1, num_exercises + 1):
        num_sets = random.randint(3, 4)
        num_reps = random.randint(6, 12)
        rest_sec = random.randint(60, 180)
        
        # Risultato = strength metric (kg lifted, jump height, RSI, etc)
        base_result = random.uniform(20, 100)
        result = base_result + random.uniform(-5, 10)  # Slight variation session to session
        
        ts = session_ts + timedelta(seconds=order * 5)  # Offset timestamps
        details.append((allenamento_id, athlete_id, exercise_id, order, num_sets, num_reps, rest_sec, result, ts))
    
    return details

def populate_citus_injuries():
    """Insert injury history in Citus"""
    conn = connect_citus()
    cur = conn.cursor()
    
    injuries = []
    for athlete_id in range(1, NUM_ATHLETES + 1):
        # 0-2 injuries per athlete over 90 days
        num_injuries = random.randint(0, 2)
        for _ in range(num_injuries):
            injury_date = START_DATE + timedelta(days=random.randint(0, DAYS - 1))
            injury_type = random.choice(["Sprained ankle", "Lower back strain", "Knee pain", "Shoulder impingement"])
            severity = random.choice(["light", "moderate"])
            recovery_days = random.randint(7, 21) if severity == "moderate" else random.randint(3, 10)
            pre_acwr = round(random.uniform(1.5, 2.5), 2)
            pre_hrv = round(random.uniform(30, 60), 1)
            pre_load = random.randint(250, 450)
            
            injuries.append((athlete_id, injury_date, injury_type, severity, recovery_days, pre_acwr, pre_hrv, pre_load))
    
    try:
        for inj in injuries:
            cur.execute(
                """INSERT INTO injury_history (athlete_id, injury_date, injury_type, severity, recovery_days, 
                   pre_injury_acwr, pre_injury_hrv, pre_injury_load)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                inj
            )
        conn.commit()
        print(f"✅ Inserted {len(injuries)} injury records into Citus")
    except Exception as e:
        print(f"❌ Error inserting injuries: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def populate_clickhouse_cardio():
    """Insert cardio/endurance samples in ClickHouse"""
    conn = connect_clickhouse()
    
    all_samples = []
    for athlete_id in range(1, NUM_ATHLETES + 1):
        # 1-3 cardio sessions per day, 70% of days
        for day_offset in range(DAYS):
            session_date = (START_DATE + timedelta(days=day_offset)).date()
            
            # 70% chance of having a cardio session that day
            if random.random() < 0.7:
                num_sessions = random.randint(1, 3)
                for sess_num in range(num_sessions):
                    samples = generate_cardio_session(athlete_id, session_date, sess_num)
                    all_samples.extend(samples)
    
    # Batch insert to ClickHouse
    try:
        if all_samples:
            conn.execute(
                "INSERT INTO bigintensive.corsa_endurance_campioni (atleta_id, sessione_id, secondo, heart_rate_bpm, cadence_spm, speed_kmh, altitude_m, temperature_c, ts) VALUES",
                all_samples,
                settings={"use_numpy": False}
            )
            print(f"✅ Inserted {len(all_samples)} cardio samples into ClickHouse")
    except Exception as e:
        print(f"❌ Error inserting cardio samples: {e}")
    finally:
        conn.disconnect()

def populate_clickhouse_exercises():
    """Insert exercise details in ClickHouse"""
    conn = connect_clickhouse()
    
    all_details = []
    allenamento_counter = 1000  # Start ID for allenamenti
    
    for athlete_id in range(1, NUM_ATHLETES + 1):
        # 2-4 exercise sessions per week over 90 days
        sessions_per_week = random.uniform(2, 4)
        expected_sessions = int((DAYS / 7) * sessions_per_week)
        
        for _ in range(expected_sessions):
            random_day = random.randint(0, DAYS - 1)
            session_date = (START_DATE + timedelta(days=random_day)).date()
            exercise_id = random.randint(1, 10)  # Reference to 10 exercise types
            
            details = generate_exercise_session(athlete_id, session_date, exercise_id, allenamento_counter)
            all_details.extend(details)
            allenamento_counter += 1
    
    # Batch insert to ClickHouse
    try:
        if all_details:
            conn.execute(
                "INSERT INTO bigintensive.allenamento_dettagli (allenamento_id, atleta_id, esercizio_id, ordine, serie, ripetizioni, tempo_riposo_sec, risultato, ts) VALUES",
                all_details,
                settings={"use_numpy": False}
            )
            print(f"✅ Inserted {len(all_details)} exercise details into ClickHouse")
    except Exception as e:
        print(f"❌ Error inserting exercise details: {e}")
    finally:
        conn.disconnect()

def populate_clickhouse_feedback():
    """Insert coach feedback in ClickHouse"""
    conn = connect_clickhouse()
    
    feedback_texts = [
        "Atleta in buona forma, buona reattività.",
        "Recupero ancora lento, ridurre il volume.",
        "Performance eccellente, incrementare il carico.",
        "Qualche difficoltà tecnica, da monitorare.",
        "Esecuzione perfetta, atleta concentrato.",
        "Buona intensità, recupero soddisfacente.",
        "Affaticamento evidente, consiglio scarico.",
        "Mobilità ottima, pronto per incremento carico.",
    ]
    
    impressions = ["pessimo", "scarso", "moderato", "buono", "ottimo"]
    
    all_feedback = []
    feedback_id = 1
    
    for athlete_id in range(1, NUM_ATHLETES + 1):
        # ~2 feedback entries per week
        num_feedbacks = int((DAYS / 7) * 2)
        
        for _ in range(num_feedbacks):
            feedback_date = START_DATE + timedelta(days=random.randint(0, DAYS - 1))
            feedback_text = random.choice(feedback_texts)
            intensity_imp = random.choice(impressions)
            recovery_imp = random.choice(impressions)
            
            all_feedback.append((
                feedback_id,
                athlete_id,
                feedback_date.date(),
                feedback_text,
                intensity_imp,
                recovery_imp,
                feedback_date
            ))
            feedback_id += 1
    
    # Batch insert to ClickHouse
    try:
        if all_feedback:
            conn.execute(
                "INSERT INTO bigintensive.coach_feedback (feedback_id, athlete_id, feedback_date, feedback_text, intensity_impression, recovery_impression, created_at) VALUES",
                all_feedback,
                settings={"use_numpy": False}
            )
            print(f"✅ Inserted {len(all_feedback)} coach feedback entries into ClickHouse")
    except Exception as e:
        print(f"❌ Error inserting coach feedback: {e}")
    finally:
        conn.disconnect()

def main():
    print("🚀 Starting fake data generation for BigIntensive...")
    print(f"   Period: {START_DATE.date()} to {(START_DATE + timedelta(days=DAYS)).date()}")
    print(f"   Athletes: {NUM_ATHLETES}")
    print()
    
    try:
        print("📍 Populating Citus with injury history...")
        populate_citus_injuries()
        
        print()
        print("📍 Populating ClickHouse with cardio samples...")
        populate_clickhouse_cardio()
        
        print()
        print("📍 Populating ClickHouse with exercise details...")
        populate_clickhouse_exercises()
        
        print()
        print("📍 Populating ClickHouse with coach feedback...")
        populate_clickhouse_feedback()
        
        print()
        print("✅ Data generation completed successfully!")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        raise

if __name__ == "__main__":
    main()
