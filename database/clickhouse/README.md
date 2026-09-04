# CLICKHOUSE

## Comandi utili per la gestione del database Clickhouse

Comandi utili per la gestione del database Clickhouse sono:

1. Accedere al pod Clickhouse:

```bash
# Avviare il container ClickHouse (scegliere una replica dello shard 1)
sudo kubectl exec -n bigintensive -it clickhouse-shard-1-0 -- clickhouse-client
```

2. Eseguire query SQL:

```sql
SELECT DATABASES;
```

```sql
SELECT TABLES FROM <nome_database>;
```

```sql
SELECT * FROM <nome_database>.<nome_tabella>;
```

## Struttura del database Clickhouse

Ogni tabella nel database Clickhouse è progettata per memorizzare dati specifici relativi alle corse degli utenti. La struttura delle tabelle è ottimizzata per l'analisi dei dati in tempo reale, consentendo query rapide e efficienti.

Le tabelle principali nel database Clickhouse includono:

- **allenamenti**: memorizza i dati relativi agli allenamenti degli utenti, inclusi i parametri di frequenza cardiaca, velocità e distanza percorsa.
- **allenamenti_raw**: memorizza i dati grezzi degli allenamenti degli utenti, inclusi i parametri di frequenza cardiaca, velocità e distanza percorsa, senza alcuna elaborazione o aggregazione.
- **running_samples**: memorizza i campioni di dati relativi alle corse degli utenti, inclusi i parametri di frequenza cardiaca, velocità e distanza percorsa, raccolti durante le sessioni di allenamento.

Per ogni tabella esiste la versione distribuita e la versione locale (`_local`). Le tabelle distribuite sono il punto di accesso dell'applicazione; le tabelle locali `ReplicatedMergeTree` memorizzano i dati sui singoli server ClickHouse.
