package analisi_immediata;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.errors.StreamsUncaughtExceptionHandler;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.state.KeyValueStore;
import org.apache.kafka.streams.state.StoreBuilder;
import org.apache.kafka.streams.state.Stores;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

/** Rilevamento immobilita con Kafka Streams: lo stato sopravvive a riavvii e rebalance. */
public class ConsumerKafka {

    private static final String TOPIC_INGRESSO_PREDEFINITO = "heart-rate-events";
    private static final String NOME_STORE = "stato-sessioni";

    public static String getNomeStore() {
        return NOME_STORE;
    }
    public static String getTopicIngressoPredefinito() {
        return TOPIC_INGRESSO_PREDEFINITO;
    }
    
    /** Stato persistito nello state store, serializzato come JSON. */
    public record StatoSessione(double latitudine, double longitudine, int indice, boolean allarmeInviato) {
    }

    public static void main(String[] args) {

        // Configurazione di Kafka Streams - Legge da variabili d'ambiente
        String bootstrapServers = System.getenv("KAFKA_BOOTSTRAP_SERVERS");
        if (bootstrapServers == null || bootstrapServers.isEmpty()) {
            bootstrapServers = "localhost:9092";
        }
        String topicIngresso = System.getenv("KAFKA_TOPIC");
        if (topicIngresso == null || topicIngresso.isBlank()) {
            topicIngresso = TOPIC_INGRESSO_PREDEFINITO;
        }

        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "rilevatore-immobilita");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass());
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.String().getClass());
        props.put(StreamsConfig.DEFAULT_DESERIALIZATION_EXCEPTION_HANDLER_CLASS_CONFIG, org.apache.kafka.streams.errors.LogAndContinueExceptionHandler.class.getName());

        // Creazione dello state store persistente
        StoreBuilder<KeyValueStore<String, String>> store = Stores.keyValueStoreBuilder(
                Stores.persistentKeyValueStore(NOME_STORE), Serdes.String(), Serdes.String());

        //Creazione della pipeline di elaborazione dei messaggi
        StreamsBuilder builder = new StreamsBuilder();
        builder.addStateStore(store);

        // Lettura dei messaggi dal topic di ingresso
        KStream<String, String> sorgente = builder.stream(topicIngresso, Consumed.with(Serdes.String(), Serdes.String()));
        
        //DEBUG: stampa dei messaggi ricevuti qualsiasi sia la chiave e il valore
        //sorgente.peek((chiave, valore) -> System.out.printf("Ricevuto messaggio con chiave %s e valore %s%n", chiave, valore));

        // Processamento dei messaggi con il rilevatore di immobilità
        sorgente.process(RilevatoreImmobilita::new, NOME_STORE);
        boolean waiting = true;
        
        while (waiting) {
            try {
                
                // Avvio del flusso di elaborazione
                final KafkaStreams streams  = new KafkaStreams(builder.build(), props);
                CountDownLatch shutdownLatch = new CountDownLatch(1);

                // Gestione della chiusura dell'applicazione
                Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                    streams.close();
                    shutdownLatch.countDown();
                }));

                //Avvio del flusso di elaborazione
                streams.setStateListener((newState, oldState)->{System.out.println(">>> STATO KAFKA STREAMS CAMBIATO DA "+oldState+ " a " +newState);});
                streams.setUncaughtExceptionHandler((Throwable exception) -> {
                    System.out.println(">>> ERRORE CRITICO FINALE IN KAFKA STREAMS:");
                    exception.printStackTrace();
                    shutdownLatch.countDown();
                    return StreamsUncaughtExceptionHandler.StreamThreadExceptionResponse.SHUTDOWN_APPLICATION;
                });
                System.out.println("Attendo che Kafka Streams si inizializzi e crei lo state store...");
                Thread.sleep(5000); // Attendo 5 secondi per permettere a Kafka Streams di inizializzarsi

                System.out.println("Collegato al cluster Kafka in " + bootstrapServers + ", in ascolto sul topic " + topicIngresso);
                streams.start();
                System.out.println("Rilevatore di immobilità in esecuzione. Premere Ctrl+C per terminare.");

                shutdownLatch.await();
                System.out.println("Rilevatore di immobilità terminato.");
                waiting = false;

            } catch (Exception e) {
                System.err.println("Errore durante l'esecuzione del rilevatore di immobilità: " + e.getMessage());
                try {
                    Thread.sleep(5000); // Attendo 5 secondi prima di riprovare
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    waiting = false;
                }
            }
        }
    }
}
