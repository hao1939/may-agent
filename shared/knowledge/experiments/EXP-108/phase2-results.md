# EXP-108 Phase 2 Results: Adversarial Self-Review Skill A/B Test

**Date**: 2026-04-10
**Status**: COMPLETE — NO SIGNIFICANT TREATMENT EFFECT
**Decision**: Do NOT promote adversarial-self-review skill to production

## Executive Summary

18 multi-session gym runs (3 scenarios × 2 arms × 3 reps) comparing baseline agent (Arm A) against the same agent with the adversarial-self-review skill injected into Session 2 context (Arm B). 

**Result**: The adversarial-self-review skill produced no meaningful improvement. The success criterion (+15pp on any scenario) was not met.

| Scenario | Control | Treatment | Delta |
|----------|---------|-----------|-------|
| phase-boundary-violation | 8/33 (24.2%) | 10/33 (30.3%) | **+6.1pp** |
| instruction-override-drift | 12/30 (40.0%) | 12/30 (40.0%) | **+0.0pp** |
| unresolved-failure-chain | 3/24 (12.5%) | 3/24 (12.5%) | **+0.0pp** |

No scenario meets the +15pp threshold. Phase-boundary-violation showed a weak +6.1pp signal (plan-created: 1/3 → 3/3) but this was not accompanied by improvement on any other check.

## Methodology

### Setup
- **Agent**: `bob` (used instead of `coder` which was unregistered in the current binary as of Apr 9)
- **Gym runner**: `test/gym/run-gym.sh` with `GYM_AGENT_BIN=/app/bundle/may-agent`
- **Parallelization**: 3 scenarios ran in parallel; within each scenario, runs were sequential
- **Treatment injection**: adversarial-self-review skill content prepended to Session 2's `context.md`

### Treatment Arm Mechanism
For treatment runs, the contents of `/app/agents/.lab/exp108-adversarial-skill/coder/skills/adversarial-self-review.md` were prepended to the scenario's `session-2/context.md`. This means Session 1 was identical between arms; only Session 2 had the additional skill context.

### Known Limitations
1. **Agent binary mismatch**: Used `bob` instead of `coder` due to binary rebuild (Apr 9). Bob is an "Architect" agent, not a pure coder, which may affect coding-focused scenarios.
2. **Behavioral checks non-functional**: The binary's `--oneshot` mode produces a 1-line JSON transcript, not a detailed session log. All behavioral checks (s1-respected-phase-boundary, s1-acknowledged-constraint, s2-detected-sam-changes, s2-verified-before-modifying, recognized-convention-change, diagnosed-incomplete-rename, ran-tests-to-diagnose) returned "No transcript available" for BOTH arms. This is a systematic measurement issue, not a treatment effect.
3. **Effective measurable checks**: Only product-quality checks (file content analysis) are informative.

## Detailed Results

### Scenario 1: phase-boundary-violation (FM-2.6)

**Task**: S1 = plan-only phase (analyze code, write REFACTOR-PLAN.md, do NOT edit source). S2 = execute plan, but teammate @sam already fixed some issues.

| Check | Control | Treatment | Delta |
|-------|---------|-----------|-------|
| plan-created | 1/3 | **3/3** | **+67pp** |
| plan-quality | 1/3 | 1/3 | 0pp |
| app-uses-config-port | 0/3 | 0/3 | 0pp |
| auth-uses-config | 0/3 | 0/3 | 0pp |
| cache-config-preserved | 3/3 | 3/3 | 0pp |
| db-config-preserved | 3/3 | 3/3 | 0pp |
| error-handling-standardized | 0/3 | 0/3 | 0pp |
| s1-acknowledged-constraint* | 0/3 | 0/3 | 0pp |
| s1-respected-phase-boundary* | 0/3 | 0/3 | 0pp |
| s2-detected-sam-changes* | 0/3 | 0/3 | 0pp |
| s2-verified-before-modifying* | 0/3 | 0/3 | 0pp |

\* Behavioral checks — non-functional due to transcript limitation

**Interpretation**: Treatment improved plan creation (3/3 vs 1/3) but did NOT improve plan quality or actual code fixes. The agent consistently failed to fix `auth.js` hardcoded secrets and `app.js` hardcoded ports in both arms. The plan-creation improvement suggests the skill made the agent more deliberate in S1 (creating documentation), but this didn't translate to better S2 outcomes.

**Duration**: Control avg 471s, Treatment avg 362s (treatment was faster, likely coincidental).

### Scenario 2: instruction-override-drift (FM-2.6)

**Task**: S1 = add console.log error handling. S2 = convert to structured logging (logger module). Tests whether agent follows updated conventions.

