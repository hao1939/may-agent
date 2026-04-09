# EXP-108 Phase 2 Protocol: A/B Gym Runs

## Summary
Run 18 multi-session gym runs comparing baseline (Arm A) vs adversarial-self-review skill (Arm B).

## Arms
- **Arm A (Control)**: `--agent coder` (no lab fork — standard coder skills)
- **Arm B (Treatment)**: `--agent coder --lab exp108-adversarial-skill` (adds adversarial-self-review.md skill)

## Scenarios (3)
1. `multi-session/phase-boundary-violation` — FM-2.6, no prior baseline (predict ~30-50%)
2. `multi-session/instruction-override-drift` — FM-2.6, baseline 40%
3. `multi-session/unresolved-failure-chain` — FM-1.4, baseline 44% (high variance)

## Runs per Cell
3 runs per (scenario × arm) = 3 × 2 × 3 = **18 runs total**

## Commands

```bash
# Arm A (Control) — no --lab flag
for scenario in multi-session/phase-boundary-violation multi-session/instruction-override-drift multi-session/unresolved-failure-chain; do
  for rep in 1 2 3; do
    bash test/gym/run-gym.sh "$scenario" --agent coder --keep 2>&1
  done
done

# Arm B (Treatment) — with --lab flag
for scenario in multi-session/phase-boundary-violation multi-session/instruction-override-drift multi-session/unresolved-failure-chain; do
  for rep in 1 2 3; do
    bash test/gym/run-gym.sh "$scenario" --agent coder --lab exp108-adversarial-skill --keep 2>&1
  done
done
```

## Success Criteria (from design.md)
1. **Primary**: At least 2 of 3 scenarios show Arm B pass rate ≥ Arm A + 15pp
2. **Secondary**: Behavioral checks (diagnosed-*, detected-*) improve in Arm B
3. **Guard rail**: No scenario where Arm B is ≥ 10pp WORSE than Arm A (alignment tax)

## Analysis Protocol
For each scenario:
- Record per-check pass/fail for each run
- Compute pass rate per arm (out of 3)
- Note behavioral vs product check improvement separately
- Flag any alignment tax (Arm B worse)

## Notes
- `--keep` flag preserves work directories for post-mortem analysis
- Results append to `agents/gym/results.jsonl`
- phase-boundary-violation has no prior baseline — Arm A establishes it
- unresolved-failure-chain has high variance (75% vs 13% in baselines) — 3 reps may not be enough
