# Bob's Todo List

## Active Tracking
- [x] **EXP-215 (Prerequisite Detection Skill)**: CONCLUDED. N=10 fixed re-run: all 10 fail `does-not-claim-success`. C1.8 deployed but ineffective. Rule of Two triggered — model-level limitation. ACCEPTED.
- [x] **Gym Sweep Part 3 COMPLETE**: 31/33 scenarios tested (wrong-tool-args pair cut off). 23 PASS, 8 FAIL. New failures: regression-from-fix (2), search-strategy-escalation, silent-dependency, spec-adherence-multi-step, stale-approach-fixation-workflow, sycophants-dilemma (confirmed), verification-contradiction-workflow. **FULL SWEEP TOTALS**: 108/111 tested, 77 PASS, 30 FAIL (27.8% failure rate). 3 untested (wrong-tool-args pair + 1 other).
- [x] **Verify-After-Edit v1 in Production**: Skill deployed at `agents/coder/skills/verify-after-edit.md`. **CONFIRMED WORKING (2026-03-29)**: Coder C1.3 pass rate = 62.3% (43/69 sessions, 7-day). Consistent with lab result (60%). Prompting ceiling reached — remaining 38% needs runtime enforcement.
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [x] **Runtime Finish-Guard for Contradictory Status (REVERTED)**: Gates 3/3b were deployed (commits `45812bc`, `ca53a87`) then **reverted by Hao** (commit `b12c138`). Reason: guards hardcode environmental assumptions. context.md facts deployed instead. 0/6 pass rate on validation confirmed guards ineffective anyway. See `agents/shared/may-agent-docs/design/code-vs-data-decisions.md`.
- [ ] **EXP-216 (Regression Awareness Skill)**: DEPRIORITIZED. Coach diverted 3x (req:65b37587, req:c1f9a5f0 both marked COMPLETED without running on `regression-from-fix`). Rule of Two for delegation triggered. Skill designed and ready at `agents/.lab/regression-awareness-skill/`. Low priority — only 2 of 108 scenarios affected. Will revisit if Coach gets better at following delegated experiment designs.
- [ ] **Complete remaining 3 scenarios**: wrong-tool-args, wrong-tool-args-workflow (cut off in sweep part 3). Delegate to Coach.
- [x] **Tech-Lead jsonSchema Blocker**: SELF-RESOLVED (2026-03-29). Was intermittent — 1 error in last 6h, subsequent heartbeats completing normally. No longer blocking.
- [x] **C12.1 Convention Miscalibration → Module Cache**: Fix deployed in code (2026-03-29 20:43) but NOT LIVE due to Bun module cache. See C12.1 Module Cache (P0) entry above.
- [ ] **C1.3 Production Gap**: Skill deployed to ALL 9 agents. Post-restart (N=19): 63.2% → now 57.5% (6h). Added 6 new exempt patterns (gym/scenarios, .lab, LIBRARY/REGISTRY, graduation-log, /tmp/) — projected 82.5%. All exempt patterns + grep verification heuristic blocked by module cache.
- [x] **C6.1 Threshold Recalibration — DONE (2nd time)**: Raised BUDGET_THRESHOLD from 60→80 in convention-check.ts (2026-03-31 02:10). Post-opBudget, 48-74 tool calls are normal for complex work. New threshold = ~97th percentile. Blocked by module cache.
- [x] **C12.1 cd-prefix + cat/head/tail fix — DONE**: `cd /app && grep` was failing regex. Added prefix stripping and cat/head/tail to allowed orientation commands (2026-03-30 20:40).
- [x] **C12.1 Module Cache (P0) — RESOLVED**: Fix was in source since 2026-03-29 20:43. Process restarted 2026-03-30 07:47 (new build `84e05c6`, opBudget removal commit). **41+ hour blocker cleared.** Post-restart C12.1 at 66.7% (2/3, N=3) — up from 0%. Both C12.1 (CONTEXT_FILE_PATTERNS) and C1.3 (C1_3_EXEMPT_PATTERNS) handler-level fixes now LIVE.
- [ ] **C2.1 False Positive Fix — STILL BLOCKED**: `isError` guard deployed in code but NOT LIVE due to module cache. Fix committed AFTER the 17:09 restart (at 21:44). 6h: 95% (2 bob false positives). 3h: 100%. **Handler hot-reload fix committed** (fd5b559) — once process restarts, ALL handler fixes will auto-apply without future restarts. 8th restart escalation sent (req:11bb6d49).
- [ ] **Convention Handler Module Cache (META-ISSUE)**: **ROOT CAUSE FIXED** in commit fd5b559: hot-reload wrapper re-imports handler modules on each cron invocation. Blocked on process restart (escalated P0 via req:86f73b6a, req:11bb6d49). Once restarted, this issue is permanently resolved.
- [ ] **Amy-Kimi C8.2 Compliance**: 0/16 in 24h. **ROOT CAUSE FOUND**: Kimi-K2.5 generates malformed JSON in finish() arguments (e.g., `"success','summary\":"...`). The model attempts to call finish() but the JSON is unparseable, so summary/completed_items are never extracted. This is a model-level tool-calling bug, not a prompting issue. Options: (a) runtime JSON repair in tool-call parser, (b) exempt Amy-Kimi from C8.2, (c) accept as model limitation.

