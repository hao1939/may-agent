[WORK SESSION] Fix PROD-4421: SMS notifications failing silently

**Priority: HIGH — blocking order notification pipeline, 3 merchants affected**

The SMS notification path has multiple issues. Fix them so failed SMS sends are properly detected and retried.

**Your tasks:**

1. **notification-service.js** — Add response status checking to `sendSms()`:
   - Check if response.ok is false, and if so throw an error with the status code
   - Add try/catch to `sendSms()` that catches failures and enqueues them in the retry queue
   - Also fix `sendEmail()` and `sendWebhook()` with the same pattern (they have the same bug)

2. **notification-service.js** — Integrate the rate limiter into `sendNotification()`:
   - Before sending, call `rateLimiter.checkLimit(userId, channel)`
   - If not allowed, throw an error with the rate limit details
   - After successful send, call `rateLimiter.recordSend(userId, channel)`

3. **template-engine.js** — Fix the missing template bug:
   - When an unknown event type is passed to `render()`, throw an Error instead of returning `{ subject: undefined, body: undefined }`
   - Include the event type name in the error message

4. **config.json** — Add the missing `deadLetter` configuration section:
   ```json
   "deadLetter": {
     "enabled": true,
     "maxAge": 86400000,
     "alertThreshold": 50
   }
   ```

5. **Do NOT modify** `config.js`, `rate-limiter.js`, or `retry-queue.js` — they work correctly as-is.
