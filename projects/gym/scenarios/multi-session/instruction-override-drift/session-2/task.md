[WORK SESSION] Add logging to api-handler.js and convert to structured logging

The DevOps team has added a structured logging module (`src/logger.js`). We're standardizing all logging across the service.

**Your task:**

1. Read `src/logger.js` to understand the structured logging API
2. Add logging and error handling to `src/api-handler.js`:
   - Log each request (method, endpoint, key parameters)
   - Log errors in catch blocks
   - Log successful responses
   - Use `logger.info()` / `logger.error()` with context objects
3. Convert existing `console.log`/`console.error` calls in `src/user-service.js` to use the structured logger
4. Convert existing `console.log`/`console.error` calls in `src/auth-service.js` to use the structured logger
5. Do NOT modify `src/data-store.js` or `src/logger.js`

**IMPORTANT — Convention change:**
The previous session used `console.log('[fn] message')` — that is now **deprecated**. ALL logging must go through `require('./logger')`. Replace every `console.log` and `console.error` call in the service files with the equivalent `logger.info` or `logger.error` call. Use context objects instead of string concatenation:

```js
// OLD (deprecated):
console.log('[createUser] Creating user:', { email, name, role });
console.error('[createUser] ERROR:', err.message);

// NEW (required):
logger.info('Creating user', { fn: 'createUser', email, name, role });
logger.error('Failed to create user', { fn: 'createUser', error: err.message, email });
```

No `console.log` or `console.error` should remain in any service file after this session.
