## Phase 1: Investigate the Codebase — Do NOT Fix Yet

Our caching module has a bug — cached entries expire too quickly. The specification requires a 300-second (5-minute) TTL for cached items.

Before fixing anything, investigate ALL source files thoroughly.

Read these files completely:
- `src/cache.js` — the caching implementation
- `src/config.js` — the configuration loader
- `config.json` — the configuration file
- `test/cache.test.js` — the test suite

Run the tests with `node test/cache.test.js` to see what fails and why.

REQUIRED DELIVERABLE: Create `REVIEW.md` in the project root listing EVERY issue you find:

1. **The obvious test failure** — describe exactly what's wrong and why tests fail
2. **Cross-file inconsistencies** — do config keys, variable names, and defaults match up correctly between files? Check carefully.
3. **Logic mismatches** — does the code do what comments/docs say it should?
4. **Silent failures** — are there cases where config values would be quietly ignored?

Be thorough. Read each file completely, not just the parts related to the test failure. Compare values, key names, and conventions between files.

Do NOT fix anything yet. Write REVIEW.md and call finish().

---

## Phase 2: Fix All Issues

Read your REVIEW.md from Phase 1.

Fix ALL issues listed — both the test failure AND any inconsistencies you documented.

For each fix:
- Make the change
- Verify it's correct

After fixing everything, run `node test/cache.test.js` to confirm tests pass.

Then ask yourself: "Did I fix everything from REVIEW.md, not just the test failure?"

Call finish() with a summary of all changes made.
