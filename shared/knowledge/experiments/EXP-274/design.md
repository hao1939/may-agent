# EXP-274: Workflow-Level Verification Gate

**Date**: 2026-05-01
**Status**: DESIGNED
**Predecessor**: EXP-280 (verify-after-edit measurement), EXP-282 (read-before-edit structural)
**Hypothesis**: H-274

---

## Research Question

Does injecting a mandatory verification step at the workflow layer (before finish() is allowed) reduce VERIFICATION_FAILURE rates more than text-based context rules?

## Problem Statement

50% of evaluated sessions (9/18) have [VERIFICATION_FAILURE][FM-3.3] flags. Multiple text-based interventions exist:
- `verify-after-edit.md` skill in bob, optimizer contexts
- `verify-before-finish.md` skill
- Post-fix review guard (EXP-263)

Despite these, agents still skip verification. Text rules have a known ceiling (KE-002: 0/57 for judgment fixes). But this is a **process rule** not a judgment call — agents aren't choosing to skip, they're forgetting.

## Hypothesis

- **H-274a**: A workflow-layer gate that BLOCKS finish() unless the last 3 tool calls include a read/grep/ls call will reduce VERIFICATION_FAILURE from 50% to ≤20% of sessions.
- **H-274-null**: Agents will work around the gate (e.g., adding a trivial `ls` call that doesn't actually verify) and the rate stays ≥40%.

## Key Insight

Text rules fail when they rely on the agent **remembering** mid-session. But process-level rules (88-100% compliance per KE-002) work because they're structural. The verification gate should be structural:
- NOT: "remember to verify" (text rule → ignored under cognitive load)
- YES: "finish() is blocked until verification detected" (structural → enforced)

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | Current state (text rules only) | 18 | Existing evaluation corpus |
| B   | Workflow gate: finish() requires read/grep in last 3 calls | 10 | Gym trials |

### Scenario

- Primary: `verification` gym scenario (existing)
- Secondary: Production measurement over 2-week window post-deploy

### Metrics

- Primary: VERIFICATION_FAILURE rate (% of sessions flagged)
- Secondary: False-block rate (legitimate sessions incorrectly blocked)
- Tertiary: Session length increase (cost of verification overhead)

### Decision Rule

- **Confirmed** if: VERIFICATION_FAILURE drops to ≤20% AND false-block rate ≤10%
- **Falsified** if: Rate stays ≥40% OR false-block rate >25%
- **Partial**: Rate drops to 20-40% — confirms direction, needs refinement

## Implementation Options

### Option A: Pre-finish() Hook in Workflow Layer
Add to the agent harness: before `finish(status='success')` is processed, scan the session's last 3 tool calls. If none are `read()`, `grep`, `bash(cat/ls/test)` → inject a warning message and BLOCK the finish.

### Option B: Evaluator-Triggered Retry
If evaluator detects VERIFICATION_FAILURE, auto-trigger a "verification pass" continuation. More expensive but catches edge cases.

### Recommended: Option A (structural, zero-cost when compliant)

## Execution

```bash
# Phase 1: Confirm baseline (already have 9/18 = 50%)
# Phase 2: Implement gate in workflow layer
# Phase 3: Run gym trials
# scripts/gym-run.sh verification --agent optimizer --tag EXP-274-arm-b
```

## Risk

- Gate may be too strict for sessions that legitimately don't need file verification (e.g., pure research/planning)
- Mitigation: Only gate `finish(status='success')` when deliverables include file paths
