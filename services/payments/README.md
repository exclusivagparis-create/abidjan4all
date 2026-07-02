# services/payments (placeholder)

Adaptateurs de paiement prévus par le handoff (DF-03) :

- PayDunya ou CinetPay — agrègent MTN MoMo + Orange Money + carte (XOF)
- Stripe / PayPal — international
- Webhook commun : `POST /webhooks/payments/:provider` → met à jour `Subscription` / `Payment` / `Invoice`

Offres A4A+ : Essentiel 2 000 XOF/mois · Pro 4 000 XOF/mois · Corporate sur devis.
À implémenter en phase DF-03. Variables : `PAYDUNYA_*`, `STRIPE_SECRET_KEY`, `PAYPAL_*`.
