# H-186: Discovery Skill Specificity Gradient — Abstract Skills Fail, Concrete Cues Succeed

**Created**: 2026-04-22 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong initial evidence from EXP-195)
**Source**: EXP-195 results (0% general skill vs 40% direct hint)
**Connects**: H-181, EXP-195, EXP-194, EXP-177, KE-133

---

## Claim

General reasoning skills (checklists, abstract strategies) fail to improve agent bug-finding because LLMs already possess the abstract capability. The bottleneck is **contextual triggering** — mapping from abstract skill ("check ordering") to concrete action ("swap applyPenalties and normalize"). Effective interventions must exist on a specificity gradient:

- **L1 (abstract)**: "Check component ordering" → 0% effect
- **L2 (pattern)**: "After fixing value bugs, systematically check if any pipeline steps depend on each other's output order" → untested
- **L3 (concrete cue)**: "applyPenalties and normalize may be in wrong order" → +30pp

## Mechanism

LLMs are trained on vast code — they "know" about ordering bugs abstractly. But during task execution, attention is captured by salient local features (wrong operators, failing assertions). Abstract skill instructions compete for attention but lose to concrete task signals. Only when the intervention is specific enough to redirect attention to the right code region does it work.

This connects to KE-133 (few-shot template displacement): abstract instructions get displaced by immediate task context, just as few-shot examples displace exploration.

## Evidence

### Supporting
- **EXP-195 Arm B** (file-based checklist): 0/3 — general skill ignored
- **EXP-195 Arm C** (inline skill): 0/3 — even embedded in task, no effect
- **EXP-195 Arm D** (direct hint): 4/10 (40%) — specific cue works
- **EXP-177**: 0/40 with no intervention, 1/10 with lexical hints
- **KE-133**: Few-shot examples harm discovery tasks (template displacement)

### Against / missing
- Only tested on one scenario (cascading-fix-trap-v2) — need multi-scenario evidence
- L2 (pattern-level) interventions untested — the gradient may not be smooth
- Alternative explanation: direct hints work because they're shorter/simpler, not because they're more specific

## Predictions

| ID | Condition | Predicted outcome |
|----|-----------|-------------------|
| P-186a | L2 pattern intervention on cascading-fix-trap-v2 | 10-20% pass rate (between L1 and L3) |
| P-186b | L3 concrete cue on ghost-dependency-debug | +20pp or more vs baseline |
| P-186c | L1 abstract skill on any new scenario | <5pp improvement vs baseline |
| P-186d | Specificity correlates with effect size across 3+ scenarios | r > 0.7 |

## Test Plan

- **Design**: 3-arm experiment (L1 abstract / L2 pattern / L3 concrete) across 2 scenarios
- **Scenario**: cascading-fix-trap-v2 + ghost-dependency-debug
- **N**: 10 per arm per scenario (60 total, ~$30)
- **Decision rule**: confirmed if L3 > L2 > L1 consistently across both scenarios; falsified if L1 ≈ L3 or L2 > L3

## Implications if true

1. **Stop building general skills/checklists** — they don't transfer
2. **Build scenario-specific cue libraries** instead — catalog of concrete triggering patterns
3. **Research L2 pattern interventions** — the sweet spot for transferability + effectiveness
4. **Redesign skill format**: skills should contain concrete triggering cues, not abstract procedures

## Links

- Parent: H-181 (Relational Bug Blindness)
- Related: EXP-195, EXP-177, KE-133
- Tracked in: agents/bob/workspace/todo.md
