# EXP-198: Relational Bug Discovery Skill — Procedural, Not Declarative

**Date**: 2026-06-22
**Status**: DESIGNED
**Predecessor**: EXP-195 (direct hint +30pp, generic skill 0%)
**Hypothesis**: H-181 (Relational Bug Blindness)

---

## Research Question

Can a **procedural discovery skill** (step-by-step method) teach agents to independently find ordering/relational bugs — bridging the gap between generic checklists (0%) and explicit hints (40%)?

## Background

EXP-195 showed:
- Generic skill ("check ordering relationships"): **0/6 (0%)**
- Direct hint ("applyPenalties and normalize may be in wrong order"): **4/10 (40%)**
- Baseline: **1/10 (10%)**

The gap tells us: agents can *fix* relational bugs when pointed at them, but can't *discover* them. A generic checklist is too abstract. A direct hint is too specific (not transferable). We need something in between: a **concrete procedure** the agent can execute mechanically without knowing which specific bug exists.

## Hypothesis

- **H-198a**: A procedural discovery skill ("after fixing all value bugs, systematically swap adjacent pipeline steps and check if tests improve") will raise cascading-fix-trap-v2 pass rate to ≥25% (from 10% baseline)
- **H-198b**: The same procedure will transfer to at least one other relational-bug scenario (ghost-dependency-debug or multi-bug-pivot) without modification
- **H-198-null**: Procedural skill performs ≤15% (within baseline noise), discovery requires scenario-specific knowledge

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A | Baseline (no intervention) | 10 | Re-use EXP-195 baseline if <30 days old |
| B | Procedural discovery skill in task.md | 10 | See skill text below |
| C | Procedural skill + worked example | 10 | Skill + a different-domain example of the procedure |

### The Procedural Discovery Skill (Arm B)

Embedded in task.md after the main task description:

```
## Bug Discovery Procedure

After you've fixed all bugs you can find by reading the code:

1. **List all sequential operations** — identify every pipeline, chain, or ordered sequence of function calls
2. **For each adjacent pair** in the sequence, ask: "Would swapping these two change the output?"
3. **If yes**, check whether the current order matches what the requirements specify
4. **Test the swap** — temporarily reverse the order and run tests. If MORE tests pass, you found a relational bug.

This procedure catches ordering bugs that are invisible to static code reading.
```

### Arm C Addition (Procedural + Worked Example)

Same as Arm B, plus a 5-line worked example from a *different domain* (e.g., "In a cooking pipeline, if `season()` runs before `cook()`, the seasoning burns off. Swapping them to `cook()` then `season()` fixes the taste test."). Tests whether a concrete analogy helps operationalize the procedure.

Note: Per KE-133, few-shot examples HARM discovery tasks. Arm C tests whether a *different-domain* analogy avoids template displacement while still helping. If C < B, this confirms KE-133 applies even to cross-domain examples.

### Scenario

- Primary: `cascading-fix-trap-v2` (10% baseline, ordering bug is pipeline step sequence)
- Transfer: `ghost-dependency-debug` or `multi-bug-pivot` (if applicable — check scenario structure first)

### Metrics

- Primary: pass rate (binary: all checks pass)
- Secondary: whether `pipeline-order-fixed` check specifically passes (even if other checks fail)
- Tertiary: number of tool calls before attempting a swap (measures procedure adoption)

### Decision Rule

- **H-198a confirmed** if: Arm B pass rate ≥ 25% AND Arm B > Arm A (p < 0.20 one-tailed Fisher's)
- **H-198a falsified** if: Arm B ≤ 15% at N=10
- **H-198b confirmed** if: Arm B procedure raises pass rate on ≥1 transfer scenario
- **KE-133 extended** if: Arm C < Arm B (worked example hurts even cross-domain)

## Cost Estimate

- 30 trials × ~$0.50 = ~$15
- Plus ~$5 for transfer scenarios = ~$20 total

## Execution

```bash
# Create scenario variant with procedural skill
# scripts/gym-run.sh cascading-fix-trap-v2-exp198-proc --agent amy --tag EXP-198-B
# scripts/gym-run.sh cascading-fix-trap-v2-exp198-example --agent amy --tag EXP-198-C
```

## Blocked On

- Gym infrastructure fix (same as EXP-190, EXP-192) — need `--lab` to actually route to skill variants
- OR: create standalone scenario variants with skill text baked into task.md (workaround)
