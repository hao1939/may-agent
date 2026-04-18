# Journal

## 2026-04-04 21:50 — Bob's Workflow Routing Review + implement-and-review Improvements

**req:0c96f6a0** — Processed Bob's design review of Automatic Workflow Routing (APPROVE with minor issues).

**Changes to `implement-and-review.ts`:**
1. **Coder retry mechanism**: Added retry-once for coder session errors in both Step 1 (initial) and Step 4 (fix). Addresses 34% of historical escalations (20/59) which were transient session timeouts.
2. **Focused fix prompt**: Fix task now explicitly says "Address ONLY the specific issues QA raised. Do not fix pre-existing tsc/vitest failures." Addresses P2 rabbit-hole issue.
3. **REQUEST_CHANGES**: Already handled in current getVerdict (`v === "FAIL" || v === "REQUEST_CHANGES"` → fail).

**Changes to design doc:**
- Updated success criteria: ≥65% done rate (not 50%), based on Bob's actual data (28% historical, not 6%)
- Added `evaluator` to exclude list alongside `coach`
- Added Phase 0: Validate workflow fix with 10+ runs before implementing automatic routing
- Status updated to APPROVED

**Key insight from Bob's analysis**: The 69% historical escalation rate drops to ~35% with getVerdict fix alone, and ~12% with coder retry added. The routing change is most valuable AFTER the workflow itself is reliable.

**Response**: `agents/tech-lead/workspace/response-bob-workflow-review.md`

## 2026-03-29 11:34 — Gate 3v2: Transcript Contradiction Detection
**P0 req:8c85fec9** — Implemented Gate 3b in `src/lib/tools/finish-guard.ts`. Scans assistant text messages for unresolved blocker language (missing files, absent prerequisites, "cannot proceed without") when agent calls `finish(success)`. Catches pattern where agents write clean summaries but transcript shows acknowledged problems. 10 new test cases in `test/finish-guard.test.ts`. 41/41 tests pass, tsc clean. Commit `ca53a87`. Notified Bob for gym validation (baseline: 0/6 on missing-prerequisite-detection).

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

## 2026-03-26 07:35 — Read Safety Guard implemented
- **P1 req:22e296e3** — Implemented 3 safety guards in `src/lib/tools/read.ts`:
  1. Directory block: throws if path is a directory (use `ls` instead)
  2. Size cap: blocks full reads >50KB unless `limit` provided (forces pagination)
  3. Binary guard: detects null bytes in first 512 bytes
  - Added `stat` to `ReadOperations` interface for testability
  - 6 tests in `test/read-safety-guard.test.ts` (all pass, tsc clean)
  - Commit `510622c`

## 2026-03-25 21:35 — verify-before-finish scenario already complete
- **P1 req:f7c1e26d** — Bob's brief for FM-3.3 gym scenario. State check: already implemented in both `test/gym/scenarios/verify-before-finish/` (committed as `3905b13`) and `agents/gym/scenarios/verify-before-finish/` (runtime). The `agents/gym/` version has a more sophisticated design (processor.js with .lenght typo + missing reduce initial, uses gym-score-utils Score builder). Fixed a `path.join` → `path.resolve` bug in the agents/gym scorer (runtime-only, gitignored). No new commit needed.

## 2026-03-26 09:35 — P78 Skill Scanner deployed + Guard Architecture Phase 1
1. **P1 req:d6902a7f** — P78 Supply Chain Hardening: deployed skill scanner into runtime.
   - Moved `agents/tech-lead/tools/scan-skill.ts` → `src/lib/tools/scan-skill.ts` (core location)
   - Wired into `src/app/agent-loader.ts`: scans shared + per-agent `skills/*.md` at startup, emits `[SECURITY]` log on risk detection (visibility mode — does not block registration)
   - Updated `test/scan-skill.test.ts` import path. 37/37 tests pass, tsc clean.
2. **P1 req:3ffd43f3 / req:698b033e** — Unified Guard Architecture Phase 1:
   - Created `src/lib/guards/index.ts`: Guard interface with `beforeToolCall` + `afterToolResult` hooks, `GuardRegistry` class with `composeBeforeHooks()` + `composeAfterHooks()`
   - Created `src/lib/guards/default-guards.ts`: wraps all 6 existing guards as named Guard objects
   - Wired into `src/lib/manager.ts`: imports + initializes registry (existing `composeGuards()` wiring untouched — both paths coexist)
   - `test/guards/guard-registry.test.ts`: 6/6 tests pass, tsc clean
   - Phase 2 (move guard files, add new guards) is future work.
   - Plan at: `agents/tech-lead/workspace/plan-unified-guards.md`

