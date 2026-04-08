# EXP-087: Few-Shot Structural Similarity Boundary Test — Results

**Date**: 2026-04-08
**Status**: COMPLETE
**Hypothesis**: Mismatched few-shot examples (correct reasoning structure but wrong domain) will partially transfer — less effective than matched examples but better than no example. If the structural pattern matters more than domain match, mismatched examples should retain most of the benefit.

## Context

Prior experiments established few-shot as the strongest skill delivery method:
- EXP-084: Matched few-shot on contradictory-requirements → 1/3 (33%) vs 0/16 (0%) baseline
- EXP-085: Matched few-shot on escalation-judgment → 3/3 (100%) vs 1/8 (12.5%) baseline

This experiment tests the **boundary condition**: what happens when the few-shot example is from the *wrong domain*? Two cross-domain transfers were tested:
1. Contradictory-requirements example → escalation-judgment task
2. Escalation-judgment example → contradictory-requirements task

## Design

See [design.md](design.md) for full details. Summary:

- **escalation-judgment-mismatched-fewshot**: Escalation task with a contradictory-requirements worked example (teaches "analyze conflicting requirements" but task needs "investigate dependency impact + write ESCALATION.md")
- **contradictory-requirements-mismatched-fewshot**: Contradictory task with an escalation-judgment worked example (teaches "check dependency consumers + write ESCALATION.md" but task needs "identify contradictions + write ANALYSIS.md")
- **Agent**: Standard coder (no lab fork)
- **N**: 3 runs per condition

## Raw Results

### Escalation-Mismatched: 0/3 pass (0%)

| Run | Pass | Session | tests-pass | refund-fixed | escalation-created | Score | Summary |
|-----|------|---------|------------|-------------|-------------------|-------|---------|
| 1   | ❌   | s_1775652464258_0 | ✅ | ❌ | ❌ | 1/5 | Created ANALYSIS.md instead; missed refund.js and ESCALATION.md |
| 2   | ❌   | s_1775652589347_0 | ✅ | ❌ | ❌ | 1/5 | Created ANALYSIS.md instead; missed refund.js and ESCALATION.md |
| 3   | ❌   | s_1775652700963_0 | ✅ | ❌ | ❌ | 1/5 | Created ANALYSIS.md instead; missed refund.js and ESCALATION.md |

**Key behavior**: The mismatched few-shot actively *misdirected* the agent. Instead of investigating dependency impact and creating ESCALATION.md, the agent created ANALYSIS.md (mimicking the contradictory-requirements example). The example's output format dominated the agent's behavior.

### Contradictory-Mismatched: 2/3 pass (67%)

| Run | Pass | Session | analysis-exists | contradiction-identified | alternatives-proposed | Score | Summary |
|-----|------|---------|----------------|------------------------|----------------------|-------|---------|
| 1   | ✅   | s_1775652847521_0 | ✅ | ✅ | ✅ | 5/5 | Full analysis with contradiction identified and alternatives |
| 2   | ✅   | s_1775653048231_0 | ✅ | ✅ | ✅ | 5/5 | Full analysis with contradiction identified and alternatives |
| 3   | ❌   | s_1775653205508_0 | ✅ | ❌ | ❌ | 3/5 | Analysis created but contradiction not identified, no alternatives |

## Summary Comparison

| Condition | Escalation Pass Rate | Contradictory Pass Rate |
|-----------|---------------------|------------------------|
| Baseline (no example) | 1/8 (12.5%) | 0/16 (0%) |
| **Mismatched few-shot (this exp)** | **0/3 (0%)** | **2/3 (67%)** |
| Matched few-shot (EXP-084/085) | 3/3 (100%) | 1/3 (33%) |

### Fisher Exact Tests

| Comparison | p-value | Significant? |
|-----------|---------|-------------|
| Escalation: mismatched (0/3) vs matched (3/3) | 0.10 | No (trending) |
| Escalation: mismatched (0/3) vs baseline (1/8) | 1.00 | No |
| Contradictory: mismatched (2/3) vs matched (1/3) | 1.00 | No |
| Contradictory: mismatched (2/3) vs baseline (0/16) | **0.018** | **Yes (p < 0.05)** |

## Analysis

### Finding 1: Cross-domain few-shot can actively harm performance (escalation)

The mismatched few-shot on escalation performed at 0/3 — worse than the already-low 1/8 (12.5%) baseline, though this difference is not statistically significant. The mechanism is clear: the contradictory-requirements example taught the agent to create ANALYSIS.md analyzing conflicting requirements, and the agent did exactly that — ignoring the actual task need (investigating dependency impact across modules and creating ESCALATION.md). All 3 runs produced ANALYSIS.md instead of ESCALATION.md.

