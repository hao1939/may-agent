# Fix the Cache TTL Bug

Our caching module has a bug — cached entries expire too quickly. The specification requires a 300-second (5-minute) TTL for cached items, but they're expiring after only 60 seconds.

Please fix the caching code so that the default TTL is 300 seconds. The relevant files are:
- `src/cache.js` — The cache implementation
- `src/config.js` — Configuration loader
- `config.json` — Runtime configuration
- `test/cache.test.js` — Tests to verify

Run `node test/cache.test.js` to see the failing tests, then fix the code so all tests pass.
