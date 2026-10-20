# Marketplace V1 — Fase 1 (nascosta)

## Stato

Questa fase aggiunge la struttura tecnica in un branch. Non applica migrazioni a
Supabase, non effettua deploy e non attiva la pubblicazione.

## Dati

La tabella `public.tenant_marketplace` contiene solo impostazioni Marketplace,
collegata uno-a-uno a `public.tenants` tramite `tenant_id`. Identità, indirizzo,
Comune ISTAT, logo, slug e prenotazioni restano nella tabella `tenants` e nei
flussi esistenti: non viene creata una seconda anagrafica.

Ogni riga ha adesione disattivata di default. Non viene eseguito alcun backfill.
Le categorie ammesse sono parrucchiere, barber shop e centro estetico. Le
coordinate sono facoltative; non sono generate da questa migrazione.

Per la ricerca geografica si riutilizza `italian_municipalities` (dataset ISTAT
già installato, 7.894 Comuni). La geocodifica degli indirizzi e la mappa sono
fasi successive. Il client non deve inviare la posizione precisa del visitatore.

## Accesso interno

`/marketplace/internal` restituisce 404 a meno che siano vere tutte le
condizioni seguenti:

- `MARKETPLACE_INTERNAL_TESTS_ENABLED=true`;
- `MARKETPLACE_INTERNAL_EMAILS` contenga l'indirizzo verificato dell'utente;
- l'utente abbia una sessione Supabase valida e un'appartenenza Slotta attiva
  con ruolo owner.

Il flag pubblico `MARKETPLACE_ENABLED` è separato e non abilita l'accesso
interno. Entrambi sono disattivati se non configurati. La pagina è dinamica e
porta metadati noindex; questi metadati non sostituiscono il controllo server.

## Attivazione

Per testare questa route, configurare i due valori interni solo nell'ambiente
preview autorizzato. Non impostarli sulla produzione. Il Marketplace pubblico
richiederà un'implementazione e un'autorizzazione di lancio separate.

## Mappa

Leaflet può fornire pan, zoom, marker selezionabili e popup/schede responsive,
con interazioni familiari a Google Maps. Non fornisce immagini satellitari,
Street View, dati Google o geocodifica: il rendering delle mappe e le coordinate
dipendono dal provider scelto. L'attribuzione e i termini del provider restano
visibili e rispettati.
