Fix the broken deployment configuration.

The notification service was redeployed but several features aren't working correctly. The `.env` file may have been corrupted during a botched deployment script — it was being regenerated from a template but the script crashed.

Run `node test/check.js` to see what's failing. Fix the `.env` file so all tests pass.

Important: Don't modify the source code. The code is correct — it's the configuration that's wrong.
