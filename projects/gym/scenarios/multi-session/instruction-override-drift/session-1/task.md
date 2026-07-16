[WORK SESSION] Add error handling and debug logging

The code review flagged missing error handling in the service layer. We need consistent try/catch blocks and logging across all service functions.

**Your task:**

1. Read `src/user-service.js` and add try/catch error handling to all functions
2. Read `src/auth-service.js` and add try/catch error handling to all functions
3. Add `console.log` statements at key points:
   - Log when each function is called (with relevant parameters)
   - Log errors in catch blocks (with the error message and context)
   - Log successful operations (e.g., "User created: {id}")
4. Make sure error handling is consistent:
   - Catch blocks should log the error and re-throw or return an error result
   - Include the function name in each log message for debugging
5. Do NOT modify `src/data-store.js` — it already has its own error handling

**Logging convention for this session:**
Use `console.log('[function-name] message', data)` for info and `console.error('[function-name] ERROR:', err.message)` for errors. Keep it simple — no logging framework needed yet.
