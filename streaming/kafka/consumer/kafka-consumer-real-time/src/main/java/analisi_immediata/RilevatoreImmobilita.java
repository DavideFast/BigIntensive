package analisi_immediata;
import org.apache.kafka.streams.processor.api.Processor;
import org.apache.kafka.streams.processor.api.ProcessorContext;
import org.apache.kafka.streams.state.KeyValueStore;

import org.apache.kafka.streams.processor.api.Record;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

class RilevatoreImmobilita implements Processor<String, String, String, String> {
    
    private KeyValueStore<String, String> store;
    private ProcessorContext<String, String> context;
    private int id_istanza = 0;
    private static int NUMERO_ISTANZE = 0;
    
    private final Database db = new Database();
    private final List<CampioneDaSalvare> campioniDB = new ArrayList<>();
    private static final ObjectMapper MAPPER = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);


    private static void setNumeroIstanze() {
        NUMERO_ISTANZE++;
    }

    private StatoSessione leggiStato(String chiave) {
        String json = store.get(chiave);
        if (json == null) {
            return null;
        }
        try {
            return MAPPER.readValue(json, StatoSessione.class);
        } catch (Exception e) {
            return null;
        }
    }

    private void salvaStato(String chiave, StatoSessione stato) {
        try {
            store.put(chiave, MAPPER.writeValueAsString(stato));
        } catch (Exception e) {
            System.err.println("Stato non salvabile per " + chiave + ": " + e.getMessage());
        }
    }

    @Override
    public void init(ProcessorContext<String, String> context) {
        this.context = context;
        this.store = context.getStateStore(ConsumerKafka.getNomeStore());
        setNumeroIstanze();
        this.id_istanza = NUMERO_ISTANZE;
    }

    @Override
    public void process(Record<String, String> record) {
        
        // Provo a vedere se l'evento che arriva ha una struttura JSON corretta
        HeartRateSample sample;
        try {
            sample = MAPPER.readValue(record.value(), HeartRateSample.class);

            String chiave = record.key();
            if (chiave == null || chiave.isBlank()) {
                chiave = sample.athlete_id() + "-" + sample.session_id();
            }

            //Se non c'è uno stato precedente lo creo e esco
            StatoSessione precedente = leggiStato(chiave);
            if (precedente == null) {
                List<Posizione> storicoIniziale = new ArrayList<>();
                storicoIniziale.add(new Posizione(sample.latitude(), sample.longitude(), sample.sample_id()));
                salvaStato(chiave, new StatoSessione(sample.latitude(), sample.longitude(), sample.sample_id(), false,
                        0.0, 0.0, 0.0,
                        sample.heart_rate(), sample.heart_rate(), sample.cadence_spm(), 1, 0, storicoIniziale));
                return;
            }

            // Calcolo lo spostamento tra la posizione precedente e quella dell'evento corrente
            double spostamento = CalcoliMatematici.distanzaMetri(precedente.latitudine(), precedente.longitudine(),sample.latitude(), sample.longitude());
            if(sample.sample_id() == precedente.indice()) {
                System.out.printf("Campione duplicato per atleta %d, sessione %d, sample_id %d%n", sample.athlete_id(), sample.session_id(), sample.sample_id());
            }

            // Velocita sulla finestra dei 5 campioni precedenti, in m/s
            List<Posizione> storico = new ArrayList<>(precedente.storico());
            storico.add(new Posizione(sample.latitude(), sample.longitude(), sample.sample_id()));
            double velocitaTratto = 0;
            double sommaVelocita = precedente.sommaVelocita();
            double velocitaMax = precedente.velocitaMax();
            int campioniVelocita = precedente.campioniVelocita();
            if (storico.size() > Configurazione.getFinestraVelocita()) {
                Posizione riferimento = storico.remove(0);
                int deltaCampioni = sample.sample_id() - riferimento.indice();
                if (deltaCampioni > 0) {
                    double distanzaFinestra = CalcoliMatematici.distanzaMetri(riferimento.latitudine(), riferimento.longitudine(),
                            sample.latitude(), sample.longitude());
                    velocitaTratto = distanzaFinestra / (deltaCampioni * Configurazione.getSecondiPerCampione());
                    sommaVelocita += velocitaTratto;
                    velocitaMax = Math.max(velocitaMax, velocitaTratto);
                    campioniVelocita++;
                }
            }

            double distanzaTotale = precedente.distanzaTotale() + spostamento;
            double sommaFrequenza = precedente.sommaFrequenza() + sample.heart_rate();
            double frequenzaMax = Math.max(precedente.frequenzaMax(), sample.heart_rate());
            double sommaCadenza = precedente.sommaCadenza() + sample.cadence_spm();
            int campioni = precedente.campioni() + 1;

            campioniDB.add(new CampioneDaSalvare(sample, velocitaTratto));
            for(int i = 0; i < id_istanza; i++) {
                System.out.print("-------");
            }
            System.out.println(campioniDB.size());
            if (campioniDB.size() >= Configurazione.getMaxCampioni()) {
                List<CampioneDaSalvare> batchToFlush = new ArrayList<>(campioniDB.subList(0, Configurazione.getMaxCampioni()));
                System.out.printf("Raggiunto limite di %d campioni, invio batch al database%n", Configurazione.getMaxCampioni());
                campioniDB.subList(0, Configurazione.getMaxCampioni()).clear();
                db.databaseBulkInsert(batchToFlush);
            }
            //Se il campo event_type è "session_end" allora elimino lo stato della sessione e non faccio altro
            if ("session_end".equals(sample.event_type())) {
                System.out.printf("Sessione terminata per atleta %d, sessione %d, sample_id %d%n", sample.athlete_id(), sample.session_id(), sample.sample_id());
                db.databaseSummary(campioniVelocita > 0 ? sommaVelocita / campioniVelocita : 0.0, velocitaMax,
                        sommaFrequenza / campioni, frequenzaMax,
                        sommaCadenza / campioni, distanzaTotale, campioni,
                        sample, context.currentStreamTimeMs());
                store.delete(chiave);
                return;
            }

            // Se lo spostamento è maggiore della soglia, aggiorno la posizione di riferimento
            if (spostamento > Configurazione.getSogliaMovimentoM()) {
                salvaStato(chiave, new StatoSessione(sample.latitude(), sample.longitude(), sample.sample_id(), false,
                        distanzaTotale, sommaVelocita, velocitaMax, sommaFrequenza, frequenzaMax, sommaCadenza,
                        campioni, campioniVelocita, storico));
                return;
            }

            // Calcolo da quanti campioni l'atleta e fermo
            int campioniFermo = sample.sample_id() - precedente.indice();
            boolean allarmeInviato = precedente.allarmeInviato();
            String messaggio = null;
            if (campioniFermo >= Configurazione.getCampioniImmobile() && !allarmeInviato
                    && sample.heart_rate() > Configurazione.getSogliaBpmAllarme()) {
                allarmeInviato = true;
                messaggio = String.format("Atleta %s fermo da %.0f s in posizione %.6f, %.6f (bpm %.0f)",
                        sample.athlete_id(), campioniFermo * Configurazione.getSecondiPerCampione(),
                        sample.latitude(), sample.longitude(), sample.heart_rate());
            }

            // La posizione di riferimento resta quella precedente: serve a misurare l'immobilita cumulata
            salvaStato(chiave, new StatoSessione(precedente.latitudine(), precedente.longitudine(), precedente.indice(), allarmeInviato,
                    distanzaTotale, sommaVelocita, velocitaMax, sommaFrequenza, frequenzaMax, sommaCadenza,
                    campioni, campioniVelocita, storico));

            if (messaggio != null) {
                AllarmeNotifier.invia(messaggio);
                context.forward(record.withValue(messaggio));
            }
        } catch (Exception e) {
            return; // messaggio malformato: scartato senza fermare la topologia
        }      
    }
}

