# KE-179: Hard Gate Generalization — Ch2 Works Across 4+ Scenario Types

**Source**: EXP-156, EXP-155, EXP-127
**Date**: 2026-04-14
**Confidence**: HIGH (4 scenarios, N=40+)

## Finding

Ch2 hard externalization gates (mandatory artifact + existence check) generalize beyond their original scenarios. Tested across 4 distinct failure types:

| Scenario | Failure Type | Baseline | Hard Gate | Δ |
|----------|-------------|----------|-----------|---|
| contradictory-requirements | Judgment: misses contradiction | 0% | 100% | +100pp |
| hidden-dep | Process: skips investigation | 15% | 100% | +85pp |
| misleading-test-fix | Diagnosis: doesn't verify math | 0% | 100% | +100pp |
| ambiguous-context-drift | Verification: trusts false context | 67% | 80% | +13pp |

## Key Pattern

**Effectiveness correlates inversely with baseline**: Low baselines (<20%) see massive improvement (85-100pp) because agents almost never spontaneously perform the required analysis. High baselines (>60%) see marginal improvement because agents already do it naturally.

## When to Use Hard Gates

**High impact** (expect ≥50pp improvement):
- Baseline < 20%
- Failure mode is "action without analysis" — agent would succeed if it thought first
- Task has natural 2-phase structure (analyze → act)

**Low impact** (expect <20pp):
- Baseline > 60% — agents already perform the analysis naturally
- Failure mode is belief-based (trusting context) rather than process-based (skipping a step)
- Gate forces a step the agent usually does anyway

## Mechanism

The gate works by making the analysis step *mandatory and externalized*. Three components:
1. **Mandatory artifact**: "Write X.md" — forces the analysis to happen
2. **Existence check**: Scorer verifies the artifact exists — can't skip it
3. **Phase boundary**: "If X.md doesn't exist, STOP" — prevents jumping to action

The key insight is that the artifact creation forces *genuine thinking*. When agents must write down their analysis before acting, they reliably discover the correct answer. Without the gate, they jump to action using heuristics that fail on tricky tasks.

## Limitations

- Only tested on coder agent with current model
- Soft gates (no existence check) may capture most of the effect for high-baseline scenarios
- Adding 2 process checks to scorer increases the "passing bar" — part of the baseline drop on misleading-test-fix may be measurement artifact from the 0% vs historical 63%
- N=10 per arm gives limited power for small effects (the ambiguous-context-drift result needs N=20+ to confirm)

## Tags
`ch2`, `hard-gate`, `externalization`, `generalization`, `intervention-design`
