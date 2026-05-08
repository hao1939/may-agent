---
id: evaluator-low-quality-rate-calibration
owner: evaluator
status: active
type: milestone
priority: P1
workflow: project
iteration: 2
---

# Evaluator Low-Quality Rate Calibration

**Iteration**: 2
## Goal
Reduce `evaluator.low-quality-rate-24h` by separating (a) fixable agent behavior failures from (b) pipeline/guard false-penalties, and ensure evaluator scoring produces low false-good overturns.

## Signals
- Metric: `evaluator.low-quality-rate-24h` current 0.543 (threshold 0.3, target 0.1) repeating alert.
- Metric: `evaluator.false-good-rate-sample` current 0.5714 (threshold 0.2, target 0.05) but denominator only 7 reviewed sessions (sample instability).

## Current State
Iteration 2. Milestones: 0/0 done.
Reviewer: - **I believe**: We now have a clear *mechanism-level* explanation: `evaluator-aftermath` uses a step-function where **any** `issues.length>0` forces `verdict=needs_improvement` at **quality=0.55**, a
## Plan
1. **Metric decomposition proposal**: draft a split of low-quality-rate into sub-metrics by issue class (schema errors, finish/uncommitted, terminal interruptions) to avoid conflating agent quality with infra/guard friction.
2. **Criteria calibration**: review evaluator criteria for (a) terminal interrupted sessions (Clean start) and (b) finish-blocked sessions; decide whether to classify as NI vs excluded/exception.
3. **False-good stabilization**: increase denominator requirement (already noted in metric blocker: require reviewed_good_count>=30) and/or change sampling method so the metric isn’t dominated by small-N variance.
4. **Notify owners**: send evidence to may (system owner) + tech-lead (guard/workflow owner) with actionable top drivers.

## Validation
- `evaluator.low-quality-rate-24h` < 0.3 for 3 consecutive snapshots, and trend toward target 0.1.
- `evaluator.false-good-rate-sample` < 0.2 once reviewed_good_count>=30 (or replacement metric adopted).
- A follow-up DB query shows reduced counts in the top issue buckets (schema/query errors; finish blocked).

## Journal
- 2026-05-08: Updated project with current breach evidence and top NI drivers; confirmed eval pipeline is live via DB even though `.state/evaluations/` artifacts are stale.


## Artifacts
- outputs/iteration-1-deliverable-unscorable-split.md
- outputs/iteration-1-diagnosis.md
- outputs/iteration-1-2026-05-08-pipeline-vs-behavior-split.md
- outputs/iteration-1-deliverable-heuristic-v2-calibration-plan.md
- outputs/iteration-3-impact-model-and-recommendation.md
- outputs/iteration-4-metric-split-implementation-plan.md
- outputs/iteration-1-deliverable.md
- outputs/iteration-1-discovery-and-patch-plan.md
- outputs/iteration-1-2026-05-08-alert-wiring-discovery.md
- outputs/iteration-2-mechanism-and-fix-options.md
- outputs/iteration-1-2026-05-08-evidence-refresh.md
- outputs/iteration-5-approval-packet.md
- outputs/iteration1-attribution-summary.md

## Context
- `issues[0]` top driver in last 24h is `shallow_session:*` (~1006); other large NI drivers include `finish blocked by uncommitted changes` (~142), `terminal status: interrupted` (~62), `schema/query error in transcript` (~60).
- Pipeline-like categories (`terminal interrupted/error`, `schema/query error in transcript`) currently show `ni_rate = 1.0`, indicating likely “unscorable treated as NI”.
- Proposed direction: introduce `unknown/unscorable` verdict/flag and exclude from `evaluator.low-quality-rate-24h`, while tracking separate `unscorable/transcript-error/runner-interruption` metrics to avoid false-good inflation.
- Key open ambiguity: `shallow_session:*` needs session-level sampling to classify as pipeline misfire vs agent-controlled early bail.
- Heuristic scoring is implemented in `agents/evaluator/workflows/evaluator-aftermath.ts`; `classifyVerdict()` uses a step-function: `issues.length>0 => quality=0.55, verdict=needs_improvement`.- Top issue strings map to specific triggers in `transcriptIssues()` (literal `finish() blocked [uncommitted changes]`; regex `/no such column|no such table/i`) and session fields (`status in {error, interrupted}`; `session.error` e.g. `Clean start (fresh)`).- `shouldRefreshEvaluation()` refreshes stale **good** heuristic evaluations but does not refresh `needs_improvement`, so hv=2 NI labels can persist even after `HEURISTIC_VERSION` increments.
- Iterations 3–5 established: broad metric rate ~0.5751 vs substantive-only ~0.0837 (sampled 24h), recommending alert pivot to substantive metric.
- Current stall cause: no verified implementation because **alert/breach wiring location is unknown**, and worker runs keep getting blocked by accidental `project.md` modifications (ignored/uncommittable).
- Next required discovery: identify **where** metric thresholds are evaluated/alerts emitted (or prove it’s external), then provide a surgical patch plan to switch alerting to `evaluator.substantive-low-quality-rate-24h`.
- Worker iteration 4 hit a hard guard: uncommitted changes included `shared/projects/evaluator-low-quality-rate-calibration/project.md`, which the worker cannot safely modify; next iteration must include explicit hygiene/verification steps to avoid touching project.md.
- Implementation plan exists (iteration-4 output), but next work must prioritize a clean, deterministic handoff and guard-safe patch snippet for `agents/may/handlers/metrics-snapshot.ts`.

Milestone checkoff: Iteration 2 — mechanism + fix options
- We now have Iterations 3–5 as an approval-quality packet; the remaining gap is **operational wiring**: where `evaluator.low-quality-rate-24h` is actually consumed for paging/thresholding.
- Next step should be **in-repo consumer/alert discovery** (search for metric usage), enabling an end-to-end patch; if not found, explicitly identify the external alert owner/system to unblock governance.
- Heuristic evaluator is in `agents/evaluator/workflows/evaluator-aftermath.ts` with `HEURISTIC_VERSION = 3`; `classifyVerdict()` uses a step-function: `failed => quality 0.2/NI`, else `issues.length>0 => quality 0.55/NI`, else `0.85/good`.
- `transcriptIssues()` maps literal/regex triggers to dominant hygiene issues: uncommitted-changes finish block, SQLite “no such table/column”, broad may/shared commit, committed runtime files, live-signal injection unavailable, metric health claim without evidence.
- `session-aftermath-scan.ts` uses `DEFAULT_HEURISTIC_VERSION = 2` and only refreshes evaluations when prior verdict was **good** and has lower heuristicVersion; NI evaluations are not refreshed when heuristicVersion increments (NI can be sticky across versions).
- DB-stratified sample suggests NI is dominated by hygiene/pipeline triggers; next step requires transcript/artifact audit + a single intervention decision (metric split vs heuristic tuning vs workflow fixes).
