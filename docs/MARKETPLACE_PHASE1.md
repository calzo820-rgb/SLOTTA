# Marketplace V1 — implementazione nascosta

## Stato

Fase 1 e ricerca/lista della Fase 2 sono preparate nel branch
`feat/marketplace-hidden-phase1`. La migrazione è un file nel repository: non è
stata applicata a Supabase. Non sono stati effettuati merge o deploy di
produzione.

## Dati riutilizzati

La tabella `public.tenant_marketplace` contiene solo impostazioni Marketplace,
collegata uno-a-uno a `public.tenants` tramite `tenant_id`. Identità,
indirizzo, Comune ISTAT, logo, slug e prenotazioni restano nei dati attuali:
non viene creata una seconda anagrafica.

Ogni riga ha adesione disattivata di default. Non viene eseguito alcun backfill.
Sono previste le categorie parrucchiere, barber shop e centro estetico.
Coordinate e descrizione sono facoltative. Per cercare un Comune si riutilizzano
i campi geografici già presenti e la tabella `italian_municipalities` con il
dataset ISTAT installato (7.894 Comuni).

## Ricerca e lista

`/marketplace` restituisce 404 quando `MARKETPLACE_ENABLED` non è
esplicitamente `true`. Quando il flag è disattivato, nessuna query ai dati del
Marketplace viene eseguita.

La pagina interna `/marketplace/internal` richiede flag di test, email
verificata in allowlist, sessione valida e appartenenza attiva con ruolo owner.
Entrambe le pagine sono dinamiche e noindex.

La ricerca richiede nome o Comune, supporta categoria e limita la risposta a 24
schede. La query legge solo attività attive, in modalità servizi, con adesione
opt-in e categoria ammessa. Restituisce solo dati già destinati alla scheda
pubblica: nome, logo, categoria, indirizzo, Comune, descrizione e link alla
pagina di prenotazione. Non restituisce contatti, dati di pagamento o dati
clienti. Il link continua a usare la pagina del salone esistente.

## Accesso e sicurezza

La tabella Marketplace ha RLS attivo e nessun accesso diretto con ruoli
`anon` o `authenticated`. Le query server usano il client amministrativo e
filtri espliciti. La feature flag pubblica è separata dal flag di test interno.
I metadati noindex riducono l'indicizzazione, ma il controllo server-side è la
barriera di accesso.

## Non ancora implementato

- Nessuna adesione esposta nel profilo gestore e nessun backfill.
- Nessuna mappa né geocodifica; non viene richiesta la posizione del visitatore.
- Nessuna modifica alla pagina del salone o al flusso di prenotazione.

## Attivazione e costi

Per testare la route interna serve configurare i flag e la lista email solo in
un ambiente Preview autorizzato. Non impostarli in produzione durante questa
fase. Per la parte cartografica si userà un provider selezionabile; Leaflet è
solo la libreria UI e richiede attribuzione e condizioni d'uso del provider.
La scelta e l'eventuale piano a pagamento restano separati dalla lista.