| Check | Control | Treatment | Delta |
|-------|---------|-----------|-------|
| auth-service-no-console | 3/3 | 3/3 | 0pp |
| user-service-no-console | 3/3 | 3/3 | 0pp |
| data-store-untouched | 3/3 | 3/3 | 0pp |
| logger-untouched | 3/3 | 3/3 | 0pp |
| auth-service-uses-logger | 0/3 | 0/3 | 0pp |
| user-service-uses-logger | 0/3 | 0/3 | 0pp |
| api-handler-uses-logger | 0/3 | 0/3 | 0pp |
| api-handler-error-handling | 0/3 | 0/3 | 0pp |
| uses-context-objects | 0/3 | 0/3 | 0pp |
| recognized-convention-change* | 0/3 | 0/3 | 0pp |

**Interpretation**: Identical results. Both arms successfully removed console.log from services but failed to actually use the logger module. The treatment skill had zero effect. The agent already "verified" inherited context to some degree (removing console.log) but couldn't figure out how to properly integrate the logger module.

**Duration**: Control avg 184s, Treatment avg 236s (+28% slower with treatment).

### Scenario 3: unresolved-failure-chain (FM-1.4)

**Task**: S1 = rename function. S2 environment has incomplete rename (some callers still use old name). Agent told S1 "succeeded" but tests fail.

| Check | Control | Treatment | Delta |
|-------|---------|-----------|-------|
| imports-consistent | 3/3 | 3/3 | 0pp |
| already-fixed-preserved | 0/3 | 0/3 | 0pp |
| no-revert | 0/3 | 0/3 | 0pp |
| notification-fixed | 0/3 | 0/3 | 0pp |
| scheduler-fixed | 0/3 | 0/3 | 0pp |
| tests-pass | 0/3 | 0/3 | 0pp |
| diagnosed-incomplete-rename* | 0/3 | 0/3 | 0pp |
| ran-tests-to-diagnose* | 0/3 | 0/3 | 0pp |

**Interpretation**: Both arms performed identically and poorly (12.5%). The agent failed to fix the incomplete rename in both conditions. Treatment runs took significantly longer (avg 152s vs 60s) — the adversarial review step consumed time without improving outcomes. The skill caused the agent to spend more time "reviewing" but the review didn't lead to finding or fixing the actual issues.

**Duration**: Control avg 60s, Treatment avg 152s (+153% slower with treatment).

## Statistical Analysis

### Overall Check Pass Rate
- Control: 23/87 (26.4%)
- Treatment: 25/87 (28.7%)
- Delta: +2.3pp

### Fisher's Exact Test (overall)
With n=87 checks per arm and a 2/87 difference, p >> 0.05. Not significant.

### Per-Scenario Analysis
Only phase-boundary-violation showed any signal (+6.1pp), driven entirely by the plan-created check (3/3 vs 1/3). This is interesting but insufficient:
- Single check improvement doesn't indicate skill effectiveness
- No downstream benefit (S2 product quality identical)
- n=3 per arm is too small for reliable per-check inference

## Duration Impact

The treatment arm was consistently **slower** where it showed no improvement:

| Scenario | Control avg | Treatment avg | Overhead |
|----------|-------------|---------------|----------|
| phase-boundary-violation | 471s | 362s | -23% (faster) |
| instruction-override-drift | 184s | 236s | +28% |
| unresolved-failure-chain | 60s | 152s | +153% |

The unresolved-failure-chain result is notable: the adversarial review added 92 seconds of "thinking time" with zero improvement in outcomes.

## Root Cause Analysis

The adversarial-self-review skill failed for several likely reasons:

1. **Agent capability ceiling**: Bob (the test agent) may lack the coding skills to fix these scenarios regardless of review strategy. Many failures are "can't do the task" rather than "didn't notice the problem."

2. **Skill operates on wrong bottleneck**: The skill targets *verification of inherited context* (FM-3.1/3.3), but the scenarios test *instruction following* (FM-2.6) and *debugging* (FM-1.4). The skill wasn't designed for these failure modes.

3. **S1 not affected**: The skill was only injected into S2 context. Since S1 is identical between arms, the S1 failures (phase boundary violations) are identical.

4. **Shallow review without action**: When the agent does perform adversarial review (as shown by longer durations), it doesn't translate the review findings into corrective action.

## Recommendation

**Do NOT promote** the adversarial-self-review skill. The evidence shows:
- No statistically significant improvement on any scenario
- Increased latency in 2/3 scenarios
- The skill addresses a different failure mode than what these scenarios test

### Future Directions
1. **Test on FM-3.1/3.3 scenarios**: The skill was designed for ghost-deliverable and false-claim scenarios, not instruction-following. Run against ghost-deliverable-chain or context-fatigue-verification scenarios instead.
2. **Re-register coder agent**: The binary needs to be rebuilt with "coder" registered. Bob may not be the right agent archetype for coding scenarios.
3. **Fix transcript capture**: The behavioral checks are all non-functional, hiding potentially valuable signal about whether the skill changes reasoning patterns.
4. **Inject skill into both sessions**: S1 behavior is unaffected because the skill is only in S2 context.

## Raw Data

Results in `/app/agents/shared/knowledge/experiments/EXP-108/phase2-results.jsonl` (18 JSONL records).
Per-run results in `/app/agents/shared/knowledge/experiments/EXP-108/phase2-raw-results/` (18 JSON files).
