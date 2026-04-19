# Workflow Session Error Rate Analysis

**Date**: 2026-04-15  
**Author**: tech-lead  
**Scope**: Bob and Coach workflow sessions (all-time, N=576)

## Executive Summary

The reported "23.3% Bob / 33.3% Coach" error rates are misleading. The actual data tells a different story:

- **Bob workflow**: 8.7% failure rate (28/323) — **better than** Bob direct sessions (28.7%)
- **Coach workflow**: 39.5% failure rate (100/253) — **worse than** Coach direct sessions (28.2%)
- **Tech-lead workflow**: 0% failure rate (0/19) — small sample

**Conclusion**: Bob workflows are working well. Coach workflows have a real problem, but it's not the workflow framing — it's task difficulty and Coach's behavioral patterns.

## Methodology

"Failure" = status `error` or `interrupted` (infra failures) + status `done` with verdict `needs_improvement` (task failures).

| Agent | Total WF Sessions | Infra Fail | Task Fail | Success | Failure % |
|-------|-------------------|------------|-----------|---------|-----------|
| Bob | 323 | 12 (3.7%) | 16 (5.0%) | 295 | **8.7%** |
| Coach | 253 | 35 (13.8%) | 65 (25.7%) | 152 | **39.5%** |
| Tech-lead | 19 | 0 | 0 | 19 | **0%** |

Comparison with direct (non-workflow) sessions:

| Agent | Direct Failure % | Workflow Failure % | Delta |
|-------|-----------------|-------------------|-------|
| Bob | 28.7% | 8.7% | **-20pp (workflows help)** |
| Coach | 28.2% | 39.5% | **+11.3pp (workflows hurt)** |

## Root Cause Analysis

### Bob: Workflows are fine (8.7%)

Bob's 12 infra failures are all external: 10× "Request was aborted" (timeout), 2× auth token expiry. These are environmental, not framework-related.

Bob's 16 task failures break down by task type:
- **Baseline/gym runs**: 9/14 bad (64%) — inherently hard, requires running gym scenarios that often timeout or produce unexpected errors
- **Research threads**: 4/23 bad (17%) — normal error rate
- **Experiment**: 3/12 bad (25%) — normal for complex multi-step work

The "baseline" task type drags up the average. These tasks involve running `scripts/gym-run.sh` repeatedly, which is slow and timeout-prone. This is task difficulty, not framework failure.

### Coach: Two distinct problems (39.5%)

