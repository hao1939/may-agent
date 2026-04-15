# KE-186: Information Quality Trumps Process Forcing

**Date**: 2026-04-15
**Source**: EXP-165 (4-arm factorial on cascading-fix-trap-v2)
**Hypothesis**: H-161 (Dual Information-Theoretic Functions)
**Confidence**: High (F1-only 15/15 vs all other arms 0/46, p < 0.0001, N=61 total)
**Tags**: `externalization` `information-quality` `F1-memory-compression` `F2-behavioral-forcing` `expert-analysis` `process-vs-content` `cascading-fix-trap-v2`

## Finding

Providing **correct expert analysis** (F1: information quality channel) is spectacularly more effective than **forcing agents to generate their own analysis** (F2: behavioral forcing channel). On a hard architectural debugging task:

| Intervention | Pass Rate | Effect vs Baseline |
|-------------|-----------|-------------------|
| Expert ROOT_CAUSE_ANALYSIS.md provided | **100% (15/15)** | **+100pp** |
| Forced self-analysis (artifact deleted after) | 0% (0/14) | +0pp |
| Forced self-analysis + read own artifact | 0% (0/16) | +0pp |
| No intervention (baseline) | 0% (0/16) | — |

**The information matters more than the process of generating it.**

## What This Means

### For System Design
1. **Skills with correct content are extremely powerful.** A skill that provides the right diagnostic information ("a colleague investigated and found X") produces +100pp improvement. This is the strongest single intervention we've measured.

2. **Workflow gates that force self-generation are NOT a substitute for correct information.** On hard tasks where self-analysis is unreliable, forcing the analysis process provides zero benefit. The gate exists; the agent complies; the output is wrong.

3. **Self-generated analysis can be WORSE than no analysis.** The full-gate (where agents write AND read their own analysis) scores 0% — identical to baseline. But this is actually worse than F1-only (100%) because the self-generated content primes incorrect workaround paths. The agent follows its own flawed analysis instead of discovering the root cause independently.

### The Information Quality Hierarchy

```
Expert pre-analysis (correct)     → +100pp  (maximum effect)
No analysis (agent works alone)   → +0pp    (baseline)
Self-generated analysis (wrong)   → +0pp    (no better than baseline)
Self-generated + read own output  → +0pp    (potentially PRIMES wrong path)
```

The critical variable is **whether the analysis content is correct**, not whether analysis was performed.

## Why Self-Analysis Fails on Hard Tasks

On EXP-164's misleading-test-fix (a math-verifiable task), self-analysis worked perfectly (100%). On EXP-165's cascading-fix-trap-v2 (an architectural task with a CHANGELOG documentation trap), self-analysis fails completely. The difference:

| Factor | Math Task (EXP-164) | Architectural Task (EXP-165) |
|--------|---------------------|------------------------------|
| Self-verification | Agent can check: 33.97 × 0.80 = 27.176 | Agent cannot verify: CHANGELOG says reorder was "intentional" |
| Trap mechanism | Missing calculation | Misleading documentation |
| Self-analysis quality | High (math is objective) | Low (CHANGELOG deceives) |
| F2 effectiveness | 100% | 0% |

**F2 works only when the forced analysis reliably produces correct output.** When the task contains deception or requires domain expertise beyond the agent's capability, forced analysis produces incorrect output that the agent then follows.

## Reconciliation with KE-129

KE-129 found that forced externalization is the "only reliable channel" for judgment failures (0% text rules vs 100% structural gates). EXP-165 shows this needs qualification:

- **KE-129 scenario** (hidden-dependency): The forced analysis worked because writing FINDINGS.md surfaced the second bug reliably — the information was discoverable through systematic analysis.
- **EXP-165 scenario** (cascading-fix-trap): The forced analysis fails because the root cause (pipeline reordering) is hidden behind a convincing CHANGELOG entry that the agent accepts as authoritative.

**Updated principle**: Forced externalization works when the analysis process reliably surfaces correct information. It fails when the task contains deception that systematic analysis cannot overcome without external knowledge.

## Practical Implications

### When to use expert pre-analysis (F1-only)
- Hard architectural tasks with documentation traps
- Tasks where self-analysis is unreliable (misleading error messages, deceptive changelogs)
- When a correct diagnosis exists and can be provided

### When forced self-analysis (F2) suffices
- Math-verifiable tasks (agent can check its own work)
- Tasks where systematic analysis reliably surfaces the problem
- When expert diagnosis is unavailable

### When to AVOID combining F1+F2
- When the agent would generate its own analysis that might conflict with expert information
- EXP-165 shows the combination is destructive: self-generated analysis overrides/displaces correct information

## Connections

- **H-161**: Primary hypothesis — this finding MODIFIES H-161 from "dual independent functions" to "F1 confirmed, F2 task-dependent"
- **KE-129**: Forced externalization channel — needs qualification for task-type dependency
- **KE-185**: Independent sufficiency on easy task — contrasts with EXP-165's finding on hard task
- **EXP-164**: Same design, easy scenario — F2 worked there because self-analysis was reliable
- **EXP-165**: Source experiment — full methodology and raw data
- **KE-091**: Alignment tax — less relevant if F1-only (no forced production overhead) achieves full effect
- **KE-021**: Process > Knowledge skills — EXP-165 challenges this: on hard tasks, correct knowledge (F1) dramatically outperforms forced process (F2)

## Open Questions

1. **Where is the boundary?** F2 works on math tasks, fails on architectural tasks. What about medium-difficulty tasks? Is there a smooth gradient or a sharp threshold?
2. **Can F2 be improved?** If the self-analysis template were more specific ("check the CHANGELOG for recent changes and verify they are correct"), would F2 perform better?
3. **Does the destructive combination generalize?** Is it always true that self-analysis + expert analysis = worse than expert analysis alone? Or is this specific to this scenario?
4. **Expert availability**: F1 requires correct expert analysis. In production, who provides this? Could another (better) model generate the expert analysis, creating an F1 pipeline?
