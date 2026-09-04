package analisi_immediata;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.errors.MissingSourceTopicException;
import org.apache.kafka.streams.errors.StreamsUncaughtExceptionHandler;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.state.KeyValueStore;
import org.apache.kafka.streams.state.StoreBuilder;
import org.apache.kafka.streams.state.Stores;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

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
    
    

    

    public static void main(String[] args) {

        // Configurazione di Kafka Streams - Legge da variabili d'ambiente
        String bootstrapServers = System.getenv("KAFKA_BOOTSTRAP_SERVERS");
        if (bootstrapServers == null || bootstrapServers.isEmpty()) {
            bootstrapServers = "localhost:9092";
        }
        String topicEnv = System.getenv("KAFKA_TOPIC");
        final String topicIngresso = (topicEnv == null || topicEnv.isBlank())
                ? TOPIC_INGRESSO_PREDEFINITO
                : topicEnv;

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

        AtomicReference<KafkaStreams> istanzaCorrente = new AtomicReference<>();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            KafkaStreams streams = istanzaCorrente.get();
            if (streams != null) {
                streams.close();
            }
        }));

        while (waiting) {
            try {

                // Avvio del flusso di elaborazione
                final KafkaStreams streams  = new KafkaStreams(builder.build(), props);
                istanzaCorrente.set(streams);
                CountDownLatch shutdownLatch = new CountDownLatch(1);
                AtomicBoolean topicMancante = new AtomicBoolean(false);

                //Avvio del flusso di elaborazione
                streams.setStateListener((newState, oldState)->{System.out.println(">>> STATO KAFKA STREAMS CAMBIATO DA "+oldState+ " a " +newState);});
                streams.setUncaughtExceptionHandler((Throwable exception) -> {
                    if (isTopicSorgenteMancante(exception)) {
                        topicMancante.set(true);
                        System.out.println(">>> Topic sorgente " + topicIngresso
                                + " non ancora disponibile durante il rebalance: nuovo tentativo tra 10 secondi.");
                    } else {
                        System.out.println(">>> ERRORE CRITICO FINALE IN KAFKA STREAMS:");
                        exception.printStackTrace();
                    }
                    shutdownLatch.countDown();
                    return StreamsUncaughtExceptionHandler.StreamThreadExceptionResponse.SHUTDOWN_CLIENT;
                });
                System.out.println("Attendo che Kafka Streams si inizializzi e crei lo state store...");
                Thread.sleep(5000); // Attendo 5 secondi per permettere a Kafka Streams di inizializzarsi

                System.out.println("Collegato al cluster Kafka in " + bootstrapServers + ", in ascolto sul topic " + topicIngresso);
                streams.start();
                System.out.println("Rilevatore di immobilità in esecuzione. Premere Ctrl+C per terminare.");

                shutdownLatch.await();
                streams.close();
                istanzaCorrente.set(null);

                if (topicMancante.get()) {
                    Thread.sleep(10000);
                    continue;
                }

                System.out.println("Rilevatore di immobilità terminato.");
                waiting = false;

            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
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

    /** Il topic puo non esistere ancora se il consumer parte prima del job di creazione dei topic. */
    private static boolean isTopicSorgenteMancante(Throwable errore) {
        for (Throwable causa = errore; causa != null; causa = causa.getCause()) {
            if (causa instanceof MissingSourceTopicException) {
                return true;
            }
            if (causa.getCause() == causa) {
                break;
            }
        }
        return false;
    }
}
