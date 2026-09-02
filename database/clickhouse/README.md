# CLICKHOUSE

## Comandi utili per la gestione del database Clickhouse

Comandi utili per la gestione del database Clickhouse sono:

1. Accedere al pod Clickhouse:

```bash
# Avviare il container Clickhouse
sudo kubectl exec -it clickhouse-0 -- --clickhouse-client
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
