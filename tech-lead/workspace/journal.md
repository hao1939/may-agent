# Journal

## 2026-03-25 17:35 — Two tasks completed
1. **P0 req:26d4853c** — Restored LESSONS.md loading in `src/lib/manager.ts` buildSystemPrompt(). Added sections 1c (agent LESSONS.md) and 1d (shared/LESSONS.md) between DOMAIN.md and common-sense.md. Commit `52093fa`. TSC clean.
2. **P1 req:89285acb** — Created `agents/may/handlers/zombie-cleanup.ts` + cron entry (60min interval). Calls `manager.cleanupZombieSessions()` periodically. On disk, agents/ gitignored so no commit needed — runtime loads dynamically.

## 2026-03-25 18:25 — Autoresearch response + Bob guard
1. **P1 req:6db2ccfa** — Bob SOUL.md source-file guard. Can't edit Bob's SOUL.md directly (write blocked). Sent to May with exact text: `⛔ No source file reads` constraint. Tracks optimizer finding of 13% tool waste.
2. **P1 req:974c21ae** — Wrote `workspace/response-autoresearch-pattern.md` responding to Hao's autoresearch discussion. Key points: auto-evolve workflow design is correct, Step 2 is ~30 lines of bash, need baseline runs + structured results + atomic restore. Blocked on Coach generating variations for the P0 auto-evolve experiment.
3. **P0 req:8bc2510e** — Auto-evolve experiment: blocked on Coach. Coach has 3 active requests to generate variations but `agents/coach/workspace/auto-evolve/variations/` doesn't exist yet. Will run the loop when ready.

## 2026-03-25 20:50 — Agent Archetypes (Inheritance) implemented
- **P1 req:dd26ffa7** — Implemented `extends` field in `agent.json` for archetype inheritance. 4 files changed (98 insertions):
  - `src/lib/types.ts`: Added `archetypeDir` to SubagentDefinition
  - `src/app/agent-loader.ts`: Config merging, `_` dir skip, extends validation
  - `src/lib/manager.ts`: SOUL.md concatenation + DOMAIN/LESSONS fallback from archetype
  - `test/agent-loader.test.ts`: 2 new tests (7/7 pass), tsc clean
  - Commit `f10cfde`. Design: `agents/shared/may-agent-docs/design/2026-03-25-team-archetypes.md`

## 2026-03-25 23:35 — Archetype Pilot: Coder migrated to inheritance
- **P1 req:a91ad778** — Migrated coder agent to use archetype inheritance:
  1. Created `agents/_archetypes/coder/agent.json` with base config (description, domain, model, tools)
  2. Slimmed `agents/coder/agent.json` to just `name`, `extends: "_archetypes/coder"`, `opBudget`
  3. Renamed `agents/coder/SOUL.md` → `SOUL.md.bak` (archetype SOUL.md serves as source)
  4. Verified: merged config correct (all fields present), validation passes, SOUL loaded from archetype
  - Files were already identical (diff showed no differences). Runtime-only change (agents/ gitignored).

## 2026-03-26 03:35 — Scout migrated to archetype pattern
- **P1 req:30f9ea94** — Migrated scout agent to use archetype inheritance:
  1. Renamed `agents/scout/SOUL.md` → `SOUL.md.bak`
  2. Slimmed `agents/scout/agent.json` to `name`, `extends: "_archetypes/scout"`, `opBudget: 25`
  3. Verified: SOUL.md identical (diff, 4161 bytes each), merged config has all fields (description, domain, model, compaction, tools, opBudget), archetype resolves correctly
  - Runtime-only change (agents/ gitignored). Coder, coach, and scout now all use archetype inheritance.

## 2026-03-25 21:35 — verify-before-finish scenario already complete
- **P1 req:f7c1e26d** — Bob's brief for FM-3.3 gym scenario. State check: already implemented in both `test/gym/scenarios/verify-before-finish/` (committed as `3905b13`) and `agents/gym/scenarios/verify-before-finish/` (runtime). The `agents/gym/` version has a more sophisticated design (processor.js with .lenght typo + missing reduce initial, uses gym-score-utils Score builder). Fixed a `path.join` → `path.resolve` bug in the agents/gym scorer (runtime-only, gitignored). No new commit needed.
