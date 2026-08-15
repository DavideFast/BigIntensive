package analisi_immediata;

/** Notifica simulata: stampa a schermo al posto di inviare un SMS reale. */
public final class AllarmeNotifier {

    private static final String NUMERO_DESTINATARIO = "+39 333 1234567";

    private AllarmeNotifier() {
    }

    public static void invia(String messaggio) {
        System.out.println("=== ALLARME ===");
        System.out.println("SMS simulato verso " + NUMERO_DESTINATARIO);
        System.out.println(messaggio);
        System.out.println("===============");
    }
}