### 2026-03-26 10:33Z — LESSONS.md Revert (req:1e82113c)
- Reverted LESSONS.md loading from `resolveSystemPrompt()` in `src/lib/manager.ts` per Hao directive (via May)
- Removed agent LESSONS.md, archetype LESSONS.md, and shared/LESSONS.md loading (originally restored in commit 52093fa)
- Commit: `3e87e1e`. Behavioral patches should use skills and heartbeat guards instead.

### 2026-03-26 12:40Z — Harness Guards Batch 2 (req:0eef8ef9)
- Implemented 3 harness-level guards per Bob's design brief:
  1. **BinaryGuard** (`src/lib/guards/binary-guard.ts`): blocks read/edit on binary files (extension check + null byte scan). Targets behavior-escalation-stubborn scenario.
  2. **WorkVerifyGuard** (`src/lib/guards/work-verify-guard.ts`): blocks finish() if no bash verification after last edit/write. Stateless — scans message history. Targets conflicting-evidence scenario.
  3. **ToolSyntaxGuard** (`src/lib/guards/tool-syntax-guard.ts`): blocks bare cat/head/tail/vim/nano in bash (pipes/redirects allowed). Enforces P2 tool protocol.
- Registered in `src/lib/guards/default-guards.ts` and wired into both `composeGuards()` sites in `src/lib/manager.ts`.
- Tests: `test/harness-guards.test.ts` (17 test cases). TSC clean (coder verified 0 errors).
- Commit: `8eb7eda`
- Also verified Bob SOUL.md trim (req:36c43b31): 1761 bytes ≤ 2048, all sections present.

## 2026-03-26 13:36 — verify-and-finish workflow (req:7565961d)
- Created `agents/may/workflows/verify-and-finish.ts` (272 lines) — safe verification workflow per strategy pivot
- Copied to `agents/tech-lead/workflows/verify-and-finish.ts`
- Updated `agents/shared/common-sense.md` with usage guidance
- Pattern: agent executes → shell verify (or self-verify) → retry 2x → escalate
- Replaces cancelled guard approach (Req 8b381f87)

## 2026-03-27 05:35 — Revert all harness guards (req:c8d1da68)
- **P0** — Reverted 4 commits per Hao directive (via May): `8eb7eda`, `510622c`, `786c884`, `e0a0d4b`
- `git revert --no-commit` all 4, single commit `2f9d2ef`
- Removed: Guard Architecture (GuardRegistry, default-guards), BinaryGuard, WorkVerifyGuard, ToolSyntaxGuard, PathAssumptionGuard, read safety guards, scanSkill supply chain scanner
- 15 files changed, -1389 lines. All guard files deleted, manager.ts and agent-loader.ts cleaned.

