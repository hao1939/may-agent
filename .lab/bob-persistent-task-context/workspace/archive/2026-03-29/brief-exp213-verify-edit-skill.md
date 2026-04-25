# Brief: EXP-213 — Verify-After-Edit Skill

## Problem
The coder agent scores **3/5** on `convention-verify-edit` (all 3 product checks pass, both convention checks fail):
- **C2.3: verify-after-edit** — Agent does NOT read config.json after writing it
- **C3: validation-attempt** — Agent does NOT run explicit JSON validation

This maps directly to **FM-3.3 VERIFICATION_FAILURE** in production — the #1 failure mode. The `convention-verify-edit-workflow` variant also fails at 3/5. `delegation-verify-pattern` fails at 6/7 for a related reason.

## Hypothesis
A few-shot skill file teaching the verify-after-edit pattern will shift behavior from "write and move on" to "write, read back, validate." Unlike judgment scenarios (which are model-level), verification is **procedural** — it's a concrete sequence of actions the agent can learn.

## Design
- **Treatment**: Lab fork at `agents/.lab/verify-edit-skill/` with `skills/verify-after-edit.md`
- **Control**: Baseline coder (no skill)
- **Scenario**: `convention-verify-edit` (primary), `convention-verify-edit-workflow` (secondary)
- **Metric**: Pass rate on convention checks (currently 0/2 → target ≥2/2)
- **Runs**: 5 runs per variant (treatment + control)
- **Success**: Treatment ≥4/5 on `convention-verify-edit`

## Lab Fork
- Path: `agents/.lab/verify-edit-skill/`
- Skill file: `agents/.lab/verify-edit-skill/skills/verify-after-edit.md`
- The skill teaches: (1) read-back after every write/edit, (2) run validation commands for data files (JSON.parse, etc.)

## Execution
Coach should run:
```bash
# Control (baseline)
node scripts/gym-run.sh convention-verify-edit --agent coder --runs 5

# Treatment (with skill)
node scripts/gym-run.sh convention-verify-edit --agent coder --fork agents/.lab/verify-edit-skill --runs 5
```

Then report: control pass rate vs treatment pass rate, and which specific checks improved.

## Prior Art
- EXP-210 (investigate-conflicts): skill had 0 effect but was invalidated by scenario bug
- EXP-211/212 (materialization): skills improved 6/9 → 7/9 but couldn't break ceiling. Rule of Two triggered.
- This experiment targets a PROCEDURAL behavior (verify-after-edit), not a judgment behavior. Prior experiments show skills work better for procedural tasks.
