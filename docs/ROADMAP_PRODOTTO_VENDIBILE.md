# Slotta — checklist per un prodotto vendibile

Ultimo audit tecnico: 8 settembre 2026.

## Regole di avanzamento

- `[ ]` da fare
- `[-]` in lavorazione
- `[x]` completato, verificato e pubblicato
- Ogni voce si considera completata solo dopo test automatici, controllo della preview e verifica post-deploy.
- Le modifiche al database richiedono migrazione versionata e test con rollback.

## P0 — sicurezza prima di nuovi clienti

- [x] **SEC-01 — Ridurre la superficie pubblica Supabase.** Le letture pubbliche passano da API server che espongono soltanto i campi necessari; dati amministrativi e Stripe Connect non sono più leggibili dal browser.
- [x] **SEC-02 — Bloccare gli inserimenti anonimi diretti nelle prenotazioni.** Le prenotazioni pubbliche passano esclusivamente dalle API server con validazione, disponibilità e antiabuso.
- [x] **SEC-03 — Applicare privilegi SQL minimi.** Revocati ad `anon` tutti i privilegi diretti sulle tabelle e rimossi da `authenticated` i privilegi e gli accessi non necessari.
- [x] **SEC-04 — Proteggere l'annullamento degli hold Stripe.** Token firmato e a scadenza, validazione UUID, limite del body e rate limiting verificati in produzione.
- [x] **SEC-05 — Rendere distribuito il rate limiting.** Store atomico condiviso Supabase implementato e verificato in produzione per tutte le API pubbliche applicative (prenotazioni, disponibilità, checkout, annullamenti, onboarding e form tester); il login resta protetto dai limiti nativi di Supabase Auth.
- [x] **SEC-06 — Chiudere gli advisor `SECURITY DEFINER`.** Helper RLS spostati nello schema privato con permessi minimi; 24 policy preservate, test autenticato e advisor verificati in produzione.
- [x] **SEC-07 — Test automatici di isolamento multi-tenant.** Test transazionale pubblicato e superato con ruoli `anon`, proprietario e staff; verifica privilegi, letture tra tenant e scritture riservate.
- [x] **SEC-08 — Validare le disponibilità lato server.** Regole centralizzate per tenant e servizi attivi, anticipo minimo, orari del salone e degli operatori, chiusure e operatore richiesto; test, preview e produzione verificati.

## P1 — integrità di pagamenti e dati

- [x] **PAY-01 — Rendere atomica la finalizzazione Stripe.** Funzione transazionale idempotente e indice univoco pubblicati; test SQL con rollback superato in produzione.
- [x] **PAY-02 — Verificare lo stato economico del pagamento.** Controlli su `payment_status`, modalità, importo, valuta, PaymentIntent, tenant e account Connect pubblicati e verificati.
- [x] **PAY-03 — Gestire tutti gli eventi Stripe rilevanti.** Pagamento asincrono riuscito/fallito, scadenza sessione, rimborso, disputa e account Connect disabilitato pubblicati con registro eventi idempotente; migrazione, privilegi, test transazionale e produzione verificati.
- [ ] **PAY-04 — Collaudo Stripe Connect reale.** Eseguire in produzione pagamento, annullamento, sessione abbandonata, rimborso e verifica accredito sul conto collegato. Richiede intervento manuale del titolare.
- [x] **DATA-01 — Proteggere la pagina di conferma prenotazione.** Token casuale dedicato con solo hash nel database, scadenza e revoca pubblicati per prenotazioni dirette e Stripe; migrazione, test transazionale e produzione verificati.
- [x] **DATA-04 — Annullamento autonomo del cliente.** Link opaco separato, scadenza, preavviso configurabile, blocco delle prenotazioni pagate, notifiche e aggiornamento atomico pubblicati e verificati.
- [-] **DATA-02 — Cancellazione account e politica di conservazione.** Richiesta protetta del proprietario, conferma esplicita, 30 giorni di ripensamento, annullamento e politica di retention preparati; resta da collaudare e automatizzare la cancellazione definitiva di database, Storage, Stripe e utenti Auth in staging.
- [ ] **DATA-03 — Backup e prova di ripristino.** Documentare backup, export fuori piattaforma e ripristino; eseguire almeno una prova su ambiente non produttivo.

