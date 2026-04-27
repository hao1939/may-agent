# EXP-244: Defensibility-Based Evaluation (H-080)

**Date**: 2026-11-15
**Status**: DESIGNED
**Author**: Bob
**Hypothesis**: H-080 — Switching from agreement-based to defensibility-based evaluation reclassifies 30-50% of current "failures" as valid alternative paths.
**Source**: DD#883 (arXiv:2604.20972 — Escaping the Agreement Trap)

## Research Question

When our evaluator scores agent sessions as failures, how many of those "failures" are actually defensible decisions — logically derivable from the agent's governing rules (SOUL.md, context.md, skills)?

## Why This Matters

If 30-50% of failures are false negatives, our metrics undercount agent capability. Worse, lessons extracted from these sessions teach agents to stop doing valid things. This poisons the learning loop.

## Design

### Phase 1: Manual Audit (no gym needed, ~2h work)

1. **Sample**: Pull 20 recent evaluator sessions scored ≤0.3 (clear "failures")
2. **For each session**: Extract the agent's key decisions that caused the low score
3. **Defensibility check**: For each decision, determine:
   - Is it logically derivable from the agent's SOUL.md + context.md + active skills?
   - Is there an alternative interpretation of the task that makes this decision valid?
   - Did the evaluator penalize a valid alternative path or a genuine error?
4. **Classify**: Each failure as:
   - **TRUE FAILURE**: Decision violates governing rules or produces wrong output
   - **DEFENSIBLE**: Decision follows a valid interpretation of governing rules
   - **AMBIGUOUS**: Rules are genuinely unclear; multiple interpretations exist

### Phase 2: Prototype Defensibility Scorer (if Phase 1 shows ≥25% defensible)

Build a simple defensibility checker:
- Input: session transcript + agent's governing docs (SOUL, context, skills)
- Process: For each key decision, LLM judges whether it's derivable from governing rules
- Output: Defensibility Index (0-1) per session
- Compare DI with evaluator's quality score — low correlation = the metrics disagree

### Phase 3: A/B Evaluator Test (if Phase 2 validates)

Run evaluator on 50 sessions in two modes:
- **Control**: Current agreement-based scoring
- **Treatment**: Defensibility-augmented scoring (add DI signal to eval prompt)
- Measure: Score distribution shift, inter-rater agreement with human judgment

## Success Criteria

- **Phase 1**: ≥25% of sampled failures are DEFENSIBLE (supports H-080)
- **Phase 2**: DI × quality-score correlation <0.5 (metrics capture different things)
- **Phase 3**: Treatment arm agrees with human judgment more often than control

## Cost

- Phase 1: Free (manual audit of existing data)
- Phase 2: ~$1 (20 LLM defensibility checks)
- Phase 3: ~$5 (50 evaluator runs × 2 arms)

## Connection to Architecture

- **DD#883**: Direct application of Defensibility Index concept
- **DD#877 (SWARM)**: Complementary — soft-label governance for safety; defensibility for correctness
- **KE-403**: Constraint-style evaluation may trigger its own form of instruction collapse in the evaluator
- **H-EXP-017**: Defensibility signals could replace agreement-based failure classification
- **EXP-191 (evaluator anonymization)**: Both aim to improve evaluator signal quality

## Dependencies

- Access to recent evaluator output (session scores + transcripts)
- Phase 1 can start immediately — no infrastructure needed
