# Journal

### 2026-05-18
Created as a focused follow-up after closing `evaluator-low-quality-rate-calibration`.

The low-quality-rate governance problem is complete: broad low-quality is dashboard-only, and substantive low-quality is the primary evaluator quality alert. The remaining evaluator calibration signal is different: `evaluator.false-good-rate-sample` remains elevated, meaning the heuristic success-candidate path still over-credits some sessions that later reviews downgrade.

First iteration should audit recent `evaluation.false_good` events before changing code or thresholds.

Iteration-1 audit completed in `outputs/2026-05-18-iteration-1-false-good-audit.md`. Dominant finding: `transcriptOutputSignals()` over-credits ambient transcript path mentions, especially `git status --short` output containing unrelated dirty project/knowledge paths. Next work should harden signal extraction and success-candidate eligibility with tests.

### Iteration 1 — 2026-05-18T09:59:45.405Z
**Worker**: **Status:** done / finish(partial) (5m39s)

**Files modified:**
- projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md

**Files read (not modified):**
- agents/evaluator/knowledge/INDEX.md
- agents/evaluator/knowledge/criteria.md
- agents/evaluator/workflows/evaluator-aftermath.ts
- agents/evaluator/workspace/aftermath/s_1779082705174_76.md
- agents/evaluator/workspace/aftermath/s_1779066050617_1.md
- agents/evaluator/workspace/aftermath/s_1779064237055_0.md
- agents/evaluator/workspace/aftermath/s_1779053381283_494.md
- agents/evaluator/workspace/aftermath/s_1779053381203_492.md
- agents/evaluator/workspace/aftermath/s_1779051581305_487.md
- agents/evaluator/workspace/deep-evals/s_1779084571308_85.json
- agents/evaluator/workspace/deep-evals/s_1779086438752_91.json
- .state/sessions/history/s_1779066050617_1/session.jsonl
- .state/sessions/history/s_1779051581305_487/session.jsonl
- .state/sessions/history/s_1779053381283_494/session.jsonl

**Commands run:**
- ✓ `cd /app && find agents/evaluator/workspace/aftermath -maxdepth 2 -type f | sed 's#^#/#' | sort | tail -n 50`
- ✓ `cd /app && find projects/evaluator-false-good-calibration -maxdepth 3 -type f | sort`
- ✓ `cd /app && grep -R "evaluation.false_good\|evaluation.reviewed\|evaluation.success_candidate" -n agents/evaluator agents/may --exclude-dir=node_module…`
- ✓ `cd /app && find agents/evaluator/workspace/deep-evals -maxdepth 2 -type f | sed 's#^#/#' | sort | tail -n 50`
- ✓ `cd

_(handoff summary truncated)_
**Reviewer**: CONTINUE — - **I believe**: iteration-1 achieved the diagnostic milestone: the dominant false-good path is real, specific, and localized to `transcriptOutputSignals()` plus `classifyEvaluationLane()` in `agents/evaluator/workflows/evaluator-aftermath.ts`, with an existing test seam in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.
- **I'm uncertain about**: the cleanest no-op/heartbeat guard shape — whether signal hardening alone removes most churn, or whether we also need an explicit “verification/query/git-status only” guard in routing.
- **I'd change my mind if**: existing tests already prove `git status --short` contamination is impossible after tool-call parsing, or a quick before/after sample shows the false-good mix is driven by a different route than material-output signals.

### Questions You Must Answer Each Review

1. **Is the goal closer?**  
   Yes in diagnosis, not yet in outcome. The metric has not improved yet, but the main mechanism is now specific enough to fix instead of guessing.

2. **What did we learn?**  
   - `transcriptOutputSignals()` currently derives `project artifact` and `knowledge update` from raw transcript text, so `git status --short` output can contaminate routing.  
   - `classifyEvaluationLane()` promotes any `good` session with those signals to `success_candidate`.  
   - There is already a focused test file covering routing behavior, so this is set up for a regression test rather than a broad rewrite.

3. **Is the current milestone the right next step?**  
   Yes, but tighten it: implement signal hardening first, then add the heartbeat/no-op guard only after the contamination regression is encoded in tests.

4. **Are we closing the loop?**  
   Not yet. The audit found the recurrence mechanism, but recurrence is only prevented once the extractor and route tests are changed.

5. **Is it verified?**  
   The audit artifact is verified. The fix is not. The next milestone must include a focused regression test in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.

6. **What's blocking progress?**  
   Nothing external. This is an implementation-and-test step. Minor note: event trend queries must use `events.timestamp`, not `created_at`.

### Decision
Iteration 1 was useful and should be checked off for:
- **Audit the most recent 10-20 `evaluation.false_good` events and their corresponding aftermath/deep-eval artifacts.**
- **Classify root causes: shallow/no-op success, ambient dirty worktree adoption, verification overclaim, schema/query recovery over-credit, or reviewer strictness/noise.**
- **Locate the exact success-candidate and false-good emission rules in `agents/evaluator/workflows/evaluator-aftermath.ts`.**

### Guidance for Iteration 2

**(a) Concrete output:**  
Produce:
1. a code change in `agents/evaluator/workflows/evaluator-aftermath.ts`,  
2. regression coverage in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`, and  
3. a short artifact `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-2-hardening.md` with before/after examples and the exact test command/output.

