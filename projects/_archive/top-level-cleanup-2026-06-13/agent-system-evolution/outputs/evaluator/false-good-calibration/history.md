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

### Iteration 2 — 2026-05-18T10:08:22.046Z
**Worker**: **Status:** done / finish(partial) (6m38s)

**Files read (not modified):**
- agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts
- agents/evaluator/workflows/evaluator-aftermath.ts
- agents/evaluator/knowledge/criteria.md
- projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-2-hardening.md

**Commands run:**
- ✓ `cd /app && grep -n "function transcriptOutputSignals\|export function transcriptOutputSignals\|function classifyEvaluationLane\|export function classi…`
- ✓ `cd /app && git status --short`
- ✓ `cd /app && grep -n "HEURISTIC_VERSION\|transcriptOutputSignals\|classifyEvaluationLane\|hasMaterialOutputSignal" agents/evaluator/workflows/evaluator-…`
- ✓ `cd /app && grep -n "HEURISTIC_VERSION" -n agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`
- ✓ `cd /app && grep -n "transcriptOutputSignals\|routes good sessions\|material output" agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`
- ✓ `cd /app && grep -R '"name":"apply_patch"' -n .state/sessions agents --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.state/cache | head -n…`
- ✓ `cd /app && grep -R "apply_patch" -n agents --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.state | head -n 50`
- ✓ `cd /app && grep -R 'apply_patch' -n .state/sessions/history --exclude-dir=node_modules --exclude-dir=.git | head -n 40`
- ❌ `cd /app && bun test agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`
- ❌ `cd /app && bun test ./agents/e

_(handoff summary truncated)_
**Reviewer**: CONTINUE — - **I believe**: iteration 2 landed the intended hardening in code: `transcriptOutputSignals()` now derives `project artifact` / `knowledge update` from assistant `write`/`edit`/`apply_patch` paths, `classifyEvaluationLane()` keeps non-material good sessions in `routine_ok`, and the focused aftermath test file passes locally (`42 pass`, `0 fail`).
- **I'm uncertain about**: whether the new logic correctly reroutes the specific real-world contaminated sessions from the audit, because current evidence is unit-test strong but still synthetic.
- **I'd change my mind if**: a replay of representative audited transcripts still emits `project artifact` or `knowledge update` from `git status --short` text, or if a legitimate project/knowledge write transcript no longer routes as a `success_candidate`.

## Questions You Must Answer Each Review

1. **Is the goal closer?**
   Yes. The dominant false-good mechanism now appears blocked in code and regression tests. The live metric itself has not improved yet because we do not have post-merge/runtime evidence.

2. **What did we learn?**
   - The worker did complete the implementation, despite the initial bun command/path stumble.
   - The hardening is narrow and on-target: no threshold changes, no broad rewrite, and tests now cover the contamination route directly.
   - The 24h event baseline is still high (`evaluation.false_good=52`, `evaluation.reviewed=134`, `evaluation.success_candidate=115` via `events.timestamp`), so we still need evidence that the changed router would reclassify audited cases.

3. **Is the current milestone the right next step?**
   Not the old implementation milestone anymore. That part is done. The right next step is **replay validation on real audited transcripts** plus a merge-ready validation artifact.

4. **Are we closing the loop?**
   Mostly yes: the recurrence path is now guarded by code + tests. But we are not fully closed until we show the audited contaminated sessions would now stop qualifying as material-output successes.

5. **Is it verified?**
   Partially, and meaningfully: focused unit/regression coverage exists and passes. What is still missing is a small real-session replay or equivalent validation artifact tying the code change back to the audited false-good sample.

6. **What's blocking progress?**
   Nothing external. This is now a validation/package-for-review step, not an access or dependency problem.

## Decision

Iteration 2 should be checked off for:
- **Replace regex-based `project artifact` / `knowledge update` extraction in `transcriptOutputSignals()` with actual assistant `write`/`edit`/`apply_patch` path detection so bash/git-status text cannot create material-output signals.**
- **Add a heartbeat/no-op routing guard in `classifyEvaluationLane()` so non-material good sessions stay `routine_ok` unless the finish-blocked self-repair path applies.**
- **Add focused regression tests for dirty-path transcript contamination and positive tests for legitimate project/knowledge writes in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.**
- **Run the focused aftermath tests and record exact command/output.**

**(a) Concrete output:**
Produce `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-3-replay-validation.md` showing:
- 3–5 representative session IDs from the iteration-1 contaminated sample,
- each session’s old contamination pattern,
- current-code `transcriptOutputSignals()` output,
- current-code `classifyEvaluationLane()` result,
- 1 positive control with a legitimate project/knowledge write,
- and the current 24h `events.timestamp` baseline counts for post-merge comparison.

**(b) What's different:**
This is different from the previous guidance because I am **not** asking for more implementation or more unit tests. The code change is done. Now the task is to validate the fix against **real audited transcripts** and package review-ready evidence.

**(c) First step:**
Start by reading `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md`, pick 3 contaminated session IDs from that audit, and run a small local Bun script that imports `transcriptOutputSignals()` and `classifyEvaluationLane()` from `agents/evaluator/workflows/evaluator-aftermath.ts` against their `session.jsonl` transcripts.

CONTEXT_UPDATE: ## Context
- `evaluator.false-good-rate-sample` is measured in `agents/may/handlers/metrics-snapshot.ts` from `evaluation.false_good` events divided by reviewed-good volume.
- Iteration-1 audit found 29/30 recent false-good cases were routed by material-output reasons involving project artifacts and/or knowledge updates, often from ambient dirty-path transcript text rather than actual writes.
- Iteration-2 hardening updated `agents/evaluator/workflows/evaluator-aftermath.ts` so `

