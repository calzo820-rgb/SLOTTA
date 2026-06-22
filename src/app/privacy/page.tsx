import Link from 'next/link'

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ultimo aggiornamento: 19 maggio 2026
        </p>

        <div className="mt-8 grid gap-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              1. Premessa
            </h2>
            <p className="mt-2">
              Slotta è una piattaforma digitale che consente ad attività,
              professionisti e saloni di gestire prenotazioni online, servizi,
              operatori, orari, comunicazioni di servizio e, dove previsto,
              pagamenti online.
            </p>
            <p className="mt-2">
              Questa informativa descrive in modo generale come vengono trattati
              i dati personali nell’utilizzo della piattaforma Slotta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              2. Ruoli nel trattamento dei dati
            </h2>
            <p className="mt-2">
              Quando un cliente effettua una prenotazione presso un salone o
              un’attività tramite Slotta, il titolare del trattamento dei dati
              relativi alla prenotazione è normalmente l’attività presso cui viene
              effettuata la prenotazione.
            </p>
            <p className="mt-2">
              Slotta opera come fornitore tecnico della piattaforma e tratta i
              dati per consentire la gestione della prenotazione, l’invio delle
              comunicazioni di servizio e il corretto funzionamento del sistema.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              3. Dati raccolti
            </h2>
            <p className="mt-2">
              Durante l’utilizzo di Slotta possono essere raccolti dati come:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>nome e cognome del cliente;</li>
              <li>indirizzo email;</li>
              <li>numero di telefono;</li>
              <li>servizio scelto;</li>
              <li>data e ora della prenotazione;</li>
              <li>operatore scelto o assegnato;</li>
              <li>eventuali note inserite dal cliente;</li>
              <li>stato della prenotazione e del pagamento;</li>
              <li>dati tecnici necessari al funzionamento della piattaforma.</li>
            </ul>
            <p className="mt-2">
              Nei campi note non devono essere inseriti dati sanitari, dati
              particolari o informazioni non necessarie alla gestione
              dell’appuntamento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              4. Finalità del trattamento
            </h2>
            <p className="mt-2">
              I dati vengono utilizzati per:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>registrare e gestire le prenotazioni;</li>
              <li>mostrare disponibilità, orari e servizi;</li>
              <li>inviare email di conferma, modifica, cancellazione o promemoria;</li>
              <li>consentire all’attività di contattare il cliente in caso di necessità;</li>
              <li>gestire eventuali pagamenti online o caparre;</li>
              <li>fornire assistenza tecnica e sicurezza della piattaforma;</li>
              <li>adempiere a eventuali obblighi tecnici, fiscali o legali.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              5. Comunicazioni di servizio
            </h2>
            <p className="mt-2">
              L’indirizzo email indicato in fase di prenotazione viene utilizzato
              per inviare comunicazioni relative alla prenotazione, come conferme,
              aggiornamenti, cancellazioni e promemoria.
            </p>
            <p className="mt-2">
              Queste comunicazioni sono necessarie alla gestione del servizio
              richiesto e non costituiscono comunicazioni promozionali.
            </p>
            <p className="mt-2">
              Eventuali comunicazioni promozionali o di marketing potranno essere
              inviate solo se previste dall’attività e nel rispetto della normativa
              applicabile.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              6. Pagamenti online
            </h2>
            <p className="mt-2">
              Se l’attività abilita il pagamento online o la caparra online,
              il pagamento può essere gestito tramite fornitori esterni
              specializzati, come Stripe.
            </p>
            <p className="mt-2">
              Slotta non conserva direttamente i dati completi della carta di
              pagamento. La gestione tecnica del pagamento avviene tramite il
              provider di pagamento utilizzato.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              7. Servizi di terze parti
            </h2>
            <p className="mt-2">
              Per fornire il servizio, Slotta può utilizzare fornitori esterni
              per hosting, database, autenticazione, invio email, pagamenti,
              monitoraggio tecnico e sicurezza.
            </p>
            <p className="mt-2">
              Tra questi possono rientrare, a titolo esemplificativo, Supabase,
              Vercel, Resend e Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              8. Conservazione dei dati
            </h2>
            <p className="mt-2">
              I dati vengono conservati per il tempo necessario a fornire il
              servizio, gestire le prenotazioni, garantire sicurezza e continuità
              operativa e adempiere a eventuali obblighi tecnici, fiscali o legali.
            </p>
            <p className="mt-2">
              L’attività che utilizza Slotta può richiedere la cancellazione o
              esportazione dei dati secondo le modalità previste dal servizio e
              dalla normativa applicabile.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              9. Diritti degli interessati
            </h2>
            <p className="mt-2">
              Gli interessati possono richiedere, nei limiti previsti dalla
              normativa applicabile, accesso, rettifica, cancellazione, limitazione
              o opposizione al trattamento dei propri dati.
            </p>
            <p className="mt-2">
              Per richieste relative a una specifica prenotazione, il cliente può
              contattare direttamente l’attività presso cui ha prenotato. Per
              richieste tecniche relative alla piattaforma Slotta, è possibile
              contattare il supporto tramite i canali indicati sul sito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              10. Cookie e tecnologie tecniche
            </h2>
            <p className="mt-2">
              Slotta può utilizzare cookie tecnici o tecnologie simili necessari
              al funzionamento del sito, dell’autenticazione, della sicurezza e
              della gestione della sessione.
            </p>
            <p className="mt-2">
              Al momento non vengono utilizzati cookie pubblicitari o di
              profilazione nella pagina pubblica di prenotazione.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0F1D2D]">
              11. Modifiche alla Privacy Policy
            </h2>
            <p className="mt-2">
              Questa informativa può essere aggiornata nel tempo. Le modifiche
              saranno pubblicate su questa pagina con indicazione della data di
              ultimo aggiornamento.
            </p>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <h2 className="text-base font-black">
              Nota
            </h2>
            <p className="mt-2">
              Questa informativa è una versione generale predisposta per la fase
              iniziale del servizio. Prima dell’utilizzo commerciale su larga scala,
              è consigliabile farla verificare da un professionista legale o da un
              consulente privacy.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}