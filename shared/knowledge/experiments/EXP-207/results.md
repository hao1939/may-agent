# EXP-207 Phase 1 Results: FM-3.3 Verification Gravity Well Baseline

**Date**: 2027-11-18
**Status**: PHASE 1 COMPLETE
**Author**: bob

## Summary

Sampled 100 recent evaluated sessions (non-skipped, with issues flagged). FM-3.3 verification failures affect **25% of sessions**. Finish-blocked events occur in **38%** of sessions. The quality distribution is **bimodal**: agents either recover from verification failure (quality ≥0.7) or fall into a gravity well (quality <0.6).

## Data

### FM-3.3 Baseline (N=100 sessions with flagged issues)

| Metric | Count | Rate |
|--------|-------|------|
| FM-3.3 explicit violations | 25 | 25.0% |
| VERIFICATION_FAILURE | 10 | 10.0% |
| Either FM-3.3 or VERIFY_FAIL (unique sessions) | 29 | 29.0% |
| finish() blocked/retry | 38 | 38.0% |

### Agent Breakdown (N=30 most recent)

| Agent | Sessions | FM-3.3 | Looping |
|-------|----------|--------|---------|
| bob | 9 | 3 (33%) | 2 |
| tech-lead | 5 | 1 (20%) | 0 |
| coach | 5 | 1 (20%) | 1 |
| optimizer | 3 | 1 (33%) | 0 |
| amy | 3 | 0 (0%) | 0 |
| qa | 2 | 1 (50%) | 0 |
| scout | 2 | 1 (50%) | 0 |
| amy-kimi | 1 | 1 (100%) | 0 |

### Recovery After Finish-Blocked (N=30)

| Outcome | Count | Rate |
|---------|-------|------|
| Recovered (quality ≥ 0.7) | 14 | 47% |
| Failed to recover (quality < 0.6) | 16 | 53% |

Quality distribution is bimodal: cluster at 0.8-0.9 (recovered) and 0.1-0.6 (gravity well).

## Analysis

### Key Findings

1. **FM-3.3 rate is 25-29%** — roughly 1 in 4 sessions with issues involve verification failures. This aligns with EXP-099's 20.3% estimate (within sampling noise given different methodology).

2. **Finish-blocked is the primary trigger** — 38% of sessions hit the finish guard, which is actually HIGHER than the FM-3.3 rate. The finish guard catches some issues before they become full FM-3.3 violations, but the guard itself creates a decision point where agents either recover or spiral.

3. **Bimodal recovery pattern** — When finish is blocked, agents either:
   - **Recover quickly** (47%): Read the error, do one verification step, succeed. Quality ≥0.7.
   - **Enter gravity well** (53%): Retry finish with the same bad evidence, loop, waste calls, quality <0.6.

4. **No agent abstains or escalates** — Zero instances of an agent saying "I can't verify this, escalating." They always retry, sometimes productively, sometimes not.

### Gravity Well Mechanism Confirmed

The H-073 mechanism is visible in the data: agents get stuck in verification loops because they lack an "exit ramp." When finish() is blocked, they don't assess whether they CAN verify — they just retry. This wastes 3-10 tool calls in the worst cases.

## Conclusion

**Phase 1 baseline established.** FM-3.3 rate is ~25% in flagged sessions. The gravity well pattern exists: 53% of agents that hit finish-blocked fail to recover. No agents abstain.

**Phase 2 should proceed**: test whether adding an explicit abstention option ("If you can't verify after 2 attempts, escalate with what you know") reduces the gravity well rate from 53% to <25% without reducing overall quality.

## Phase 2 Design (Updated)

Based on Phase 1 findings, Phase 2 intervention targets the finish-blocked decision point:

- **Control**: Standard behavior (retry verification when blocked)
- **Treatment**: Add to context: "After finish() is blocked, you have 2 attempts to verify. If both fail, call finish(status='partial', next_steps='Could not verify: [reason]') instead of retrying."
- **Metric**: Gravity well rate (quality <0.6 after finish-blocked)
- **Target**: Reduce from 53% to <25%
- **N**: 20 per arm minimum (need gym scenarios that trigger verification)

## Followups

- Design Phase 2 gym scenario or context intervention
- Check if the finish guard itself could be modified to suggest abstention after 2 retries (architecture change)
- Write KE summarizing the bimodal recovery finding