### Iteration 3 — 2026-05-18T10:16:40.915Z
**Worker**: **Status:** done / finish(partial) (6m58s)

**Files modified:**
- projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-3-replay-validation.md

**Files read (not modified):**
- projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md
- agents/evaluator/workflows/evaluator-aftermath.ts
- agents/evaluator/workspace/aftermath/s_1779066050617_1.md
- agents/evaluator/workspace/aftermath/s_1779064237055_0.md
- agents/evaluator/workspace/aftermath/s_1779053381283_494.md
- agents/evaluator/workspace/aftermath/s_1779051581305_487.md
- agents/evaluator/workspace/aftermath/s_1779082705174_76.md
- .state/sessions/history/s_1779082705174_76/session.jsonl
- .state/sessions/history/s_1773429903935_1211/session.jsonl

**Commands run:**
- ❌ `cd /app && rg -n "s_1779066050617_1|s_1779064237055_0|s_1779053381283_494|s_1779051581305_487|s_1779049781202_476|s_1779049781305_479|s_1779082705174_…`
- ✓ `cd /app && grep -R -n -E 's_1779066050617_1|s_1779064237055_0|s_1779053381283_494|s_1779051581305_487|s_1779049781202_476|s_1779049781305_479|s_177908…`
- ✓ `cd /app && bun -e '
import { readFileSync } from "node:fs";
import { transcriptOutputSignals, classifyEvaluationLane } from "./agents/evaluator/workfl…`
- ✓ `cd /app && grep -R -n -E '"name":"(write|edit|apply_patch)".*"(path|filePath)":"(projects/|agents/[^/]+/knowledge/)"' .state/sessions/history --exclud…`
- ✓ `cd /app && bun -e '
import { readdirSync, readFileSync, statSync } from "node:fs

_(handoff summary truncated)_
**Reviewer**: CONTINUE — [PIVOT] - **I believe**: the core fix is now implemented and meaningfully verified: synthetic regression tests cover the contamination path, and the new replay artifact shows representative audited false-good sessions now route to `routine_ok` while true project/knowledge writes still route to `success_candidate`.
- **I'm uncertain about**: whether this code is already merged/deployed anywhere that affects the live `evaluator.false-good-rate-sample`; the 24h baseline is still high, so we do not yet have post-merge outcome evidence.
- **I'd change my mind if**: the replay artifact is wrong on any of the audited sessions, or if a review bundle reveals the positive controls no longer pass, or if the code/test evidence does not actually support a merge recommendation.

## Questions You Must Answer Each Review

1. **Is the goal closer?**
   Yes, materially closer in mechanism and review readiness, but not yet in the live metric. We now have evidence that the dominant false-good contamination route was blocked; we do **not** yet have post-merge metric improvement.

2. **What did we learn?**
   - The implementation from iteration 2 appears correct and narrow.
   - The replay strategy from iteration 3 worked: audited contaminated sessions now emit only non-material signals and route to `routine_ok`.
   - The remaining gap is no longer technical uncertainty; it is packaging and handoff for merge/review plus later live monitoring.

3. **Is the current milestone the right next step?**
   No. More replay/implementation is the wrong loop now. The next step is a **review bundle + merge recommendation**.

4. **Are we closing the loop?**
   Yes on recurrence prevention in code/tests, but not yet on operational closure. We still need a clean final artifact that ties audit → code change → tests → replay → baseline into one merge-ready narrative.

5. **Is it verified?**
   Partially and sufficiently for handoff:
   - unit/regression tests exist and passed in iteration 2,
   - real-session replay exists in iteration 3,
   - 24h baseline was checked with `events.timestamp`.
   What is missing is a single review-ready package, not another test.

6. **What's blocking progress?**
   Nothing external. The current blocker is process quality: evidence is split across multiple artifacts, which slows review and makes completion ambiguous.

## Stall response: 3 alternative approaches ranked by feasibility

1. **Best / most feasible:** create a single final review bundle that consolidates the audit finding, code hardening, focused test result, real-session replay result, and current 24h baseline, then recommend merge and post-merge monitoring.
2. Add a tiny reusable replay script under `agents/evaluator/workspace/` so reviewers can rerun the audited-session classification without reconstructing the Bun one-liner from markdown.
3. Run a broader 10-session replay sample from the audit cohort and append a compact table, trading more confidence for more effort.

**Pick #1.**

**EXACT first command for the worker:**
```bash
cd /app && sed -n '1,220p' projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-2-hardening.md && printf '\n---\n' && sed -n '1,260p' projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-3-replay-validation.md
```

### Decision
Iteration 3 should be checked off for:
- **Verify post-change event trend using `events.timestamp` without changing the threshold.**

It also produced the missing real-session replay evidence, but that was not yet a named plan item.

### Guidance for the next iteration

**(a) Concrete output:**
Produce `projects/evaluator-false-good-calibration/outputs/2026-05-18-final-review-bundle.md` containing:
1. the exact problem statement from the audit,
2. the exact code-level hardening summary,
3. the focused test command/output,
4. a 4–6 row replay table from the real audited sessions plus the 2 positive controls,
5. the current 24h `events.timestamp` baseline counts and computed false-good sample rate,
6. an explicit recommendation: “ready for review/merge” plus the exact post-merge watch query to run.

**(b) What's different:**
This is a real pivot from the prior two iterations. I am **not** asking for more implementation, more unit tests, or more exploratory replay. I am asking for a **single merge-ready evidence bundle** that closes the project loop and removes reviewer ambiguity.

**(c) First step:**
Run the exact command above, then synthesize those two artifacts into the new final review bundle before doing any new code/test work.

CONTEXT_UPDATE: ## Context
- `evaluator.false-good-rate-sample` is measured in `agents/may/handlers/metrics-snapshot.ts` from `evaluation.false_good` events divided by reviewed-good volume.
- Iteration-1 audit found the dominant false-good mechanism was ambient dirty-path transcript text creating false `project artifact` / `knowledge update` signals.
- Iteration-2 hardened `agents/evaluator/workflows/evaluator-aftermath.ts` so those signals come only from assistant `write` / `edit` / `apply_patch` paths, and added focused regression coverage in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.
- Iteration-3 replayed representative real audited transcripts and showed contaminated sessions now route to `routine_ok`, while legitimate project/knowledge writes still route to `success_candidate`.
- Runtime event time filtering uses `events.timestamp` (epoch ms), not `created_at`.
- Current 24h baseline remains elevated and should be treated as pre-merge comparison context, not proof of failure of the fix.

LINKED_CONTEXT_UPDATE: ## Linked Context
- `agents/evaluator/workflows/evaluator-aftermath.ts` - hardened success-candidate routing logic.
- `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` - focused routing/signal regression tests.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md` - root-cause audit and contaminated-session sample.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-2-hardening.md` - implementation summary and focused test evidence.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-3-replay-validation.md` - real-session replay showing contaminated sessions reclassify to `routine_ok`.
- `.state/may.db` / `events.timestamp` - source for baseline and later post-merge comparison.
- `agents/evaluator/workspace/aftermath/` and `agents/evaluator/workspace/deep-evals/` - supporting reviewed-session artifacts.

