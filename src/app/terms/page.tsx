import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F2F4F7] px-4 py-8 text-[#0F1D2D] md:px-6">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <Link
          href="/"
          className="text-sm font-black text-[#1FA7A6] hover:underline"
        >
          ← Torna alla home
        </Link>

        <h1 className="mt-6 text-3xl font-black tracking-tight">
          Termini e condizioni
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ultimo aggiornamento: 19 maggio 2026
        </p>

        <div className="mt-8 grid gap-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              1. Oggetto del servizio
            </h2>
            <p className="mt-2">
              Slotta è una piattaforma digitale che permette ad attività,
              professionisti e saloni di gestire prenotazioni online, servizi,
              orari, operatori, chiusure, notifiche di servizio e accessi staff.
            </p>
            <p className="mt-2">
              Slotta fornisce lo strumento tecnico per ricevere e gestire
              prenotazioni. L’esecuzione del servizio prenotato rimane a carico
              dell’attività presso cui il cliente prenota.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              2. Account e accesso alla piattaforma
            </h2>
            <p className="mt-2">
              L’attività che utilizza Slotta è responsabile della correttezza
              dei dati inseriti, della gestione dei propri servizi, degli orari,
              dei prezzi, degli operatori e delle disponibilità mostrate ai
              clienti.
            </p>
            <p className="mt-2">
              L’utente è inoltre responsabile della sicurezza delle proprie
              credenziali e dell’utilizzo degli accessi creati per eventuali
              membri dello staff.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              3. Prenotazioni
            </h2>
            <p className="mt-2">
              Le prenotazioni effettuate tramite Slotta vengono registrate nella
              piattaforma e rese disponibili all’attività che offre il servizio.
            </p>
            <p className="mt-2">
              Slotta non è parte del rapporto professionale o commerciale tra il
              cliente finale e l’attività. Eventuali variazioni, ritardi,
              cancellazioni, rimborsi, contestazioni o problemi relativi al
              servizio prenotato devono essere gestiti direttamente tra cliente
              e attività.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              4. Conferme, notifiche e comunicazioni di servizio
            </h2>
            <p className="mt-2">
              Slotta può inviare email di servizio relative alla prenotazione,
              come conferme, aggiornamenti, cancellazioni o promemoria.
            </p>
            <p className="mt-2">
              Le comunicazioni di servizio sono legate alla gestione della
              prenotazione e non hanno finalità promozionale.
            </p>
            <p className="mt-2">
              Eventuali comunicazioni promozionali, newsletter o campagne
              marketing da parte dell’attività dovranno essere gestite nel
              rispetto della normativa applicabile e con eventuali consensi
              specifici, ove richiesti.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              5. Pagamenti online
            </h2>
            <p className="mt-2">
              Se l’attività abilita il pagamento online o la caparra online, il
              pagamento può essere gestito tramite fornitori esterni specializzati,
              come Stripe o altri provider di pagamento.
            </p>
            <p className="mt-2">
              Slotta non conserva direttamente i dati completi delle carte di
              pagamento. La gestione tecnica del pagamento avviene tramite il
              provider utilizzato.
            </p>
            <p className="mt-2">
              Eventuali rimborsi, annullamenti o contestazioni economiche
              relative al servizio prenotato dovranno essere gestiti secondo le
              condizioni dell’attività e del provider di pagamento utilizzato.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              6. Responsabilità dell’attività
            </h2>
            <p className="mt-2">
              L’attività che utilizza Slotta si impegna a mantenere aggiornate le
              informazioni pubblicate, inclusi servizi, prezzi, durata dei
              trattamenti, orari, disponibilità, dati di contatto e modalità di
              pagamento.
            </p>
            <p className="mt-2">
              L’attività è responsabile della corretta gestione delle
              prenotazioni ricevute, dell’erogazione dei servizi e delle
              comunicazioni con i propri clienti.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              7. Uso corretto della piattaforma
            </h2>
            <p className="mt-2">
              L’utente si impegna a utilizzare Slotta in modo lecito, corretto e
              conforme alla normativa applicabile, evitando utilizzi abusivi,
              fraudolenti, dannosi o contrari ai diritti di terzi.
            </p>
            <p className="mt-2">
              Non è consentito utilizzare la piattaforma per inserire contenuti
              illeciti, offensivi, ingannevoli o non pertinenti alla gestione
              delle prenotazioni.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              8. Disponibilità del servizio
            </h2>
            <p className="mt-2">
              Slotta viene fornito con l’obiettivo di garantire continuità,
              sicurezza e affidabilità. Tuttavia, potrebbero verificarsi
              interruzioni temporanee per manutenzione, aggiornamenti, problemi
              tecnici, malfunzionamenti di fornitori esterni o cause non
              prevedibili.
            </p>
            <p className="mt-2">
              Durante eventuali interruzioni, l’attività resta responsabile di
              gestire i propri clienti con canali alternativi, se necessario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              9. Modifiche al servizio
            </h2>
            <p className="mt-2">
              Slotta può evolvere nel tempo con nuove funzionalità, modifiche
              grafiche, aggiornamenti tecnici o cambiamenti nelle modalità di
              utilizzo del servizio.
            </p>
            <p className="mt-2">
              Alcune funzionalità potrebbero essere modificate, migliorate,
              sospese o rimosse in base allo sviluppo della piattaforma, alle
              esigenze tecniche o ai feedback degli utenti.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              10. Versione beta e fase di test
            </h2>
            <p className="mt-2">
              Durante la fase iniziale, beta o di test, la piattaforma potrebbe
              contenere funzionalità sperimentali, incomplete o soggette a
              modifiche.
            </p>
            <p className="mt-2">
              Gli utenti tester sono invitati a segnalare eventuali problemi,
              bug, difficoltà d’uso o suggerimenti per migliorare il servizio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              11. Privacy e trattamento dei dati
            </h2>
            <p className="mt-2">
              Il trattamento dei dati personali è descritto nella Privacy Policy
              di Slotta. L’attività che utilizza Slotta è normalmente titolare
              del trattamento dei dati dei propri clienti, mentre Slotta opera
              come fornitore tecnico della piattaforma.
            </p>
            <p className="mt-2">
              Per maggiori informazioni consulta la{' '}
              <Link
                href="/privacy"
                className="font-black text-[#1FA7A6] underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              12. Modifiche ai termini
            </h2>
            <p className="mt-2">
              Questi termini possono essere aggiornati nel tempo. Le modifiche
              saranno pubblicate su questa pagina con indicazione della data di
              ultimo aggiornamento.
            </p>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <h2 className="text-base font-black">
              Nota
            </h2>
            <p className="mt-2">
              Questi termini sono una versione generale predisposta per la fase
              iniziale del servizio. Prima dell’utilizzo commerciale su larga
              scala, è consigliabile farli verificare da un professionista legale
              o da un consulente privacy.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}