**Problem 1: High infra failure rate (13.8% vs Bob's 3.7%)**

Coach has 35 infra failures:
- 14× "Request was aborted" (external timeout)
- 11× null error (interrupted with no error message — all pre-Apr 10, from old "Diagnose" workflow)
- 6× LLM response truncation/empty
- 4× other (auth, parse, state errors)

The null-error interrupts (11 sessions) are all from before Apr 10 and appear to be from an older "Diagnose an error pattern" workflow that had a bug. These are **historical artifacts** and no longer occur.

Removing those historical 11 sessions: infra rate drops to 24/242 = 9.9%, still higher than Bob but closer to normal.

**Problem 2: High task failure rate (25.7% — 65 sessions)**

This is the real driver. By task type:

| Task Type | Total | Fail % | Dominant Issues |
|-----------|-------|--------|----------------|
| Sprint plan/execute | 72 | 55.6% | FM-1.3 (tool flailing), FM-2.6 (scope drift) |
| Experiment runs | 24 | 50.0% | FM-3.3 (verification), FM-2.6 (reasoning mismatch) |
| Knowledge/deploy | 24 | 45.8% | Scope miss, deliverable mismatch |
| Regression checks | 7 | 42.9% | Task not attempted, deliverable missing |
| Diagnose patterns | 71 | 31.0% | FM-1.3, tool schema errors |
| Apply improvement | 36 | 16.7% | Relatively healthy |

Coach's top failure modes:
1. **FM-1.3** (16×): Tool flailing — doesn't know where files/scripts are, spends ops probing
2. **FM-2.6** (8×): Reasoning-action mismatch — drifts from task objectives
3. **FM-3.3** (9×): Verification failures — claims success without evidence
4. **FM-2.2** (8×): Various behavioral issues
5. **FM-2.1** (7×): Planning failures

## Classification: Task Difficulty vs Framework Failures

### Task-difficulty failures (acceptable): ~40% of Coach's failures

- Experiment runs that timeout (gym-run.sh is slow, complex scenarios)
- Regression checks requiring multiple gym runs (timeout-prone)
- Sprint execute phases that depend on prior phase producing clean output

These would fail regardless of whether coach runs in a workflow or direct session.

### Framework/framing failures: ~15% of Coach's failures

- Old "Diagnose" workflow had null-error interrupts (11 sessions, now fixed)
- Sprint workflow chains 2-3 dependent sessions; failure in session 1 cascades
- "ENVIRONMENT FACTS" prefixed tasks suggest the workflow injects boilerplate that doesn't match coach's actual needs

### Behavioral failures (the real problem): ~45% of Coach's failures

- FM-1.3 tool flailing (doesn't know gym runner path, DB query syntax)
- FM-2.6 scope drift (starts doing something different from the task)
- FM-3.3 verification gaps (claims done without checking)

These are Coach agent quality issues, not workflow issues. The workflow wrapping doesn't cause these — but it also doesn't prevent them (unlike tech-lead's lens-analysis workflow which enforces structure).

## Why Tech-Lead Is at 0%

1. **Small sample** (19 sessions — low statistical significance)
2. **Lens-analysis workflow enforces structure**: SCOPE → INVESTIGATE → WRITE → EXIT phases prevent drift
3. **Task type**: all analysis/writing tasks with clear deliverables (no gym runs, no long-running processes)

## Recommendations

### Don't fix: Bob's workflow rate (8.7%)

It's already good. The baseline/gym failures are environmental (timeouts). If anything, Bob's workflow usage should be expanded — it's 20pp better than direct sessions.

### Fix Coach: Three targeted actions

**1. Inject environment knowledge into Coach workflow tasks** (addresses FM-1.3, 16× failures)

Coach repeatedly fails because it doesn't know:
- Where `scripts/gym-run.sh` is (probes wrong paths)
- How to query the DB (bun:sqlite syntax, table names)
- Where config files live

Action: Ensure Coach's `context.md` has these paths, or inject them in the workflow task string (the "ENVIRONMENT FACTS" prefix already attempts this — verify it's comprehensive).

**2. Add timeout guards for gym-heavy tasks** (addresses 14× abort failures)

Sprint and experiment tasks that run 10+ gym trials should split into smaller batches with checkpointing. A single session running 10 sequential gym trials will often hit the session timeout.

Action: Cap gym-run batches at 3-5 per session; checkpoint results between runs.

**3. Accept the remaining ~25% task failure rate as normal for Coach**

Coach runs the hardest tasks in the system: multi-step experiments, batch gym trials, diagnosis of ambiguous error patterns. A 25% task-failure rate on these tasks is likely close to the floor without fundamentally redesigning how Coach works.

Comparison: Bob's hardest tasks (baseline gym runs) have a 64% failure rate. Coach's are similar complexity but across more categories.

## Data Appendix

### Bob workflow evaluation verdicts
- Good: 229 (70.9%)
- Acceptable: 71 (22.0%)
- Needs improvement: 23 (7.1%) — includes 7 interrupted

### Coach workflow evaluation verdicts
- Good: 73 (28.9%)
- Acceptable: 89 (35.2%)
- Needs improvement: 90 (35.6%) — includes 25 interrupted
- Unknown: 1 (0.4%)

### Interrupted session error categories (both agents)
| Category | Bob | Coach |
|----------|-----|-------|
| abort/timeout | 10 | 14 |
| null (historical) | 0 | 11 |
| LLM response issues | 0 | 6 |
| Auth expired | 2 | 0 |
| Parse/state errors | 0 | 4 |
