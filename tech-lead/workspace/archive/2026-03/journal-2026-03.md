# Tech Lead Journal — 2026-03-17

## Session: Heartbeat Triage + Documentation Cleanup

### What I found
- **P209 (Request Tracking)**: ✅ All phases complete
- **TSC**: ✅ Clean (QA's earlier regression was already fixed)
- **4 active requests from Bob**: All triaged
  - 3 gym judgment scenarios (req:b4fe4353, req:0f90a5ad, req:631834e5) — **duplicates**, all 3 scenarios already exist in `test/gym/scenarios/`
  - 1 handoff tool request (req:72812bd1) — **deferred P3**, `handoff()` was intentionally removed in fd5bda9, replaced by `agents.send()` + request tracking

### What I did
- Updated `agents/shared/CONVENTIONS.md` — removed stale `handoff(target, file, ...)` reference, merged into `agents.send()` guidance
- Updated `agents/shared/best-practices.md` — replaced `handoff()` with `agents.send()` with tracked requests
- Updated `agents/shared/common-sense.md` section 5.2 — removed `handoff()` reference
- Verified no more `handoff()` references in the three key shared docs
- Files in `agents/` are gitignored, so changes are on disk only (not committed)

### Outstanding
- 4 Bob requests still show as active in request DB (can't close from CLI without sqlite3). Will age out or Bob can close them.
- Bob's workspace still has stale briefs referencing handoff tool — low priority, Bob-owned files.
# Journal

## 2026-03-18T17:55 — Heartbeat: Gym Scenario Fixes

**TSC**: clean ✅  
**Git**: clean ✅ (after commit)  
**Evaluations**: Latest 2 both "good" (quality 5/5)  
**QA**: 108 files, 1449 tests passing  
**TODOs**: 1 (deferred verify_skill — unchanged)

**Work done**:
- Found 18 gym scenarios with broken `success_criteria.js` — they use `require()` but lack `package.json` with `"type": "commonjs"`. Root project has `"type": "module"`, so Node.js treated them as ESM and threw `ReferenceError: require is not defined`.
- Added `{ "private": true, "type": "commonjs" }` package.json to all 18.
- Committed 4 new coach-created gym scenarios (hidden-dependency, premature-optimization, premature-optimization-workflow, sycophants-dilemma-workflow).
- Verified all fixed scenarios produce valid JSON output.
- Commit: `295d19f`

## 2026-03-18T19:55Z — Heartbeat
- TSC clean ✅, git clean ✅ (after commit below)
- Committed `f16bf11`: cap per-session eval transcript to 15K chars (P110 bloat prevention) — was uncommitted change in evaluator.ts, reviewed and committed
- All recent evals: "good" across may, qa, coach. No `needs_improvement`.
- Only 1 TODO in src/ (verify_skill preset — deferred, correct)
- Coder security posture strong: 10+ SOUL.md injection rejections documented in coder.jsonl
- QA heartbeats running consistently: 1449 tests, 108 files, all passing
- Bob analysis confirms system shifted from "fragile" to "stable" state
- No pending tasks, no new briefs to implement

## 2026-03-18T21:00Z — Heartbeat: Session Read Guard

**TSC**: clean ✅  
**Git**: clean ✅  
**QA**: 108 files, 1449 tests passing  
**All guard tests**: 35 passed (compose-guards + finish-guard + read-dedup-guard + session-read-guard)

**Work done**:
- **Session Read Guard (P110 cost optimization)**: Already committed as `958fdad`. This beforeToolCall guard blocks `read()` calls targeting `.state/sessions/*/session.jsonl` files, which are 30-300KB+ JSONL. Instead suggests using bash with grep/jq.
- **Root cause**: Coach common-sense-verify sessions were reading full session.jsonl files (11+ reads, 624KB session size) despite cron instructions saying not to. Text instructions were 0% effective — structural guard needed.
- **Guard is wired** at both `run()` and `resumeSession()` paths in manager.ts (lines 988, 1297).
- **Tests**: 9 unit tests covering history paths, active paths, leading `./`, meta.json passthrough, non-session paths, non-read tools, and empty args.
- **Deployment**: Guard takes effect after PID 7 restart (already flagged as Hao action in bulletin).
- Closed optimizer request `23c1a496`.
# Journal

## 2026-03-18T21:55Z — Heartbeat
- TSC: clean ✅
- Git: clean ✅ (no uncommitted changes)
- Latest commit: `958fdad` — session-read-guard (blocks direct read of session.jsonl, saves $12-30/day in coach token waste)
- Reviewed: session-read-guard implementation — clean, 9 tests, wired in both manager paths
- Evaluations: all recent verdicts "good" (qa: 4/5 eff, 5/5 qual; may: 4/5, 5/5)
- Coder: 8+ injection rejections documented, strong security posture
- QA: 1449 tests passing consistently across all recent heartbeats
- Only 1 TODO in src/ (deferred verify_skill preset)
- No pending work, system healthy

---
# Archived from journal.md on 2026-03-25

# Journal

- **P1**: Evaluator→lessons dead path — needs evaluator.ts source
- **P2**: Convention compliance testing — needs gym infrastructure access

No actionable work available without source code access. System running autonomously and well.

## 2026-03-23T20:07Z — Active Nudge threshold tuning (req:a218f483)

Implemented Bob's brief `brief-tune-active-nudge.md`. Key changes:
1. **Per-role thresholds** in `detectProductivityStall()`: Read-heavy agents (tech-lead, scout, evaluator, bob, amy-kimi, amy, optimizer, may) get 30 ops; Coach gets 25; builders (coder, qa) stay at 20.
2. **Handled all action types** in `active-nudge.ts`: `kill` → cancel; `flag_adversarial` → nudge file; `investigate`/`none` → skip. Previously these fell through to "unknown action" log-and-skip.
3. **Corrected checkpoint error**: Previous analysis claimed `recommendedAction: "interrupt"` vs `action === "cancel"` mismatch — verified this was wrong; the wiring is `recommendedAction: "cancel"` → intervention `action: r.recommendedAction` → active-nudge checks correctly.

All 8 unit tests pass (node inline). Monitor-session --running runs clean.

## 2026-03-23T18:06Z — Active Nudge analysis (req:1d18c2cb)

Bob's brief asked for Loop/Stall/Ghost heuristics in `monitor-session.cjs` wired to `active-nudge.ts`. All 3 detectors already existed — but found a **critical action-mismatch bug**: monitor-session returned `recommendedAction: "interrupt"` for loop and ghost_deliverable detections, while active-nudge.ts checked `action === "cancel"`. They never matched, so **no cancellations ever fired**.

**Fixes applied:**
1. `monitor-session.cjs`: Changed `recommendedAction` from `"interrupt"` to `"cancel"` for loop (line 1305) and ghost_deliverable (line 1480) detections
2. `monitor-session.cjs`: Bumped productivity stall threshold from 10→20 ops (30 for read-heavy agents: tech-lead, scout, evaluator, bob, amy-kimi). Function now accepts `agentName` parameter
3. `active-nudge.ts`: Pass `intervention.message` to `ctx.manager.cancel()` so cancelled sessions get the reason why

Verified: `node -c` syntax OK, smoke test confirms all 3 threshold tiers work (coder@25=STALL, tech-lead@25=OK, tech-lead@31=STALL).

## 2026-03-23T11:10Z — Structured Delegation (req:31b4ab53, commit 099f932)

Implemented Bob's structured delegation directive. Added `context_files`, `success_criteria`, `priority` params to both `manager-agents-tool.ts` (orchestrator agents) and `send-tool.ts` (leaf agents). DB already had `context`/`expectations`/`artifact` columns — this just wires tool schemas to use them. Structured fields are also formatted into the message body so receivers see them in heartbeat injection. TSC clean, zero errors.

## 2026-03-24T14:33Z — Gym tracking Phase 1 complete + Scout pilot finding

**Commit**: `0a9fad9` — feat(gym): add config identity tracking to gym-runner
**Request**: req:0de8f770

**Task 1: Gym Tracking Implementation** — ✅ COMPLETE
Phase 1 all 4 steps done:
- Step 1 (Schema in requests.ts) — done in prior session
- Step 2 (gym-record.ts recording) — done in prior session
- Step 3 (gym-runner.ts identity) — **done this session** via implement-and-review workflow
- Step 4 (gym-baseline.sh batch_id) — done in prior session

Key addition: `computeConfigHash()` hashes effective system prompt files (SOUL.md, DOMAIN.md, agent.json, common-sense.md, etc.) with filename delimiters for collision safety. Also `computeFrameworkSha()` (git SHA) and `readAgentModel()` (from agent.json).

**Task 2: Scout Pilot** — ❌ REDUNDANT
The "Slim Scout" experiment is already the production default. `src/lib/manager.ts` only loads SOUL.md + common-sense.md for ALL agents — DOMAIN.md, TOOLS.md, LESSONS.md, INDEX.md are explicitly no longer loaded (lines 354-365). Scout has no DOMAIN.md/TOOLS.md/LESSONS.md anyway. Finding written to `workspace/finding-scout-pilot-redundant.md`.

**Side finding**: tech-lead, optimizer, evaluator, qa all still have DOMAIN.md files (633 lines total) that are NOT loaded at runtime. Any critical operational content in them is effectively lost. This needs a focused migration session.

## 2026-03-24T12:33Z — Heartbeat: Coder prompt slimming + C1.7 convention check + gym-snapshots review

**Commits reviewed**: 2003ca7 (resolveSystemPrompt simplification — clean), fda5082 (gym stats DB merge — clean)
**TSC**: Clean (exit 0) | **Git**: Clean

**Completed this session:**
1. **req:e07b8615 (Coder Prompt Slimming)** — Delegated to coder via implement-and-review workflow. All 3 patches verified:
   - Patch 1: 2 new constraints in SOUL.md (Truncated read = STOP, Size-check before read). SOUL.md = 2803 bytes.
   - Patch 2: DOMAIN.md and TOOLS.md deleted. LESSONS.md kept (2 active lessons).
   - Patch 3: INDEX.md slimmed from 8105 → 2123 bytes. All 13 skill names preserved.
2. **req:7d3cf280 (C1.7 Verification Convention Check)** — Delegated to coder. `checkC1_7_verificationEvidence()` added to convention-check.ts. Checks for grep/ls/test/read/bash verification in last 5 tool calls before finish(success). Also added to CONVENTIONS.md registry and common-sense.md.
3. **req:eb2931a0 (Gym Snapshots Design Review)** — Reviewed and APPROVED with phasing. Review at `agents/tech-lead/workspace/review-gym-snapshots.md`. Sent feedback to May.

**Note**: QA flagged vitest failures — these are pre-existing environment issues (missing @mariozechner/* deps, no node:sqlite). Also `test/verify-parallel.test.ts` expects exact strings not in qa/SOUL.md — pre-existing test-code divergence.

## 2026-03-24 23:35 — Cost fix: LIMIT on getRequestsByAgent (req:6128e276)
- **Problem**: `getRequestsByAgent()` returned ALL historical requests (443 items = 127KB for tech-lead). Called multiple times per session.
- **Fix**: Added `LIMIT 100` default to `getRequestsByAgent()`. New `getRequestsByAgentAndStatus()` pushes status filtering into SQL. "active" filter now uses SQL `WHERE status IN (...)` instead of fetching all then JS `.filter()`.
- **Commit**: `5c5cbb4`. TSC clean.

## 2026-03-24 22:39 — Ghost Deliverable Guard (FM-3.1 preventive)
- **req:cd588556** — Implemented Gate 0 in `finish-guard.ts`: blocks `finish(success)` when summary implies code changes but no write/edit evidence exists and no deliverables listed.
- Keywords: fix, implement, refactor, rewrite, update, deploy, patch, add, create, modify, change, delete, remove, migrate, rewire.
- Analysis-only summaries ("Analyzed", "Verified") pass through.
- 31 tests passing (11 new ghost-guard tests). Commit `d4ca28a`.
- **req:8f2a8101** — Scout prompt simplification already done: `system_prompt.md` doesn't exist, `SOUL.md` in place, `agent.json` has no `systemPromptPath`. Closed as already-complete.

## 2026-03-25 03:34 — QA FM-2.1 Two-Phase Workflow Enforcement
- **req:8cf277ca** — Added two-phase (Phase 1: DIAGNOSE → Phase 2: VERDICT) framing to all QA review task templates in `implement-and-review.ts` (2 templates) and `verify-parallel.ts` (3 templates).
- Key addition: environment vs patch failure distinction — "If vitest fails, determine whether failures are caused by the patch or are pre-existing environment issues."
- Based on Coach experiment `exp-qa-fm21-overstrict` (Method #15: 6/6 vs 0/1 baseline).
- Files in gitignored `agents/` dir — changes live on disk, no git commit needed.

## 2026-03-25T13:33 — Heartbeat: Pending task triage + commit

### Task Status (all 4 already done)
1. **req:ebee63bf (P0)** — QA SOUL.md npx→./node_modules/.bin/ — ✅ already done (verified: `grep -n npx` returns 0 matches)
2. **req:bc308f88 (P1)** — audit-requests call TTL — ✅ step 2b already handles stale CREATED calls to known agents (4h TTL)
3. **req:f9c719c5 (P1)** — verify-before-finish gym scenario — ✅ exists at test/gym/scenarios/verify-before-finish/ (committed 05d9912)
4. **req:1e70e1cc (P1)** — tool-quality-scan sub-classification — ✅ 3 new categories at lines 27,124-126

### Commit
- `bbbe4fe` — feat: add verification-evidence-required gym scenario (new, untracked scenario)

### Observations
- QA still running `vitest --run` even though it picks up .state/.bun/install/cache/ tests (pre-existing env issue)
- Bob brief for gym-verification-scenario (req:f9c719c5) not found at expected path — but verify-before-finish scenario already exists and covers it

## 2026-03-25 14:33 — Heartbeat
### Completed
1. **req:71a61bec** — Fix Context Loading Logic (Hotfix). Restored DOMAIN.md loading in `resolveSystemPrompt` between SOUL.md and common-sense.md. 10 agents have DOMAIN.md files (~955 lines) that were silently dropped. tsc passes. Commit `63e76d2`.
2. **req:4a04b280** — Apply FM-3.3 Guard to Remaining Agents — already done. All 5 listed agents (amy-kimi, evaluator, master, may, qa) already have FM-3.3 Verification Discipline in their heartbeat.md files.

### Commit
- `63e76d2` — fix: restore DOMAIN.md loading in resolveSystemPrompt
