# EXP-655: Threat-Framed Impact Scanning Skill — Design

## Date: 2029-07-28
## Status: DESIGNED — Ready for gym baseline

## Problem Statement

Impact-radius-check skill shows +100pp in gym (EXP-445, EXP-570) but only 6% production scanning rate (EXP-645). The structural gate (EXP-650) is blocked on binary rebuild. Meanwhile, EXP-560/565 proved that **threat framing** (+100pp) can make text interventions work where plain text fails — by elevating behavior priority above task completion.

## Key Insight

KE-480 says text coaching is dead. But KE-480 has a nuance (discovered in EXP-560): **text THREAT framing works for priority-gap behaviors**. Impact scanning fails not because agents don't know how (they do it perfectly in gym) but because they deprioritize it under task pressure. Threat framing may fix this.

## Hypothesis

**H1**: Threat-framed impact scanning instruction ("Your session will be REJECTED if you edit ≥2 files without grep'ing for consumers") → scanning rate rises from baseline ≤33% to ≥67% on cross-file-impact scenarios.

## Experimental Design

### Scenario
Use existing `cross-file-impact-config-change` scenario (from EXP-570).
- Already proven goldilocks: baseline 0/3 comprehensive, treatment 3/3 with skill.
- Has `checked-consumers` and `comprehensive-fix` checks.

### Arms
1. **Baseline (no skill)**: Run scenario with no impact-radius-check skill. Expect 0-33% comprehensive.
2. **Treatment A (plain skill)**: Impact-radius-check skill as-is (replication of EXP-570 finding).
3. **Treatment B (threat-framed)**: Threat-framed version:

```markdown
## MANDATORY: Impact Scanning Gate (Session REJECTED if violated)

After editing ANY file, you MUST grep/rg for all functions, classes, or exports you modified
to find consumers/callers. If you edit ≥2 files without running at least one grep for consumers,
your session is REJECTED and work is discarded.

This is non-negotiable. Missing downstream breakage = session failure.
```

### Key Question
Does threat framing close the gap between "skill loaded" (+100pp in gym) and "skill loaded in production" (6%)? If Treatment B ≈ Treatment A in gym, threat framing adds nothing gym-side. But if we can show it works in a **harder** scenario variant (one with time pressure or competing tasks), it predicts production transfer.

### Harder Variant (Phase 2)
Create a variant of cross-file-impact-config-change with:
- Additional distractor task ("also fix the typo in README")
- Time pressure framing ("complete quickly")
- Multiple files to check (not just one consumer)

This simulates production conditions where scanning gets deprioritized.

## Success Criteria
- Phase 1: Treatment B ≥ Treatment A on existing scenario (threat ≥ plain skill)
- Phase 2: On harder variant, Treatment B > Baseline by ≥+33pp

## Method
- 3 trials per arm
- Check: `checked-consumers`, `comprehensive-fix`
- Passing = both checks pass

## Relationship to Other Experiments
- **EXP-445/570**: Proved skill works in gym (+100pp)
- **EXP-645**: Proved skill fails in production (6%)
- **EXP-560/565**: Proved threat framing works for priority-gap behaviors (+100pp)
- **EXP-650**: Structural gate (blocked on rebuild)
- **KE-480**: Text dead, BUT threat framing is the exception

## Expected Outcome
Phase 1 likely shows ceiling (both Treatment A and B at 100%) since the gym scenario is already "skill-friendly." Phase 2 (harder variant with distraction) is the real test — if threat framing maintains effect under distraction, it predicts production viability and can be deployed immediately (no binary rebuild needed).

## Deployment Path (if positive)
Add threat-framed impact scanning to:
- `agents/bob/context.md`
- `agents/coder/context.md`
- Worker injection in master-worker.ts (when rebuild happens)

Unlike EXP-650's structural gate, this can be deployed TODAY as a context.md addition.
