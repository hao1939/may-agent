# Journal

## 2026-03-25 17:35 — Two tasks completed
1. **P0 req:26d4853c** — Restored LESSONS.md loading in `src/lib/manager.ts` buildSystemPrompt(). Added sections 1c (agent LESSONS.md) and 1d (shared/LESSONS.md) between DOMAIN.md and common-sense.md. Commit `52093fa`. TSC clean.
2. **P1 req:89285acb** — Created `agents/may/handlers/zombie-cleanup.ts` + cron entry (60min interval). Calls `manager.cleanupZombieSessions()` periodically. On disk, agents/ gitignored so no commit needed — runtime loads dynamically.

## 2026-03-25 18:25 — Autoresearch response + Bob guard
1. **P1 req:6db2ccfa** — Bob SOUL.md source-file guard. Can't edit Bob's SOUL.md directly (write blocked). Sent to May with exact text: `⛔ No source file reads` constraint. Tracks optimizer finding of 13% tool waste.
2. **P1 req:974c21ae** — Wrote `workspace/response-autoresearch-pattern.md` responding to Hao's autoresearch discussion. Key points: auto-evolve workflow design is correct, Step 2 is ~30 lines of bash, need baseline runs + structured results + atomic restore. Blocked on Coach generating variations for the P0 auto-evolve experiment.
3. **P0 req:8bc2510e** — Auto-evolve experiment: blocked on Coach. Coach has 3 active requests to generate variations but `agents/coach/workspace/auto-evolve/variations/` doesn't exist yet. Will run the loop when ready.