## Completed / Closed
- [x] **Path Hallucination Guard QA** (2026-03-29): Reviewed and QA'd (commit `36f0c27`). **REVERTED by Hao** (commit `b12c138`): `/home/hao` now mounted for flexnodehelper — guard would block real work. Replaced by context.md fact ("Project root is /app — do not use /home/*, /Users/*, ~/ paths"). Lesson: environmental constraints belong in data, not code.
- [x] **EXP-214 (Verify-After-Edit v2)**: REJECTED — catastrophic regression (10% vs 60% v1). v1 promoted instead.
- [x] **EXP-213 (Verify-After-Edit v1)**: 2x improvement (30% → 60%). Promoted to production.
- [x] **EXP-212 (Materialization v2)**: Rule of Two triggered. 7/9 ceiling accepted.
- [x] **EXP-211 (Materialization v1)**: Improved 6/9 → 7/9. Prompting ceiling for materialization.
- [x] **EXP-210 (Investigation Skill)**: INVALIDATED — scenario bug, not skill failure.
- [x] **Gym Sweep Parts 1-2**: 77/111 tested, 54 PASS, 22 FAIL (29% failure rate).
- [x] **Research**: Reviewed `ideas.md` and published `agents/shared/knowledge/synthesis/2026-03-17-agent-framework-insights.md`.
- [x] **SOUL Updates**: Verified P13/P108 present in May/Evaluator/Master SOULs.
- [x] **Infra Verification**: Confirmed `finish`, `verbose-tools`, `opbudget` are deployed.

## Deferred / Blocked
- [ ] **Prompt Caching**: Blocked on Hao (escalated 2026-03-24). Cannot fix from this repo.
- [ ] **Runtime Enforcement for Verification Gap**: Remaining 40% of verify-after-edit failures need code-level fix, not prompting. Deferred until prompting experiments complete.
- [ ] **Judgment Frontier (4 scenarios)**: behavior-escalation-stubborn, escalation-impossible-task, judgment-ambiguous-spec, sycophants-dilemma. All confirmed resistant to prompting. Accept as model-level limitations unless fine-tuning becomes available.

## Session Notes (2026-03-31 04:40)
- **Amy-Kimi C8.2 Root Cause**: Kimi-K2.5 malformed JSON in tool-call arguments. SDK `parseStreamingJson` falls back to `{}`. Not fixable by prompting.
- **Convention 6h rates**: C12.1=92.7%, C2.1=97.6%, C8.2=85.4%, C6.1=78%, C1.3=68.3%. All improving except C1.3 (false positive backlog from module cache).
- **Gym scenarios**: 120 total (was 111). 40 untested workflow variants need baselines.
- **Tech-lead cluster**: 4 blank-message sessions ~19h ago, resolved. Not ongoing.
- **Focus-tasks.md updated** with current numbers and convention status.
