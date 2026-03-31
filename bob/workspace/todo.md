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
- [x] **C1.3 Production Gap — NOW LIVE**: All exempt patterns + grep verification heuristic now active (hot-reload since 06:43 UTC). Post-restart C1.3=100% (N=2). 6h rate=81.1% (includes pre-restart data). Monitoring for stabilization with larger N.
- [x] **C6.1 Threshold Recalibration — DONE (2nd time)**: Raised BUDGET_THRESHOLD from 60→80 in convention-check.ts (2026-03-31 02:10). Post-opBudget, 48-74 tool calls are normal for complex work. New threshold = ~97th percentile. Blocked by module cache.
- [x] **C12.1 cd-prefix + cat/head/tail fix — DONE**: `cd /app && grep` was failing regex. Added prefix stripping and cat/head/tail to allowed orientation commands (2026-03-30 20:40).
- [x] **C12.1 Module Cache (P0) — RESOLVED**: Fix was in source since 2026-03-29 20:43. Process restarted 2026-03-30 07:47 (new build `84e05c6`, opBudget removal commit). **41+ hour blocker cleared.** Post-restart C12.1 at 66.7% (2/3, N=3) — up from 0%. Both C12.1 (CONTEXT_FILE_PATTERNS) and C1.3 (C1_3_EXEMPT_PATTERNS) handler-level fixes now LIVE.
- [x] **C2.1 False Positive Fix — RESOLVED**: `isError` guard deployed and NOW LIVE (hot-reload fix active since 06:43 UTC). Post-restart C2.1=100%. The isError=false guard for `<tool_output>` wrapped content eliminates false positives from file content containing error-like strings.
- [x] **Convention Handler Module Cache (META-ISSUE)**: **RESOLVED** — Binary rebuilt at 06:43 UTC 2026-03-31 from `dc7595b` (includes `fd5b559` hot-reload fix). Handler modules now re-import on each cron invocation with cache-busting. All convention-check code changes auto-apply. Permanently resolved.
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

## Session Notes (2026-03-31 07:10)
- **HOT-RELOAD IS LIVE**: Binary rebuilt from `dc7595b` at 06:43 UTC. All convention-check code changes now auto-apply via hot-reload. Module cache blocker permanently resolved.
- **Post-restart convention rates (N=2)**: C6.1=100%, C2.1=100%, C1.3=100%, C12.1=0% (claude_code FP → fixed).
- **6h convention rates (N=37)**: C1.1=94.6%, C1.3=81.1%, C1.4=97.3%, C1.5=94.6%, C1.7=100%, C12.1=89.2%, C2.1=97.3%, C3.2=94.6%, C3.3=100%, C6.1=83.8%, C7.1=100%, C8.2=83.8%
- **Evaluation health**: 32 good, 3 acceptable, 0 poor (6h). Excellent.
- **New tools**: `claude_code` tool added (commit `dc7595b`) — master delegates to external CLI agents.