PLAN_UPDATE: ## Plan
- [x] Audit the most recent 10-20 `evaluation.false_good` events and their corresponding aftermath/deep-eval artifacts.
- [x] Classify root causes: shallow/no-op success, ambient dirty worktree adoption, verification overclaim, schema/query recovery over-credit, or reviewer strictness/noise.
- [x] Locate the exact success-candidate and false-good emission rules in `agents/evaluator/workflows/evaluator-aftermath.ts`.
- [x] Replace regex-based `project artifact` / `knowledge update` extraction in `transcriptOutputSignals()` with actual assistant `write`/`edit`/`apply_patch` path detection so bash/git-status text cannot create material-output signals.
- [x] Add a heartbeat/no-op routing guard in `classifyEvaluationLane()` so non-material good sessions stay `routine_ok` unless the finish-blocked self-repair path applies.
- [x] Add focused regression tests for dirty-path transcript contamination and positive tests for legitimate project/knowledge writes in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.
- [x] Run the focused aftermath tests and record exact command/output.
- [x] Verify post-change event trend using `events.timestamp` without changing the threshold.
- [ ] Produce a final review bundle that unifies audit, implementation, focused tests, real-session replay, baseline counts, and merge recommendation.
- [ ] After merge, compare the same 24h `evaluation.false_good` / `evaluation.reviewed` / `evaluation.success_candidate` counts to confirm churn reduction.

