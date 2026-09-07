# Monitoraggio produzione Slotta

Il workflow GitHub **Production monitor** controlla ogni 30 minuti:

- home pubblica: HTTP 200 e presenza del marchio Slotta;
- `/api/health`: HTTP 200 e stato applicativo `ok`;
- protezione della prenotazione: richiesta vuota rifiutata con codice stabile e request ID;
- protezione del webhook Stripe: richiesta non firmata rifiutata con codice stabile e request ID.

Le richieste di controllo non creano prenotazioni, pagamenti o dati cliente.

## Allarme e ripristino

Se un controllo fallisce, il workflow diventa rosso e apre la issue GitHub
`[monitor] Slotta production check failed`. I fallimenti successivi aggiornano la stessa issue.
Quando tutti i controlli tornano verdi, il workflow annota il ripristino e chiude la issue.

Per ricevere anche l'email, verificare in GitHub **Settings → Notifications → Actions** che
le notifiche dei workflow falliti siano abilitate per il repository.

## Controllo manuale

Aprire **GitHub → Actions → Production monitor → Run workflow**. Il test può anche essere
eseguito localmente con:

```bash
node scripts/check-production.mjs
```

In caso di incidente, usare il request ID mostrato dall'API per cercare la richiesta nei
Runtime Logs Vercel. Sul piano Hobby non sono disponibili i Log Drains: il controllo GitHub,
i Runtime Logs e la scansione post-deploy restano la procedura operativa gratuita.
