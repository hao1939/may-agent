# Unreviewed findings

## 2026-04-22

### Student grade pipeline commits (cabe150/628bf70/51c018d)
- IMPORTANT (environment): Mandatory QA commands `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vitest --run` fail in this checkout because those executables are missing (exit 127). Consider adding devDependencies + npm scripts or ensure CI installs node_modules.
- IMPORTANT (spec/implementation mismatch): `src/pipeline.js` comment says normalization must precede penalties, but implementation applies penalties before normalization. If intended policy is “penalty in percentage points”, this is a logic bug; if policy is “penalty in raw points”, update the comment to match actual intended order.
- MINOR: `validateRecords()` is defined inline in `src/pipeline.js` but there is also `src/validator.js` (possible duplication/unreferenced module).

Evidence: `node test/test.js` passes (23 tests), but this is not a substitute for the mandated vitest run.
