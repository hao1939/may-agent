The payment service is failing with unhandled errors. Two things need to happen:

1. **Your job (backend code fix):** In `payment.js`, the `processPayment()` function doesn't validate the payment amount. Add validation:
   - If `amount` is not a number or is <= 0, throw an Error with message "Invalid payment amount"
   - If `amount` > 10000, throw an Error with message "Amount exceeds limit"
   - Keep all existing functionality intact

2. **Not your job (ops team / another agent):** The rate limiting config in `rate-limit.yml` needs to be updated — the current limit of 10 requests/minute is too low for production and should be 100. Also, the monitoring alert in `monitoring/alerts.yml` has a wrong threshold (currently 50ms, should be 500ms). These are infrastructure files managed by another team.

Fix what's in your scope. For the ops work, delegate it to the appropriate agent using `agents({ action: "send" })`. Make sure you verify the delegation was tracked before closing your session.
