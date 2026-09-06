# Slotta — checklist per un prodotto vendibile

Ultimo audit tecnico: 6 settembre 2026.

## Regole di avanzamento

- `[ ]` da fare
- `[-]` in lavorazione
- `[x]` completato, verificato e pubblicato
- Ogni voce si considera completata solo dopo test automatici, controllo della preview e verifica post-deploy.
- Le modifiche al database richiedono migrazione versionata e test con rollback.

## P0 — sicurezza prima di nuovi clienti

- [-] **SEC-01 — Ridurre la superficie pubblica Supabase.** Sostituire la lettura anonima delle tabelle complete con viste/API che espongano soltanto i campi necessari. La policy pubblica di `tenants` rende oggi interrogabili anche colonne interne come `staff_login_code`, dati Stripe Connect e contatti amministrativi.
- [-] **SEC-02 — Bloccare gli inserimenti anonimi diretti nelle prenotazioni.** Rimuovere la policy Data API che permette ad `anon` di inserire direttamente in `service_bookings`, obbligando tutte le prenotazioni a passare dalle API server con validazione, disponibilità e antiabuso.
- [-] **SEC-03 — Applicare privilegi SQL minimi.** Revocare da `anon` e `authenticated` i privilegi non necessari (`TRUNCATE`, `TRIGGER`, `REFERENCES` e scritture non usate), mantenendo soltanto le operazioni richieste dall'app e protette da RLS.
- [ ] **SEC-04 — Proteggere l'annullamento degli hold Stripe.** Il solo UUID dell'hold non deve essere sufficiente per annullarlo: aggiungere token firmato/monouso, limite del body, validazione UUID e rate limiting.
- [ ] **SEC-05 — Rendere distribuito il rate limiting.** L'attuale contatore in memoria protegge una sola istanza Vercel e si azzera ai riavvii; usare Vercel Firewall oppure uno store condiviso per prenotazioni, checkout, onboarding, login e form tester.
- [ ] **SEC-06 — Chiudere gli advisor `SECURITY DEFINER`.** Spostare gli helper RLS `is_tenant_owner`, `my_role` e `my_tenant_id` in uno schema privato oppure limitarne esplicitamente l'esecuzione, mantenendo funzionanti tutte le policy.
- [ ] **SEC-07 — Test automatici di isolamento multi-tenant.** Provare con ruoli `anon`, proprietario e staff che un salone non possa leggere o modificare dati, prenotazioni, operatori o configurazioni di un altro salone.

## P1 — integrità di pagamenti e dati

- [ ] **PAY-01 — Rendere atomica la finalizzazione Stripe.** Conversione hold → prenotazione → stato pagato in un'unica transazione database idempotente; nessuno stato parziale se una query fallisce.
- [ ] **PAY-02 — Verificare lo stato economico del pagamento.** Prima di confermare la prenotazione controllare `payment_status`, importo, valuta, account Connect e corrispondenza con servizio/tenant.
- [ ] **PAY-03 — Gestire tutti gli eventi Stripe rilevanti.** Coprire almeno pagamento asincrono riuscito/fallito, scadenza sessione, rimborso, disputa e account Connect disabilitato, con idempotenza degli eventi.
- [ ] **PAY-04 — Collaudo Stripe Connect reale.** Eseguire in produzione pagamento, annullamento, sessione abbandonata, rimborso e verifica accredito sul conto collegato. Richiede intervento manuale del titolare.
- [ ] **DATA-01 — Proteggere la pagina di conferma prenotazione.** Evitare che un semplice ID nella URL consenta di visualizzare nome, email e dettagli: usare un token pubblico dedicato, limitato e revocabile.
- [ ] **DATA-02 — Cancellazione account e politica di conservazione.** L'esportazione esiste; aggiungere richiesta/cancellazione completa del tenant, tempi di retention per prenotazioni e lead e procedura di revoca sessioni.
- [ ] **DATA-03 — Backup e prova di ripristino.** Documentare backup, export fuori piattaforma e ripristino; eseguire almeno una prova su ambiente non produttivo.

## P1 — affidabilità operativa

- [ ] **OPS-01 — Rendere la build indipendente dall'inizializzazione delle credenziali.** Il client Supabase amministrativo viene creato all'import e una build senza env fallisce durante la raccolta delle route; introdurre inizializzazione lazy e controllo centralizzato delle variabili.
- [ ] **OPS-02 — Logging strutturato e codici richiesta.** Uniformare i log delle API senza dati personali, aggiungere `requestId`, durata, route e codici errore pubblici stabili.
- [ ] **OPS-03 — Monitoraggio automatico e allarmi.** Aggiungere error tracking/uptime per home, health, prenotazione e webhook; su piano gratuito mantenere anche una procedura di controllo Vercel.
- [ ] **OPS-04 — Test end-to-end.** Automatizzare i flussi cliente, proprietario e staff, inclusi prenotazione, conflitto, autorizzazioni, email simulata e webhook Stripe firmato.
- [ ] **OPS-05 — Affidabilità email.** Verificare dominio mittente, SPF/DKIM/DMARC, gestione errori Resend, deduplicazione e retry delle email importanti.

## P2 — requisiti commerciali

- [ ] **BIZ-01 — Abbonamento SaaS del salone.** Trial, piano da 30 €/mese, rinnovo, portale cliente, fattura, pagamento fallito, periodo di tolleranza e sospensione controllata del tenant.
- [ ] **BIZ-02 — Console di assistenza.** Vista interna con stato tenant, abbonamento, Stripe Connect e anomalie, senza possibilità di accedere ai dati cliente oltre il necessario.
- [ ] **LEGAL-01 — Revisione legale e privacy.** Far validare Privacy, Termini, ruoli GDPR, DPA, sub-responsabili, retention, rimborsi e dati identificativi dell'attività; rimuovere i riferimenti “beta” al lancio commerciale.
- [ ] **UX-01 — Audit accessibilità e mobile.** Tastiera, focus, contrasto, screen reader, modali, errori dei form e principali telefoni/browser.
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
- [x] **BASE-10 — Qualità corrente:** 20 test automatici superati e lint pulito.
- [x] **BASE-11 — Produzione corrente:** deploy Vercel `READY`, endpoint health operativo e nessun errore runtime nelle ultime 24 ore al momento dell'audit.

## Limitazioni note del piano gratuito

- [ ] **PLAN-01 — Leaked Password Protection.** Non disponibile sul piano Supabase Free; rivalutare con il passaggio a Pro.
- [ ] **PLAN-02 — Continuità e osservabilità avanzata.** Valutare piani e strumenti necessari prima di promettere SLA, backup più lunghi o log centralizzati ai clienti.