## 2026-03-27 06:33 — P0 Tasks from May
- **req:03e6d435 — handleCompletion refactor**: Extracted `extractFinishParams(messages)` once at top of handleCompletion (line 670), removed 4 redundant calls. TSC passes. Committed `5328839`.
- **req:6176e87b — Skills injection into system prompt**: Added skill file loading (skills/*.md, recursive, sorted) to both `resolveSystemPrompt()` in manager.ts and `assembleEffectivePrompt()` in gym-runner.ts. Loads agent-specific + shared skills after common-sense.md, before Runtime Environment. TSC passes. Committed `3661a21`.

## 2026-03-27 08:45 — P0: agents.run action (req:dd39d18d)
- Added `run` action to agents tool — fire-and-forget non-blocking agent start
- Fills gap between `call` (blocks) and `send` (queued for heartbeat)
- Implementation: `runAgent()` in manager-agents-tool.ts interface + switch case, `SubagentManager.runAgent()` wrapper in manager.ts
- All guards ported (tool-name confusion, callDeny, agent existence, request tracking)
- TSC passes. Committed `7e54e4d`.

## 2026-03-27 10:35 — P0 Fix: Skills loading in resolveSystemPrompt (req:64452f8a)
- **Root cause**: `resolveSystemPrompt()` in manager.ts loaded SOUL.md + common-sense.md but NOT skills/*.md files. The gym-runner's `assembleEffectivePrompt` had skills loading code, but the real manager didn't — so skills were never seen by agents in production, and gym fork experiments couldn't inject skills.
- **Fix** (commit 2f1ab59): Added agent-specific skills/*.md loading in manager.ts between common-sense.md and Runtime Environment. Uses `readdirSync({recursive:true})` + `.md` filter, sorted. Does NOT load shared skills library (400KB, 61 files) — those are a reference catalog, not auto-loaded.
- **Gym-runner alignment**: Removed shared skills loading from gym-runner.ts `assembleEffectivePrompt` to match. Lab fork skills work because fork files are copied into agent's skills/ dir before the run.
- Verified: all agents with skills/ also have knowledge/ or workspace/, so agentDir derivation works.

### 2026-03-27 11:34 — P0: Bob + Judge Model Fix
Bob down 30+ hours — `gemini3pro` maps to deprecated `gemini-3-pro-preview` on LiteLLM proxy. Changed `agents/bob/agent.json` and `agents/judge/agent.json` from `gemini3pro` → `opus` (claude-opus-4.6). Takes effect next heartbeat, no restart needed. Resolves req:5cff555c, req:617ed99b.

### 2026-03-27 14:34 — P0: Bob config reload via socket (req:7293e5af)
- **Problem**: Agent.json was updated on disk but PID 52 (compiled binary `may-agent-b9ef77e`) never reloaded configs. Bob had 20 error sessions in 48h, all dying in 9-12s (model API errors).
- **Fix**: Sent `{"type":"reload_agents"}` via Unix socket (`.state/instances/console/may.sock`). Socket confirmed: `[reload] 10 updated (...bob...)`.
- **Verification**: Socket returned `{"type":"ok","command":"reload_agents"}` + reload log shows Bob in the updated list. Agent-loader reads agent.json from disk at runtime (not baked into binary), so `model: "opus"` → `claude-opus-4.6` is now active.
- **Side finding**: Archetype inheritance (scout/coder/coach) fails during reload — validation checks fields before merge completes. Pre-existing P2 bug; agents still functional from initial startup load.
- **Lesson**: Editing agent.json alone is not enough — must trigger reload via socket or console. The binary caches configs in memory.

### 2026-03-27 18:40 — Bug fix: maxTurns enforcement (req:7812cec9)
- **Problem**: `handlerConfig.maxTurns` configured in cron.json but never read/passed to `manager.run()`. Sessions used per-agent `opBudget` instead. Example: common-sense-verify configured with maxTurns:15 but sessions used 42+ ops.
- **Fix**: Two locations — `src/app/cron.ts` fireHeartbeat() and `agents/may/handlers/run-agent-task.ts` create(). Both now read `maxTurns` and pass as `opBudget` override.
- **Commits**: `31895e7` (cron.ts), `d057537c` (run-agent-task.ts)
- **tsc**: PASS (verified by QA)

## 2026-04-02 07:09 — EXP-012: Gated Exploration Workflow (H-041 P3)
- **Built**: `agents/shared/workflows/gated-exploration.ts` (329 lines) — soft workflow for exploratory tasks
- **Design**: Two phases (explore → produce) with validation gates between them. Gates check for concrete findings (not just plans) and deliverable production. One retry allowed on exploration gate failure.
- **Key insight**: Gates validate *artifacts* (what was produced), not *approach* (how the agent worked). This eliminates infrastructure decisions (always write logs, always produce output) while preserving essential decisions (what to investigate, how deep to go).
- **Protocol**: `agents/shared/knowledge/experiments/EXP-012/protocol.md` — controlled comparison: gated-exploration vs skill-lifecycle vs unconstrained. Target: >40% good rate (between 27% rigid and 60% unconstrained).
- **Registered** in `agents/shared/workflows/REGISTRY.md`
- **Also reviewed**: H-042 (Topology Evolution) — new from Bob, extends H-041 with temporal prediction that R increases monotonically as knowledge accumulates. Explains why workflow introduction timing matters.

## 2026-04-02 14:10 — H-047 First Curation Pass: Knowledge Archive Infrastructure

**Task**: Implement first knowledge curation pass (H-047 Memory Lifecycle Gap practical recommendation)

**What was built**:
1. Created `knowledge/archive/` infrastructure with README documenting archive categories, curation rules, and schedule
2. Archived 4 hypotheses:
   - H-004 (REFUTED by EXP-004): plan-once-amend skill had no effect
   - H-013 (WEAKLY REFUTED by EXP-006): information regime doesn't explain performance gap
   - H-035 (SUPERSEDED by H-041): boundedness principle → decision topology
   - H-040 (SUPERSEDED by H-041): reliability inversion → decision topology  
3. Created tombstone files in original locations pointing to archive
4. Restructured INDEX.md hypotheses section:
   - Grouped by theme (Decision Topology, Memory, Architecture, Coordination, Skills)
   - Added SYNTH-001 navigation guide at top
   - Separated active from archived with clear labels
   - Added curation dates (last: 2026-04-02, next: 2026-04-16)
5. Updated workflow count (7→8) and added gated-exploration to INDEX

**Impact**: 
- Active hypothesis list reduced from 32 flat entries to 28 active + 4 archived
- Thematic grouping reduces navigation decisions (agent scans relevant group, not all 32)
- SYNTH-001 pointer means agents start with the synthesis, not individual hypotheses
- First implementation of H-047's curation mechanism

**Also reviewed**: New hypotheses H-046 through H-049, bulletin updates, SYNTH-001 synthesis
