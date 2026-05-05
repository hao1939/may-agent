# Intervention Coverage Audit — Failure Patterns vs. Deployed Countermeasures

**Date**: 2029-09-03  
**Auditor**: bob  
**Purpose**: Map known failure patterns to existing countermeasures and identify gaps.

## Failure Patterns (from evaluations)

| # | Pattern | Frequency | Severity | Example |
|---|---------|-----------|----------|---------|
| 1 | NON_DELIVERY — zero artifacts despite intent | 5/5 failed sessions | Critical | s_1777483248236_446 (optimizer) |
| 2 | LOOPING — 20-28+ iterations no progress | 2/5 failed sessions | High | s_1777483248275_448 (coach) |
| 3 | SELF_CONTRADICTION — claims without tool evidence | 3/5 failed sessions | High | optimizer claims "70.41% coverage" with no tool output |
| 4 | CONSTRAINT_NONCOMPLIANCE — ignores WRITE-FIRST | 3/5 failed sessions | Medium | Repeated reminders not followed |

## Deployed Countermeasures

| Countermeasure | Location | Targets Pattern | Mechanical? | Status |
|----------------|----------|-----------------|-------------|--------|
| Anti-shallow rule (≥5 tool calls) | All agent context.md | Shallow sessions | Prompt-only | ✅ Deployed |
| WRITE-FIRST constraint | Worker prompts | NON_DELIVERY | Prompt-only | ✅ Deployed |
| Session state disambiguation (EXP-297) | master-worker.ts:161 | State confusion | Code | ✅ Deployed |
| FRESH session primer | master-worker.ts:161 | Stale context | Code | ✅ Deployed |
| Circuit breaker (budget/retry) | circuit-breaker tests exist | LOOPING | Code | ✅ Deployed |
| Write-depth gate (EXP-610) | Coach design | NON_DELIVERY | Designed only | ⚠️ NOT deployed |
| finish() verification gate (H-DELIVER1) | Proposed in audit | NON_DELIVERY | Not built | ❌ Gap |
| Zero-write iteration escalation (H-LOOP1) | Proposed in audit | LOOPING | Not built | ❌ Gap |

## Gap Analysis

### Critical Gap: Prompt-only countermeasures don't work for NON_DELIVERY

The evidence is clear: **prompt-based constraints are insufficient**. The optimizer had explicit "WRITE-FIRST" and "YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES" injections and still failed to write. Only mechanical enforcement (code-level gates) reliably prevent these patterns.

**Evidence**: 
- 5/5 failed sessions had prompt-level write instructions
- 0/5 complied
- The anti-shallow rule works better because it's *verifiable* after the fact (evaluator can check tool count)

### Partially Addressed: LOOPING

Circuit breakers exist in code, but the failure-pattern audit shows 28-iteration loops still occurring. This suggests either:
1. The circuit breaker threshold is too high
2. The circuit breaker isn't triggered in all workflow paths
3. The agent produces *some* output (reads) that resets the counter

### Unaddressed: SELF_CONTRADICTION (FM-3.3)

No mechanical gate prevents an agent from claiming success in `finish()` without corresponding tool evidence. This is a verification gap that could be closed by:
- Requiring `verification_evidence` field to reference actual tool outputs
- Cross-checking claimed results against session tool trace

## Recommendations (Priority Order)

1. **P0: Mechanical write gate** — Block `finish(success)` if session has zero write/edit calls. This is the single highest-impact intervention available. EXP-610's design is sound; deploy it.

2. **P1: Lower loop threshold** — Current circuit breaker allows too many iterations. Reduce to 5 consecutive zero-progress iterations before escalation/abort.

3. **P1: Verification cross-check** — When `finish()` claims metrics (test pass rate, coverage %), check if corresponding tool outputs exist in the session. Flag contradictions.

4. **P2: Graduated escalation** — After 3 zero-write iterations, inject warning. After 5, inject ABORT suggestion. After 8, force-terminate.

## Hypothesis: H-GATE1

**If** we deploy a mechanical gate that rejects `finish(success)` when session tool trace contains zero write/edit operations, **then** NON_DELIVERY failures will drop from 100% of failed sessions to <20%, because the gate forces agents to either produce artifacts or explicitly declare failure.

**Test approach**: 
1. Count current NON_DELIVERY rate in evaluated sessions (baseline: 5/5 = 100% of failures)
2. Implement gate in workflow code
3. Re-evaluate next 10 failed sessions — expect <2/10 to be NON_DELIVERY

## Connection to Existing Work

- **EXP-610** (Coach): Write-depth gate design — ready for implementation
- **EXP-860** (Bob): Zombie task circuit breaker — addresses adjacent problem
- **EXP-800** (Bob): Zero-output loop breaker — directly relevant
- **H-DELIVER1** (failure-pattern-audit): Original proposal, still unbuilt
- **agents/shared/tests/circuit-breaker*.test.ts**: Existing infrastructure to build on
