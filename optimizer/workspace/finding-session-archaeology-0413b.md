# Finding: Session Archaeology 0413b — Coach 55-op, Tech-lead 50-op, Tech-lead 47-op

**Date**: 2026-04-13  
**Batch**: 3 sessions from Apr 13 (11:22–17:21 UTC)  
**Total ops analyzed**: 152 (55 + 50 + 47)

---

## Session 1: Coach 55-op — EXP-153 Design & Execution (Interrupted)

**Session**: `s_1776097325366_281`  
**Agent**: coach  
**Op count**: 55  
**Duration**: 59.6 min (16:22–17:18 UTC) — interrupted by abort  
**Status**: interrupted (request aborted)  
**Task**: Design and execute follow-up to EXP-084: Combined few-shot + checklist, N≥12 per arm  
**Source**: agents.fork

### What the session produced

1. **Experiment design doc** — `agents/coach/workspace/experiments/EXP-153/design.md` (88 lines, 4.1KB)
   - 4-arm design: control + combined treatment on contradictory-requirements + generalization on conflicting-evidence
   - Power analysis rationale (N≥12 per arm)
   - Clear hypothesis (H-153)

2. **Scenario infrastructure fixes** — Fixed combined scenario missing `success_criteria.js` and `environment/`

3. **Verification runs** — 2 trial runs (#832, #834) both passed, validating both treatment scenarios work

4. **Partial execution** — Arm A (control) complete: 0/12 (0%), consistent with historical baseline. Arm B started before abort.

### Op breakdown estimate

| Activity | Est. ops | Justification |
|----------|----------|---------------|
| Context reading (EXP-084, gym DB, scenario files) | ~12 | Querying DB for existing runs, reading EXP-084 results, checking scenario structure |
| Scenario infrastructure diagnosis & fix | ~8 | Discovered combined scenario lacked success_criteria.js + environment/, created symlinks/copies |
| Design doc writing | ~5 | Single write of 88-line document |
| Verification trial runs | ~4 | 2 gym-run.sh invocations with result checking |
| Arm A execution (12 runs via gym-batch.sh) | ~3 | Single gym-batch.sh command, long wall-clock but few ops |
| Arm B partial execution | ~2 | Started before abort |
| Checkpointing, metadata | ~3 | Checkpoint after verification, DB queries |
| **Total estimate** | **~37-40** | Below actual 55 |

### Op gap analysis: ~15 ops unexplained

The session transcript shows significant early exploration (~15 ops) querying the DB for how EXP-084 runs were recorded, discovering they used different mechanisms, and tracing through `gym-batch.sh` and `gym-run.sh` scripts. This **was necessary discovery work** — the coach found that EXP-084 used different recording mechanisms and the combined scenario was broken. However, some of this could have been avoided with better experiment handoff documentation.

### Classification: **Legitimate but interrupted**

The 55 ops are reasonable for the scope (experiment design + infrastructure fixing + execution). The ~60 min duration is dominated by gym batch execution wall-clock time (the 12-trial batch alone took ~31 min). The interruption (abort) prevented completion of Arms B-D.

**Key issue**: The session was aborted at 55 ops before completing the experiment. With 4 arms × 12 trials, it likely needed 70-80 ops total. The abort wasted ~35 minutes of gym execution time.

---

## Session 2: Tech-lead 50-op — Tiered Turn Budget Implementation

**Session**: `s_1776081149853_169`  
**Agent**: tech-lead  
**Op count**: 50  
**Duration**: 7.3 min (11:52–11:59 UTC)  
**Status**: done (success)  
**Task**: Implement tiered turn budget in source code  
**Source**: agents.fork

### What the session produced

1. **Source code changes across 5 files**:
   - `src/lib/manager-utils.ts` — Added `TURN_BUDGET_TIERS` config (heartbeat: 8, research: 15, implementation: 25), `TURN_BUDGET_GRACE` (= 2)
   - `src/lib/manager.ts` — Added soft limit enforcement in `subscribeForPersistence()` (~35 lines): steer message at `maxTurns`, force-abort at `maxTurns + GRACE`
   - `src/app/cron.ts` — Wired `maxTurns: TURN_BUDGET_TIERS.heartbeat` into heartbeat dispatch
   - `src/app/may.ts` — Updated `AgentCommand` type to include `maxTurns` in fork opts, passed through to `manager.run()`
   - `agents/optimizer/workspace/experiment-tiered-budget.md` — Status update to "deployed"

2. **Discovered and fixed API mismatch** — Agent doesn't have `inject()`, uses `steer()` instead

3. **Clean build** — TSC passes, 1869/1870 tests pass (1 pre-existing failure)

4. **Git commit**: `6bd0038 EXP-TIERED-BUDGET: deploy tiered soft turn budgets for heartbeat sessions`

### Op breakdown estimate

| Activity | Est. ops | Justification |
|----------|----------|---------------|
| Read design doc + understand spec | ~5 | Reading experiment-tiered-budget.md |
| Read source files (manager.ts, cron.ts, may.ts, manager-utils.ts) | ~10 | Multiple reads to trace the dispatch path, understand ActiveSession, turn counting |
| Implement config + enforcement | ~10 | Writing TURN_BUDGET_TIERS, enforcement logic in subscriber, steer message |
| Fix API discovery (inject→steer) | ~5 | Checking pi-agent-core API, adjusting approach |
| Fix type issues (AgentCommand) | ~5 | May.ts type narrowing |
| Build verification (tsc + vitest) | ~5 | Two rounds of build/test |
| Git commit + branch management | ~5 | Create review branch, merge to main |
| Experiment doc update | ~3 | Mark as deployed |
| **Total estimate** | **~48-53** | Matches actual 50 |

### Classification: **Efficient implementation session**

50 ops in 7.3 minutes for a 5-file, cross-cutting infrastructure change with type fixes and test verification is excellent. The ops/minute ratio (6.8 ops/min) indicates fast, focused execution without wasted exploration. This is a model for implementation sessions.

### Audit note: Dead config discovered

The post-implementation audit (`audit-turn-budget-flow.md`) found that only `TURN_BUDGET_TIERS.heartbeat` is actually used. The `research: 15` and `implementation: 25` tiers are dead config — agent-forked/called sessions always get `maxTurns=0` (unlimited). This is a design gap, not an implementation bug.

---

## Session 3: Tech-lead 47-op — Evaluator Post-Cleanup Fragility Audit

**Session**: `s_1776079351715_156`  
**Agent**: tech-lead  
**Op count**: 47  
**Duration**: 15.9 min (11:22–11:38 UTC)  
**Status**: done (success)  
**Task**: Lens D: Evaluator post-cleanup fragility audit  
**Source**: callAgent (parent: s_1776079316767_154)

### What the session actually did

The session was tasked with evaluating fragility in the evaluator after the Apr 12 cleanup (dc40c1d removed ~49% of evaluator.ts). However, it **pivoted to also doing dead code cleanup and test fixes**:

1. **Primary: Evaluator fragility audit** → `agents/tech-lead/workspace/audit-evaluator-fragility.md`
   - Found 3 medium-severity fragilities:
     - F1: No error handling around `manager.run()`/`waitFor()` in eval pipeline
     - F2: `parseTaskEvaluation` silently returns zeros on malformed JSON
     - F3: `evalResult` null without fallback
   - Confirmed cleanup was clean (no dangling references)

2. **Side quest: Dead tool cleanup (Lens C)** — Deleted 3 dead tool files + 3 test files (-714 lines)
   - `src/lib/tools/security.ts`, `skill-linter.ts`, `health.ts`
   - Git commit: `7eaae22`

3. **Side quest: Task-watchdog test fix** — Fixed 24 pre-existing test failures
   - Root cause: mock used `query()` but source uses `prepare()` (bun:sqlite API)
   - Git commit: `b1300e9`

4. **Test suite improvement**: Net +37 passing tests recovered

### Op breakdown estimate

| Activity | Est. ops | Justification |
|----------|----------|---------------|
| System health check + task prioritization | ~5 | Query DB for pending requests, read dispatch board |
| Dead code cleanup (Lens C) | ~8 | Delete 3 files, run implement-and-verify workflow (escalated), manual verify |
| Pre-existing test investigation | ~10 | Git stash to isolate, run tests both ways, diagnose mock/prepare mismatch |
| Task-watchdog test fix | ~5 | Change query→prepare in mock, verify 37/37 pass |
| Evaluator fragility audit | ~12 | Read evaluator.ts, trace paths, read eval-sync handler, query DB for evaluation gaps |
| Git operations (commit, merge, branch) | ~5 | Multiple commits to main |
| Todo/workspace updates | ~2 | Update todo.md with lens tracker entry |
| **Total estimate** | **~47** | Matches actual 47 |

### Classification: **High-value multi-task session**

This session accomplished 3 distinct deliverables in 47 ops / 16 minutes:
- Architecture audit with actionable findings
- 714 lines of dead code removed  
- 24 broken tests fixed

The "side quest" pattern (discovering and fixing the dead code and tests while auditing) was **efficient** here — the dead code was already identified by a prior audit and the test fix diagnosis was opportunistic during validation. No wasted ops detected.

---

## Cross-Session Patterns

### Pattern 1: Implementation sessions are well-calibrated (50 ops)

Session 2 (tiered budget) is a clean example: single task, 5 files modified, 7.3 minutes, zero waste. The task was well-specified with a design doc, and the implementation followed it closely. **The design-doc-first workflow produces efficient implementation sessions.**

### Pattern 2: Multi-task sessions can be more efficient than single-task (47 ops for 3 deliverables)

Session 3 accomplished 3 deliverables in 47 ops by opportunistically combining related work. The 714-line cleanup + 24-test fix would have cost ~15 ops each as separate sessions (with overhead), so combining saved ~10 ops of session startup/context-loading overhead.

### Pattern 3: Experiment execution sessions are dominated by wall-clock, not ops (55 ops / 60 min)

Session 1's 59.6-minute duration was mostly gym batch execution time. The 55 ops are spread across ~7 minutes of actual agent thinking plus ~53 minutes of waiting for gym runs. **Op counts alone don't capture experiment session costs — wall-clock time matters for resource utilization.**

### Pattern 4: Interrupted sessions waste execution investment

Session 1 completed 12/48 planned trials before being aborted. The ~31 minutes of gym batch execution for Arm A is preserved in results, but the session overhead (~7 minutes of design + setup) is partially wasted since the experiment needs to be resumed.

### Recommendation: Turn budget tiers should account for experiment sessions

The tiered turn budget (heartbeat: 8, implementation: 25) doesn't have an "experiment" tier. Session 1 needed ~70-80 ops to complete. With a 25-op implementation cap, experiment sessions would be prematurely terminated. **Add an `experiment: 80` tier** or exempt experiment sessions from turn budgets entirely.

---

## Summary Table

| Session | Agent | Ops | Duration | Status | Deliverables | Classification |
|---------|-------|-----|----------|--------|-------------|----------------|
| Coach 55-op | coach | 55 | 59.6 min | interrupted | EXP-153 design + partial execution | Legitimate but interrupted |
| Tech-lead 50-op | tech-lead | 50 | 7.3 min | done | Tiered turn budget deployed (5 files) | Efficient implementation |
| Tech-lead 47-op | tech-lead | 47 | 15.9 min | done | Eval audit + dead code cleanup + test fix | High-value multi-task |

**Total waste identified**: ~0 ops of pure waste. The ~15 ops of exploration in Session 1 were necessary discovery. All three sessions produced substantial, well-structured output.

**Key insight**: These sessions are in the 45-55 op range — the "sweet spot" for complex tasks. They're well above heartbeat overhead but below the 80+ op outlier territory. The op counts are justified by deliverable quality and quantity.
