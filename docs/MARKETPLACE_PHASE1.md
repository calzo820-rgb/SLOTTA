# Marketplace V1 — implementazione nascosta

## Stato

Fase 1, ricerca/lista della Fase 2 e mappa/geocodifica interna della Fase 3 sono preparate nel branch
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

### Proposta prima di qualsiasi migrazione in produzione

- `tenant_marketplace`: una riga per attività esistente, FK `tenant_id`, opt-in
  false, categoria, descrizione, latitudine/longitudine, stato/origine/hash
  geocodifica e timestamp.
- `marketplace_geocoding_gate`: una sola riga tecnica con l'ultimo istante di
  richiesta; funzione SQL `marketplace_claim_geocoding_slot()` concede una
  richiesta globale per secondo anche con più istanze Vercel.
- Dataset: identità e indirizzi dalla tabella `tenants`; Comuni dal dataset
  ufficiale ISTAT già presente; coordinate da OSM Nominatim solo su richiesta
  interna esplicita, una attività per volta.
- Attività esistenti: nessun backfill e nessun cambiamento alla pagina pubblica
  o alle prenotazioni. Restano escluse con `opt_in=false`; senza coordinate
  compaiono solo in lista. L'indirizzo non viene inviato al provider finché
  accesso interno, flag geocodifica e opt-in non sono tutti attivi.

Questa migrazione è preparata nel branch e **non è stata applicata**. Prima di
applicarla in produzione mostreremo e confermeremo questo schema, dataset e
comportamento insieme ai dettagli del test previsto.

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

## Mappa e geolocalizzazione

La ricerca offre il passaggio tra lista e mappa interattiva basata su Leaflet.
I riquadri cartografici sono serviti da OpenStreetMap con attribuzione visibile;
Leaflet non è Google Maps e non include Street View, immagini satellitari o i
dati proprietari di Google. I marker si basano esclusivamente su coordinate
salvate in `tenant_marketplace`; le attività senza coordinate restano nei
risultati in lista e non ricevono una posizione stimata. La mappa si centra
sulle coordinate presenti e i popup offrono il link alla prenotazione.

L'uso del servizio standard di tile OpenStreetMap è soggetto alla relativa
policy, inclusi i limiti di utilizzo e il divieto di traffico massivo/offline.
La geocodifica Nominatim è manuale e per singola attività: il pulsante “Trova
posizione” appare solo nella lista interna quando il flag è attivo; l'indirizzo
dev'essere completo e l'attività deve avere opt-in attivo. L'hash dell'indirizzo
evita richieste ripetute; un
gate SQL condiviso serializza le richieste a massimo una al secondo tra le
istanze Vercel. Sono previste timeout, User-Agent identificativo e endpoint
HTTPS configurabile. Nessun dato cliente viene inviato. Il servizio può essere
disabilitato via env; per il lancio pubblico provider e volumi andranno
riesaminati. Nessuna chiave o servizio a pagamento è stato aggiunto.

Il provider si abilita solo con `MARKETPLACE_GEOCODING_ENABLED=true`,
`MARKETPLACE_GEOCODING_PROVIDER=nominatim` e un
`MARKETPLACE_GEOCODING_USER_AGENT` identificativo. L'endpoint HTTPS può essere
sostituito via `MARKETPLACE_NOMINATIM_ENDPOINT`. Nominatim non è usato per
autocomplete, ricerche dei clienti o richieste periodiche. La policy impone il
limite applicativo di una richiesta al secondo, l'identificazione del client e
la cache dei risultati; prima del lancio pubblico va rivalutato se il servizio
pubblico è adatto ai volumi e alle condizioni commerciali di Slotta.

Prima dell'attivazione per clienti vanno inoltre valutati l'informativa privacy
e l'eventuale scelta di un provider alternativo.

Il flag `MARKETPLACE_GEOCODING_ENABLED` resta disattivato per default; anche
abilitato, l'endpoint richiede accesso interno verificato e un'attività attiva
che abbia aderito. La geocodifica automatica al cambio indirizzo e la modifica
manuale delle coordinate non sono ancora esposte nel profilo.

## Non ancora implementato

- Nessuna adesione esposta nel profilo gestore e nessun backfill.
- Nessuna geocodifica automatica al cambio indirizzo o correzione manuale delle
  coordinate nel profilo; non viene richiesta la posizione del visitatore.
- Nessuna modifica alla pagina del salone o al flusso di prenotazione.

## Attivazione e costi

Per testare la route interna serve configurare i flag e la lista email solo in
un ambiente Preview autorizzato. Non impostarli in produzione durante questa
fase. Per la parte cartografica si userà un provider selezionabile; Leaflet è
solo la libreria UI e richiede attribuzione e condizioni d'uso del provider.
La scelta e l'eventuale piano a pagamento restano separati dalla lista.