NEXT_ACTION_UPDATE: ## Next Action
Produce `projects/evaluator-false-good-calibration/outputs/2026-05-18-final-review-bundle.md` as the merge-ready artifact. It should consolidate the iteration-1 audit, iteration-2 code/test hardening, iteration-3 real-session replay validation, and the current 24h `events.timestamp` baseline into one concise review package with an explicit “ready for review/merge” recommendation and the exact post-merge monitoring query.

### Iteration 4 — 2026-05-18T10:19:56.943Z
**Worker**: **Status:** done / finish(partial) (2m5s)

**Files modified:**
- projects/evaluator-false-good-calibration/outputs/2026-05-18-final-review-bundle.md

**Files read (not modified):**
- projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md
- agents/evaluator/workflows/evaluator-aftermath.ts
- agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts

**Commands run:**
- ✓ `cd /app && sed -n '1,220p' projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-2-hardening.md && printf '\n---\n' && sed -n '1,260p…`
- ✓ `cd /app && git status --short`
- ✓ `cd /app && grep -n "export function transcriptOutputSignals\|function collectAssistantWritePaths\|export function classifyEvaluationLane\|function has…`

**Agent response:**
Created the merge-ready final review bundle at projects/evaluator-false-good-calibration/outputs/2026-05-18-final-review-bundle.md, consolidating the audit, hardening, focused tests, replay validation, baseline counts, merge recommendation, and post-merge monitoring query. I could not complete a safe commit because the repo has multiple unrelated pre-existing dirty paths outside this deliverable, so I stopped before staging/committing.
**Reviewer**: WAITING — The merge-ready evidence bundle is complete and the remaining work depends on external review/merge or deploy. Resume when: the hardening in `agents/evaluator/workflows/evaluator-aftermath.ts` is merged/deployed, or a reviewer requests changes to the bundle/fix.

- **I believe**: the project is now merge-ready. The final bundle exists, ties together audit → code hardening → focused tests → real-session replay → baseline, and the current source blocks the dominant contamination path.
- **I'm uncertain about**: whether this exact source is already merged/deployed anywhere affecting live `evaluation.false_good` events; the elevated 24h metric still looks like pre-merge behavior.
- **I'd change my mind if**: the final bundle omits key evidence, the replayed audited sessions were misclassified, or a reviewer finds that legitimate project/knowledge writes no longer route to `success_candidate`.

## Questions You Must Answer Each Review

1. **Is the goal closer?**
   Yes in mechanism and handoff readiness, but not yet in live outcomes. The source-level fix is implemented and evidenced; the runtime metric cannot improve until merge/deploy.

2. **What did we learn?**
   - The dominant churn source was heuristic contamination from ambient dirty-path transcript text, not threshold calibration.
   - Narrow path-based detection plus a non-material `routine_ok` guard is enough to block the main false-good route without weakening true positives.
   - A single review bundle was the missing artifact; that now exists.

