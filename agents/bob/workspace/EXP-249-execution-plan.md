# EXP-249 Execution Plan: Capability-Structured Evaluator

**Date**: 2025-05-03
**Status**: READY TO EXECUTE
**Design**: agents/bob/workspace/designs/EXP-249-capability-structured-evaluator.md

## Why Now

- EXP-249 has been DESIGNED since 2028-07-29 with no execution
- H-207 (Capability-Decomposed Evaluation) is the top unacted hypothesis
- EXP-269 and EXP-296/297 are closed — pipeline is clear
- Evaluator is running healthy (73 evals in last 6h, 100% success rate)
- This is low-cost (~$2-3) and zero-infra-change

## Pre-Execution Checklist

- [x] Design reviewed (EXP-249 design doc is complete with prompt addendum, test protocol, success criteria)
- [ ] Find 5 recent `needs_improvement` sessions from `.state/evaluations/`
- [ ] Verify control evaluations exist for those sessions
- [ ] Run treatment evaluations with capability addendum prompt
- [ ] Compare outputs against success criteria

## Sample Selection Strategy

Query `.state/evaluations/` for recent sessions where verdict = needs_improvement.
Prefer diverse agents (not all the same agent) to test generalizability.

```bash
# Find needs_improvement evals
for f in .state/evaluations/*.json; do
  verdict=$(grep -o '"verdict":"[^"]*"' "$f" 2>/dev/null | head -1)
  agent=$(grep -o '"agent":"[^"]*"' "$f" 2>/dev/null | head -1)
  if echo "$verdict" | grep -q "needs_improvement"; then
    echo "$f $agent"
  fi
done | tail -10
```

## Execution Steps (Next Session)

1. Run sample selection query above
2. Pick 5 sessions across ≥3 different agents
3. For each: extract transcript, run evaluator with addendum prompt
4. Score against criteria: PRIMARY_FAILURE maps to coachable capability? COACHING_TARGET is specific?
5. Write results to `agents/bob/workspace/EXP-249-results.md`

## Success Criteria (from design)

- ≥4/5 sessions get a PRIMARY_FAILURE mapping to a coachable capability
- COACHING_TARGET is specific enough to select an intervention
- No regression in holistic score accuracy

## Risk

- Low: evaluator may already implicitly decompose in narratives. If so, the addendum just structures existing behavior → still useful for automation.
- Medium: 5 dimensions may be too many, causing evaluation to become verbose without adding signal.

## Decision Gate

If ≥4/5 succeed → brief tech-lead for evaluator prompt integration.
If <3/5 succeed → reduce to 3 core dimensions (tool-use, verification, planning) and re-test.
