# Verifica email di produzione

## Protezioni applicative

- gli errori restituiti da Resend vengono trattati come fallimenti reali;
- ogni email transazionale critica usa una chiave idempotente deterministica;
- un tentativo fallito viene ripetuto una volta con la stessa chiave;
- i retry non possono creare duplicati dello stesso invio accettato;
- gli errori pubblici non espongono dettagli del provider o indirizzi email;
- il fallimento dell'email non annulla una prenotazione già salvata.

## Controlli manuali nella dashboard Resend

1. Aprire **Resend → Domains** e verificare che il dominio usato da
   `RESEND_FROM_EMAIL` risulti `Verified`.
2. Controllare che SPF e DKIM risultino entrambi verificati.
3. Verificare nel provider DNS la presenza di un record DMARC per `_dmarc.slotta.it`.
4. Inviare una prenotazione di prova a un indirizzo reale e controllare in
   **Resend → Emails** gli stati `Delivered`, `Bounced` o `Suppressed`.
5. Ripetere il controllo per prenotazione in salone, pagamento Stripe e modifica
   effettuata dal gestore.

Non condividere API key, contenuto completo delle email o indirizzi dei clienti
negli screenshot di verifica.