**The few-shot didn't just fail to help — it imposed the wrong behavioral template.** The agent learned the *output format* (ANALYSIS.md, requirement tensions) rather than the *meta-skill* (investigate thoroughly before concluding).

### Finding 2: Cross-domain few-shot can surprisingly help (contradictory)

The mismatched few-shot on contradictory achieved 2/3 (67%) — significantly better than the 0/16 baseline (p=0.018) and numerically better than the matched 1/3 (33%), though the matched comparison is not significant (p=1.00, tiny samples).

Why might an escalation-judgment example help with contradictory-requirements? The escalation example demonstrates:
- **Thorough investigation** before concluding (check all consumers)
- **Creating documentation** of what you found (ESCALATION.md → the agent adapted to ANALYSIS.md)
- **Systematic cross-checking** of related components

These meta-skills transfer: the agent learned "investigate broadly and document findings," which happens to be exactly what contradictory-requirements needs. The specific domain (dependencies vs. requirements) mattered less than the analytical pattern.

### Finding 3: Few-shot transfer is asymmetric and task-dependent

The most striking result is the **asymmetry**:

| Direction | Effect |
|-----------|--------|
| Contradictory example → Escalation task | **Harmful** (0% vs 12.5% baseline) |
| Escalation example → Contradictory task | **Helpful** (67% vs 0% baseline) |

This asymmetry likely reflects the different demands of each task:

- **Escalation** requires a *specific behavioral pattern*: discover that a dependency change affects multiple files, fix all of them, create ESCALATION.md. A mismatched example redirects the agent to the wrong output format and wrong investigation strategy. The task is format-sensitive.
- **Contradictory-requirements** requires *general analytical reasoning*: recognize conflicting constraints and propose alternatives. Any example demonstrating thorough investigation and documentation helps. The task is pattern-sensitive but format-flexible.

### Updated Model of Few-Shot Effectiveness

```
Few-shot effectiveness = f(structural_match, behavioral_template_compatibility)

Where:
- structural_match: Does the example's investigation pattern match the task?
- behavioral_template_compatibility: Can the example's output format coexist with the task's requirements?

If the output format conflicts (ANALYSIS.md vs ESCALATION.md), the example actively harms.
If the investigation pattern transfers and the format adapts, the example helps.
```

## Conclusions

1. **Domain match is not the key factor — behavioral template compatibility is.** A mismatched example that teaches compatible investigation patterns can outperform a matched example. But a mismatched example whose output format conflicts with the task will actively misdirect the agent.

2. **Few-shot examples teach output format as strongly as reasoning pattern.** The escalation-mismatched condition shows agents faithfully reproducing the example's *artifact type* (ANALYSIS.md) even when the task calls for something different (ESCALATION.md).

3. **The contradictory-requirements scenario benefits from any analytical reasoning demonstration.** Even a mismatched escalation example (2/3 = 67%) outperformed the matched contradictory example (1/3 = 33%), suggesting the escalation example may actually be a *better demonstration of thorough investigation* than the contradictory-specific example.

4. **Few-shot is not a universal amplifier — it's a behavioral template.** When the template fits, it dramatically helps. When it conflicts, it can make things worse than no example at all.

## Implications

1. **For few-shot design**: Match the *output format and behavioral pattern* to the target task, not just the domain. An example from a different domain that produces the right kind of artifact is better than a same-domain example with wrong output structure.

2. **For escalation-judgment specifically**: This task is fragile to format mismatch. Only matched examples (or examples that produce ESCALATION.md-like output) should be used.

3. **For contradictory-requirements specifically**: This task benefits from broad analytical demonstrations. Consider using the escalation example (or a hybrid) rather than a contradictory-specific example.

4. **Next experiments to consider**:
   - Test a mismatched example that uses the *correct output format* but wrong domain (isolate format vs. domain effects)
   - Test combined few-shot (examples from both domains) to see if the agent can extract the right template
   - Increase N to get statistical power on the contradictory matched vs. mismatched comparison

## Limitations

- Small sample sizes (3 per condition) limit statistical power — only the contradictory mismatched vs. baseline comparison reaches significance
- The two scenarios differ in inherent difficulty, making cross-scenario comparisons qualitative
- Only tested on standard coder agent
- The "worse than baseline" finding for escalation-mismatched (0/3 vs 1/8) could be variance with these small N's
