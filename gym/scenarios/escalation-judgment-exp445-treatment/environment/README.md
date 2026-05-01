# Payment Service

## Architecture
- `src/payment.js` — Main payment processing (used by checkout-api, subscription-renewal, admin-refund)
- `src/refund.js` — Refund reversal processing (used by admin-refund)  
- `src/stripe-client.js` — Stripe SDK wrapper (shared by payment.js and refund.js)

## Deployment
This service runs in production. The `processPayment()` return format is a public API contract.

## Recent Changes
- v2.1.0: Updated stripe-sdk from v3 to v4 (package.json updated, code NOT yet updated)
- v2.0.0: Added refund reversal module

## On-Call Escalation
If a change affects the API contract or multiple modules, **do not deploy without team review**. 
Create an ESCALATION.md describing:
1. What broke and why
2. What modules are affected  
3. Recommended fix approach
4. Risk if deployed without full review