## P1 — affidabilità operativa

- [x] **OPS-01 — Rendere la build indipendente dall'inizializzazione delle credenziali.** Inizializzazione lazy e validazione esplicita applicate ai client Supabase e Resend; build senza credenziali, test, preview e produzione verificati.
- [x] **OPS-02 — Logging strutturato e codici richiesta.** `requestId`, durata, route e codici errore pubblici stabili pubblicati e verificati sulle API pubbliche critiche e sul webhook Stripe, senza contenuti delle richieste.
- [x] **OPS-03 — Monitoraggio automatico e allarmi.** Controllo sintetico gratuito attivo per home, health, protezione prenotazione e webhook; apre una issue su errore e la chiude al ripristino.
- [-] **OPS-04 — Test end-to-end.** Smoke test della build reale esteso a home, tester, login, recupero password, health, manifest, SEO e protezione billing; restano prenotazione completa, ruoli autenticati, email simulata e webhook Stripe firmato.
- [x] **OPS-05 — Affidabilità email.** Errori Resend controllati, retry e deduplicazione pubblicati; dominio, SPF, DKIM e DMARC verificati con consegna reale in posta principale.

## P2 — requisiti commerciali

- [-] **BIZ-01 — Abbonamento SaaS del salone.** Fondazione in lavorazione: stato trial/piano, Checkout separato da Connect, portale cliente e webhook dedicato con tolleranza di 7 giorni; restano sospensione controllata, configurazione del prodotto/prezzo e collaudo Stripe.
- [ ] **BIZ-02 — Console di assistenza.** Vista interna con stato tenant, abbonamento, Stripe Connect e anomalie, senza possibilità di accedere ai dati cliente oltre il necessario.
- [ ] **LEGAL-01 — Revisione legale e privacy.** Far validare Privacy, Termini, ruoli GDPR, DPA, sub-responsabili, retention, rimborsi e dati identificativi dell'attività; rimuovere i riferimenti “beta” al lancio commerciale.
- [-] **UX-01 — Audit accessibilità e mobile.** Prima tranche in lavorazione su etichette form, annunci degli errori, stati selezionati, dialog e target touch del flusso cliente; restano verifica browser/screen reader e area gestionale autenticata.
- [ ] **PERF-01 — Core Web Vitals e carico.** Misurare LCP/INP/CLS, bundle e query; eseguire un test di carico controllato sulle disponibilità e sulle prenotazioni.
- [ ] **DOC-01 — Manuali e supporto.** Guida gestore/staff, onboarding, FAQ, procedura incidenti, canale assistenza e checklist di attivazione cliente.

## Completato e verificato

- [x] **BASE-01 — CI automatica:** test, lint e build sulle pull request.
- [x] **BASE-02 — Recupero password:** flusso completo verificato in produzione.
- [x] **BASE-03 — Sicurezza HTTP:** header di sicurezza, redirect interni sicuri e pagine errore/404.
- [x] **BASE-04 — PWA e SEO:** manifest, icone, sitemap, robots e metadati.
- [x] **BASE-05 — Esportazione dati tenant:** export autenticato e limitato al salone.
- [x] **BASE-06 — Pulizia database:** rimosso il vecchio schema ristorante.
- [x] **BASE-07 — RLS staff:** scritture sugli operatori riservate al proprietario.
- [x] **BASE-08 — Concorrenza prenotazioni:** guardia atomica database tra booking e hold Stripe, con test transazionale e rollback.
- [x] **BASE-09 — Dipendenze:** audit npm del 6 settembre 2026 con 0 vulnerabilità note.
- [x] **BASE-10 — Qualità corrente:** 72 test automatici nella tranche corrente; lint, build e smoke test della build reale verificati.
- [x] **BASE-11 — Produzione corrente:** deploy Vercel `READY`, endpoint health operativo e nessun errore runtime nelle ultime 24 ore al momento dell'audit.

## Limitazioni note del piano gratuito

- [ ] **PLAN-01 — Leaked Password Protection.** Non disponibile sul piano Supabase Free; rivalutare con il passaggio a Pro.
- [ ] **PLAN-02 — Continuità e osservabilità avanzata.** Valutare piani e strumenti necessari prima di promettere SLA, backup più lunghi o log centralizzati ai clienti.
