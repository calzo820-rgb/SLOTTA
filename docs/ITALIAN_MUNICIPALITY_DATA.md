# Elenco dei comuni italiani

La tabella `public.italian_municipalities` è popolata dal foglio `CODICI al 21_02_2026` dell'elenco ISTAT allegato, aggiornato al 21 febbraio 2026. Contiene 7.894 codici comunali univoci, nome italiano, codice e denominazione dell'unità territoriale statistica, regione e sigla automobilistica quando disponibile.

Fonte: [ISTAT — Codici statistici delle unità amministrative territoriali](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/). Attribuzione: ISTAT.

Il file non contiene CAP. Il CAP dell'attività viene inserito separatamente e validato come codice postale italiano di cinque cifre; non viene dedotto dal comune, poiché un comune può avere più CAP.

Per aggiornare i dati, scaricare l'ultimo elenco ufficiale ISTAT, verificare codici e variazioni territoriali e preparare una nuova migration di aggiornamento. Non sovrascrivere i codici dei tenant: la FK fa riferimento al codice ISTAT corrente e le fusioni/cambi di codice richiedono una migrazione dati esplicita.

## Rilascio e rollback

Applicare prima la migration e poi distribuire il codice applicativo: l'onboarding e il profilo leggono la tabella di riferimento e scrivono le nuove colonne di `tenants`. La migration è additiva; non riscrive gli indirizzi esistenti e non elimina dati.

Per un rollback applicativo, ripristinare la versione precedente del codice e lasciare tabella, colonne e dati nel database. Non rimuovere le nuove colonne dopo che un gestore ha salvato la propria sede; un'eventuale rimozione richiede prima un'esportazione/verifica dei riferimenti.
