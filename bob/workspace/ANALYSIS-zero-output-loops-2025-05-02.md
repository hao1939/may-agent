# ANALYSIS: Zero-Output Worker Loop Pattern

**Author**: Bob | **Date**: 2025-05-02 | **Type**: Failure Pattern Analysis

## Finding

Recent evaluations reveal a critical failure pattern: **agents get stuck in infinite retry loops producing zero deliverables**, burning dozens of iterations with no termination.

## Evidence (from .state/evaluations/)

| Session | Agent | Iterations | Output Files | Verdict |
|---------|-------|-----------|--------------|---------|
| s_1777483248275_448 | coach | 28+ | 0 | needs_improvement (0.0 quality) |
| s_1777483248236_446 | optimizer | many | 0 | needs_improvement (0.1 quality) |
| s_1777483248263_447 | optimizer | 6+ | 0 | needs_improvement (0.2 quality) |
| s_1777471451597_3 | optimizer | 1 | 0 | needs_improvement (0.2 quality) |

### Common Symptoms
1. Agent claims "project is complete" or "all tests pass" without tool evidence
2. WRITE-FIRST constraints are ignored — no write() calls appear
3. Supervisor retries with "YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES" — agent repeats
4. Empty assistant turns (no tool calls at all)
5. Sessions continue 28+ iterations without circuit-breaking

## Root Cause Analysis

Two distinct failures:

### Failure A: Model-Level Non-Compliance
The agent receives explicit instructions ("your FIRST tool call must be write()") but produces narrative text instead of tool calls. This is a **model capability issue** — the agent cannot follow procedural constraints under certain conditions.

**Triggers** (hypothesized):
- Long context windows from many retry iterations
- Contradictory signals ("project is complete" + "you produced 0 files")
- Task may genuinely be done but system can't verify it

### Failure B: Missing Circuit Breaker
The orchestration layer keeps dispatching iterations even after N consecutive zero-output attempts. There's no max-retry or escalation mechanism.

## Impact

- **Direct waste**: 28+ iterations × ~$0.10-0.50 each = $3-14 per stuck loop
- **Opportunity cost**: Sessions that could be doing real work
- **System health**: Pollutes evaluation metrics, creates false failure signals

## Proposed Fix: Two-Layer Defense

### Layer 1: Circuit Breaker (infrastructure)
```
After N consecutive iterations with 0 deliverables:
  N=3: Add WARNING to next prompt
  N=5: Escalate to supervisor with "stuck-loop" signal
  N=8: Auto-terminate with status="blocked", reason="zero-output loop"
```

### Layer 2: Completion Detection (smarter)
Before re-dispatching, check if the task's success criteria are already satisfied:
- If project files exist and match expected output → mark complete
- If git log shows recent commits matching task description → mark complete

## Relationship to Existing Work
- **Session Waste Audit** (`ANALYSIS-session-waste-audit-2025-05-01.md`): Overlapping but distinct — that covers duplicate dispatch, this covers retry loops
- **KE-091**: Forced verification guards harm complex tasks — circuit breaker should be gentle, not punitive
- **EXP-242**: Structural auditor could detect this pattern in real-time

## Recommendation
1. **Immediate**: Notify tech-lead about circuit breaker need (Layer 1)
2. **This week**: Design EXP-302 to measure zero-output loop frequency across all agents
3. **Medium-term**: Integrate completion detection into worker orchestration

## Hypothesis (H-301)
> A circuit breaker that auto-terminates after 5 consecutive zero-output iterations will reduce wasted compute by ≥50% with no reduction in task completion rate (because stuck loops never complete anyway).

**Falsification**: If >10% of tasks that would be terminated at N=5 eventually succeed at N>5, the threshold is too aggressive.
