package analisi_immediata;

public class Configurazione {
    private static final int MAX_CAMPIONI = 2000;
    private static final int FINESTRA_VELOCITA = 5;
    private static final double SOGLIA_MOVIMENTO_M = 10.0;
    private static final int SECONDI_IMMOBILE = 30;
    private static final double SECONDI_PER_CAMPIONE = leggiIntervalloCampionamento();
    
    /** Deve combaciare con SAMPLE_INTERVAL del simulatore: sample_id conta campioni, non secondi. */
    private static double leggiIntervalloCampionamento() {
        String valore = System.getenv("SAMPLE_INTERVAL");
        if (valore == null || valore.isBlank()) {
            return 5.0;
        }
        try {
            double intervallo = Double.parseDouble(valore);
            return intervallo > 0 ? intervallo : 5.0;
        } catch (NumberFormatException e) {
            return 5.0;
        }
    }

    public static int getMaxCampioni() {
        return MAX_CAMPIONI;
    }

    public static int getFinestraVelocita() {
        return FINESTRA_VELOCITA;
    }

    public static double getSogliaMovimentoM() {
        return SOGLIA_MOVIMENTO_M;
    }

    public static int getSecondiImmobile() {
        return SECONDI_IMMOBILE;
    }

    public static double getSecondiPerCampione() {
        return SECONDI_PER_CAMPIONE;
    }


}
