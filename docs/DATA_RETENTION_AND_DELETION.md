# Conservazione e cancellazione dati — procedura operativa

Questa è una base tecnica e organizzativa da sottoporre al consulente privacy prima del lancio commerciale.

## Tempi proposti

- Richiesta cancellazione tenant: 30 giorni di ripensamento.
- Prenotazioni concluse o annullate: 24 mesi, salvo obblighi fiscali o contestazioni.
- Hold e checkout incompleti: 30 giorni.
- Lead commerciali senza seguito: 12 mesi.
- Log applicativi: il minimo disponibile per sicurezza e diagnosi, senza payload o dati cliente.
- Backup: seguono la finestra prevista dal piano Supabase; i dati cancellati possono restare nei backup fino alla loro naturale scadenza.

## Flusso richiesto al proprietario

1. Scaricare l'esportazione JSON dalla pagina Profilo.
2. Inserire il nome completo dell'attività e accettare l'avviso.
3. Slotta registra la richiesta con cancellazione prevista dopo 30 giorni.
4. Il proprietario può annullarla durante il periodo di ripensamento.
5. Alla scadenza, l'operatore Slotta verifica abbonamenti, contestazioni e obblighi di conservazione prima della cancellazione definitiva.

## Runbook di cancellazione definitiva

1. Verificare identità, tenant e richiesta scaduta.
2. Salvare il riferimento dell'export richiesto dal cliente, senza duplicarne i dati.
3. Annullare l'abbonamento SaaS e verificare lo stato Stripe Connect.
4. Rimuovere i file del tenant dai bucket Storage (`logos` e immagini servizi).
5. Eliminare atomicamente i dati del tenant e registrare soltanto prova, data e operatore della cancellazione.
6. Revocare globalmente le sessioni di proprietario e staff; gli access token già emessi restano validi fino alla loro scadenza.
7. Eliminare gli utenti Auth che non appartengono ad altri tenant.
8. Comunicare il completamento e la finestra residua dei backup.

La fase 5–7 deve restare assistita finché non esiste un ambiente di staging su cui provare cancellazione, Storage e Auth senza rischiare dati reali.
