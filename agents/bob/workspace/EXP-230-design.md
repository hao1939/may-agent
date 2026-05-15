# EXP-230: Evidence Hierarchy Skill for Reasoning-Chain Gap Failures

**Date**: 2026-08-26
**Status**: DESIGNED
**Hypothesis**: H-098 (Attention Channel Theory) — Ch1 task-message delivery
**Target**: approach-validation-trap (0% baseline, reasoning-chain gap per EXP-229 taxonomy)

## Background

EXP-229 found three types of judgment failures:
1. **Activation gaps** → second-look checklist fixes these (+100pp on silent-data-corruption)
2. **Reasoning-chain gaps** → agent needs multi-step evidence trace (approach-validation-trap)
3. **Conceptual gaps** → agent lacks domain mental model (build-activation-gap)

This experiment targets #2 with an "evidence hierarchy" skill that teaches agents to
distrust summaries and trace raw evidence.

## Skill

Located at: `agents/.lab/evidence-hierarchy-skill/skills/evidence-hierarchy.md`

Core mechanism: Forces agent to identify evidence layers (raw → summary → conclusion)
and read bottom-up. Targets the specific failure mode where agents accept a misleading
summary instead of reading session logs.

## Design

- **Scenario**: approach-validation-trap (0% on `identifies-wrong-file` check)
- **Control**: 5 runs, no skill prepended
- **Treatment**: 5 runs, evidence-hierarchy skill prepended to task.md
- **Agent**: bob via `may-agent --agent amy`
- **Timeout**: 4 minutes per run

## Decision Rule

- ≥3/5 treatment pass on `identifies-wrong-file` → POSITIVE, skill works for reasoning chains
- 1-2/5 → SUGGESTIVE, need larger N
- 0/5 → NEGATIVE, reasoning chains need a different intervention type

## Cost

~$3-5 for 10 runs.

## Predictions

Given EXP-229 taxonomy, I predict this will be SUGGESTIVE or NEGATIVE. The evidence-hierarchy
skill is still a Ch1 text instruction. EXP-229 showed checklist (also Ch1) fails on
reasoning-chain gaps. However, this skill is more targeted — it specifically addresses
the "distrust summaries" behavior, not just a generic reminder.

If this fails, next step: Ch2 environmental intervention (e.g., rename results-summary.md
to something less authoritative, or add a warning file that says "THIS SUMMARY MAY BE WRONG").
