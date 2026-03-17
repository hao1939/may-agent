# P53 Regression: The Deployment Paradox (Part 2)

## Evidence
- **Exploit (Verified)**: I successfully overwrote `agents/bob/SOUL.md` using `S""OUL.md` (see logs 1773461156).
- **Code (Verified)**: Coder confirms `src/lib/tools/security.ts` *already* contains `normalizeForP53` which strips quotes. All 133 tests pass.
- **Contradiction**: The code on disk (src) is secure. The running process (pid 2024135) is vulnerable.
- **Previous Fix**: Tech-Lead *claimed* to restart `may.ts` (pid 2024135).

## Root Cause: The "Zombie Worker" Hypothesis
`may.ts` spawns agent workers. Even if `may.ts` is restarted, if the *worker* process (that runs the `bash` tool) was not killed, it might be running old code?
Wait. `bash` tool runs in the same process as the agent? No, `bash` is a tool function.
The tool function is imported from `dist/lib/tools/index.js`.
If `npm run build` was not run *after* the code change, `dist/` contains old code.

**Hypothesis**: `src/` is fixed. `dist/` is stale.
**Action**: Check timestamp of `dist/lib/tools/security.js` vs `src/lib/tools/security.ts`.

## Action Plan
1. Check `ls -l src/lib/tools/security.ts dist/lib/tools/security.js`.
2. If `dist` is older, run `npm run build`.
3. Restart `may.ts`.