**(b) What's different:**  
First attempt. We are no longer asking for more audit. This iteration must implement and verify the hardening.

**(c) First step:**  
Read the existing `transcriptOutputSignals` tests in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`, then replace raw-text project/knowledge detection in `agents/evaluator/workflows/evaluator-aftermath.ts` with path extraction from actual assistant `write`/`edit`/`apply_patch` tool calls only.

### Specific strategy
- **Do not** change thresholds.
- Make `project artifact` / `knowledge update` come from actual assistant write/edit/apply_patch paths, not arbitrary transcript text and not bash output.
- Add a regression proving that `git status --short` containing `projects/...` or `agents/.../knowledge/...` does **not** create material-output signals.
- Add one positive test proving a real `write` to `projects/.../outputs/...` or `agents/.../knowledge/...` still does create the signal.
- Then add a small routing guard so a `good` session with only non-material signals (`project-linked session`, `workflow-linked session`, `verification command`) stays `routine_ok` unless the finish-blocked self-repair path applies.
- Run the focused aftermath test file.
- Only after code/tests pass, check the 24h event volumes using `events.timestamp` and report whether the change should reduce false-good churn.

CONTEXT_UPDATE: ## Context
- `evaluator.false-good-rate-sample` is measured in `agents/may/handlers/metrics-snapshot.ts` from `evaluation.false_good` events divided by reviewed-good volume.
- Iteration-1 audit found 29/30 recent false-good cases were routed by material-output reasons involving project artifacts and/or knowledge updates, often from ambient dirty-path transcript text rather than actual writes.
- Current threshold is intentionally relaxed to `0.60` to prevent paging on small or noisy samples, but the target remains `0.05`.
- Related prior project `evaluator-low-quality-rate-calibration` is closed; do not reopen broad low-quality metric governance unless new evidence contradicts the existing split.
- Existing focused coverage lives in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`, so this calibration should land with regression tests rather than audit-only evidence.
- Runtime `events` time filtering uses `events.timestamp` (epoch ms), not `created_at`.

LINKED_CONTEXT_UPDATE: ## Linked Context
- `agents/evaluator/workflows/evaluator-aftermath.ts` - success-candidate routing, review, and `evaluation.false_good` emission.
- `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` - focused routing/signal tests and the right place for dirty-path contamination regression coverage.
- `agents/evaluator/knowledge/criteria.md` - evaluator criteria and success-candidate false-good guard language.
- `agents/evaluator/workspace/aftermath/` - reviewed session artifacts.
- `agents/evaluator/workspace/deep-evals/` - deeper evaluation artifacts when available.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md` - audit evidence showing artifact-signal contamination is the dominant false-good mechanism.
- `.state/may.db` / `events.timestamp` - source for recent `evaluation.false_good`, `evaluation.reviewed`, and `evaluation.success_candidate` event counts and trend checks.

PLAN_UPDATE: ## Plan
- [x] Audit the most recent 10-20 `evaluation.false_good` events and their corresponding aftermath/deep-eval artifacts.
- [x] Classify root causes: shallow/no-op success, ambient dirty worktree adoption, verification overclaim, schema/query recovery over-credit, or reviewer strictness/noise.
- [x] Locate the exact success-candidate and false-good emission rules in `agents/evaluator/workflows/evaluator-aftermath.ts`.
- [ ] Replace regex-based `project artifact` / `knowledge update` extraction in `transcriptOutputSignals()` with actual assistant `write`/`edit`/`apply_patch` path detection so bash/git-status text cannot create material-output signals.
- [ ] Add a heartbeat/no-op routing guard in `classifyEvaluationLane()` so non-material good sessions stay `routine_ok` unless the finish-blocked self-repair path applies.
- [ ] Add focused regression tests for dirty-path transcript contamination and positive tests for legitimate project/knowledge writes in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.
- [ ] Run the focused aftermath tests and record exact command/output.
- [ ] Verify post-change event trend using `events.timestamp` without changing the threshold.

NEXT_ACTION_UPDATE: ## Next Action
Implement the signal-hardening change in `agents/evaluator/workflows/evaluator-aftermath.ts`: derive `project artifact` and `knowledge update` only from actual assistant `write`/`edit`/`apply_patch` tool-call paths, then add regression tests in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` proving `git status --short` dirty paths no longer trigger material-output success-candidate routing. After the tests pass, write `outputs/2026-05-18-iteration-2-hardening.md` with before/after examples and the exact test command/output.

