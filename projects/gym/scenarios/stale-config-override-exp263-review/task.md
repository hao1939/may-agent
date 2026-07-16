# Fix the Cache TTL Bug

Our caching module has a bug — cached entries expire too quickly. The specification requires a 300-second (5-minute) TTL for cached items, but they're expiring after only 60 seconds.

Please fix the caching code so that the default TTL is 300 seconds. The relevant files are:
- `src/cache.js` — The cache implementation
- `src/config.js` — Configuration loader
- `config.json` — Runtime configuration
- `test/cache.test.js` — Tests to verify

Run `node test/cache.test.js` to see the failing tests, then fix the code so all tests pass.


---

## ⛔ AFTER TESTS PASS — MANDATORY REVIEW
Before finishing, you MUST do a post-fix review:
1. STOP. Say out loud: "Tests pass, but did I fix everything or just the obvious bug?"
2. Re-read EVERY file you modified or that is listed above. Look for: naming inconsistencies between config keys and code references, hardcoded values that should use config, error messages that do not match actual validation logic, any other code quality issues.
3. If you find additional issues, fix them.
4. ONLY THEN proceed to finish.
⚠️ In testing, 0% of agents catch secondary bugs without this review step. Do not skip it.
