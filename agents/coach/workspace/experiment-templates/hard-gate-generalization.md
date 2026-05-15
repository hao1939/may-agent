# EXP-NNN: <short title> (hard-gate generalization)

**Type:** (b) hard-gate generalization
**Created:** YYYY-MM-DD
**Hypothesis:** <a hard gate that forces producing the solution artifact will lift pass rate on <task class> vs soft guidance>
**Reference:** EXP-157 (KE-180 — analysis gates HARM; KE-182 gate-design rules)

## Phase 1 — Design

- **Task class / scenarios:** <list 3–5 scenarios the gate must generalize across>
- **Gate artifact:** <e.g. `FIXED_TESTS.md` with corrected test code> — MUST be part of the solution, not a report
- **Forbidden:** analysis-style gates (write ANALYSIS.md / ROOT_CAUSE.md). See KE-180.
- **Gate check:** deterministic script checks artifact exists AND contains required shape (e.g. code block, diff, specific keys)
- **Arm A:** baseline agent + scenario
- **Arm B:** baseline agent + scenario + hard-gate instruction injected into prompt
- **Primary metric:** pass rate across all scenarios combined
- **Decision rule:** promote gate if mean delta ≥ +0.15 AND no scenario regresses by >0.10

## Phase 2 — Setup

```bash
# Gate-check script
cat > agents/coach/workspace/EXP-NNN/gate-check.sh <<'EOF'
#!/usr/bin/env bash
# Exit 0 if artifact satisfies shape, 1 otherwise
test -f "$1/<artifact>" || exit 1
grep -q '<required-pattern>' "$1/<artifact>" || exit 1
EOF
chmod +x agents/coach/workspace/EXP-NNN/gate-check.sh
```

- Apply gate prompt to fork: `agents/.lab/<agent>-<exp-id>/SOUL.md` or scenario prompt overlay

## Phase 3 — Run

```bash
scripts/gym-batch.sh --scenarios <s1>,<s2>,<s3> --agent <agent> --trials 8 \
  --out agents/coach/workspace/EXP-NNN/armA.jsonl
scripts/gym-batch.sh --scenarios <s1>,<s2>,<s3> --agent .lab/<agent>-<exp-id> --trials 8 \
  --out agents/coach/workspace/EXP-NNN/armB.jsonl
```

## Phase 4 — Analyze

- Per-scenario pass rates (A vs B) — table below
- Cross-scenario variance: does gate help uniformly or only one scenario?
- Gate compliance rate: how often did B produce the artifact in the right shape?
- Check KE-180 regression signal: did agents "complete" the gate then skip fix?

### Results
| Scenario | A pass | B pass | Δ |
|----------|--------|--------|---|
| s1       |        |        |   |
| s2       |        |        |   |
| s3       |        |        |   |
| **mean** |        |        |   |

## Phase 5 — Graduate

- [ ] Mean Δ ≥ +0.15 and no scenario regresses > 0.10 → promote gate
- [ ] If promoted: bake gate into agent's workflow file (NOT a standalone rule — KE-007)
- [ ] Record KE-NNN referencing KE-182 gate-design rules
- [ ] Log result in `experiments.jsonl`

## Constraints (KE-182)
1. Artifact is part of solution, not a report about the problem.
2. Metric is product-quality (does the fix work?), not process (did they write a file?).
3. For recognition-bottleneck tasks, gate on recognition output.
4. Do NOT gate implementation-bottleneck tasks (KE-054).