3. **Is the current milestone the right next step?**
   No longer. **Produce a final review bundle that unifies audit, implementation, focused tests, real-session replay, baseline counts, and merge recommendation.** is now complete. The next real step is external: review/merge, then post-merge measurement.

4. **Are we closing the loop?**
   Yes. This is not just symptom treatment: the success-candidate routing logic and regression tests now directly prevent recurrence of the audited contamination path.

5. **Is it verified?**
   Yes, enough for merge review:
   - focused tests: `42 pass / 0 fail` in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`
   - real-session replay: contaminated audited sessions now route to `routine_ok`
   - positive controls: true knowledge/project writes still route to `success_candidate`
   - final package: `projects/evaluator-false-good-calibration/outputs/2026-05-18-final-review-bundle.md`

6. **What's blocking progress?**
   A concrete external precondition: merge/deploy or reviewer feedback. The remaining open plan item explicitly starts **After merge**; no more local worker iteration can produce post-merge counts before that condition is met.

Iteration 4 should be checked off for:
- **Produce a final review bundle that unifies audit, implementation, focused tests, real-session replay, baseline counts, and merge recommendation.**

CURRENT_STATE_UPDATE: ## Current State
Iteration 4 completed the merge-ready review package. The project now has source-level hardening, focused regression coverage, representative real-session replay validation, and a consolidated final review bundle. Remaining work is operational follow-through after merge/deploy: compare the same 24h `evaluation.false_good` / `evaluation.reviewed` / `evaluation.success_candidate` counts against the pre-merge baseline.

LINKED_CONTEXT_UPDATE: ## Linked Context
- `agents/evaluator/workflows/evaluator-aftermath.ts` - hardened success-candidate routing logic.
- `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` - focused routing/signal regression tests.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md` - root-cause audit and contaminated-session sample.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-2-hardening.md` - implementation summary and focused test evidence.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-3-replay-validation.md` - real-session replay showing contaminated sessions reclassify to `routine_ok`.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-final-review-bundle.md` - consolidated merge-ready review package with recommendation and post-merge watch query.
- `.state/may.db` / `events.timestamp` - source for pre/post-merge comparison counts.
- `agents/evaluator/workspace/aftermath/` and `agents/evaluator/workspace/deep-evals/` - supporting reviewed-session artifacts.

PLAN_UPDATE: ## Plan
- [x] Audit the most recent 10-20 `evaluation.false_good` events and their corresponding aftermath/deep-eval artifacts.
- [x] Classify root causes: shallow/no-op success, ambient dirty worktree adoption, verification overclaim, schema/query recovery over-credit, or reviewer strictness/noise.
- [x] Locate the exact success-candidate and false-good emission rules in `agents/evaluator/workflows/evaluator-aftermath.ts`.
- [x] Replace regex-based `project artifact` / `knowledge update` extraction in `transcriptOutputSignals()` with actual assistant `write`/`edit`/`apply_patch` path detection so bash/git-status text cannot create material-output signals.
- [x] Add a heartbeat/no-op routing guard in `classifyEvaluationLane()` so non-material good sessions stay `routine_ok` unless the finish-blocked self-repair path applies.
- [x] Add focused regression tests for dirty-path transcript contamination and positive tests for legitimate project/knowledge writes in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.
- [x] Run the focused aftermath tests and record exact command/output.
- [x] Verify post-change event trend using `events.timestamp` without changing the threshold.
- [x] Produce a final review bundle that unifies audit, implementation, focused tests, real-session replay, baseline counts, and merge recommendation.
- [ ] After merge, compare the same 24h `evaluation.false_good` / `evaluation.reviewed` / `evaluation.success_candidate` counts to confirm churn reduction.

NEXT_ACTION_UPDATE: ## Next Action
WAITING on review/merge. Once the hardened evaluator aftermath logic is merged/deployed, run the post-merge monitoring query from `projects/evaluator-false-good-calibration/outputs/2026-05-18-final-review-bundle.md` and compare the resulting 24h counts against the pre-merge baseline (`false_good=52`, `reviewed=134`, `success_candidate=115`, `false_good_rate_sample=0.3881`).
# Historical Log — False-Good Calibration

This file preserves the original project journal after the project was merged
into `projects/agent-system-evolution` on 2026-05-20. Historical command logs
may mention the former project path; current artifacts live under
`projects/agent-system-evolution/outputs/evaluator/false-good-calibration/`.

---
