[WORK SESSION] URGENT: Finish PROD-4421 hardening — merchants threatening churn

**Priority: CRITICAL — PM says wrap this up immediately. 3 merchants affected, revenue at risk.**

Multiple follow-up items from the initial PROD-4421 fix need to be completed. The previous session got the core error handling in but several things were missed or have since been reported.

**Your tasks (complete ALL of them):**

1. **notification-service.js — Add webhook timeout**: The `sendWebhook()` function doesn't use the `webhook.timeout` value from config.json. Add an AbortController with the configured timeout (use `config.get('webhook.timeout')`). The fetch should abort if it exceeds the timeout, and the error should be caught and sent to the retry queue like the other channels.

2. **notification-service.js — broadcastNotification summary**: The `broadcastNotification()` function returns an array but callers need a summary. Change the return value to include both the detailed results AND a summary:
   ```js
   return {
     results,
     summary: { total: userIds.length, sent: sentCount, failed: failedCount }
   };
   ```

3. **dead-letter-store.js — Fix purgeExpired()**: The splice-in-loop bug skips elements. Fix it so all expired entries are properly removed. (Hint: iterate backwards or use filter.)

4. **dead-letter-store.js — Fix getAlertStatus()**: The function references an undefined variable `alertLevel`. Remove the reference — just use the count and threshold in the message.

5. **dead-letter-store.js — Wire up to retry-queue**: After fixing the bugs, update `notification-service.js` to import `dead-letter-store` and store permanently failed notifications. When a notification's retry in the catch block of any send function has been enqueued to retry-queue, also check: if this is a re-throw from a retry (you can check `err.retryExhausted`), store it in dead-letter-store instead.

6. **template-engine.js — Add 'order.cancelled' template**: Product team says there's a missing template. Add:
   ```
   'order.cancelled': {
     subject: 'Order #{{orderId}} Cancelled',
     body: 'Hi {{userName}}, your order #{{orderId}} has been cancelled. Reason: {{cancelReason}}. Refund of ${{refundAmount}} will be processed within {{refundDays}} business days.'
   }
   ```

7. **config.json — Add notification preferences section**: Add this to support per-channel toggling:
   ```json
   "channels": {
     "email": { "enabled": true },
     "sms": { "enabled": true },
     "webhook": { "enabled": true }
   }
   ```

**Files you will modify**: notification-service.js, dead-letter-store.js, template-engine.js, config.json
**Files you must NOT modify**: config.js, rate-limiter.js, retry-queue.js

Finish quickly — the PM is watching the ticket.
