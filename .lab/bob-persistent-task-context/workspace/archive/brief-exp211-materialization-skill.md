# Brief: Test Few-Shot Materialization Skill (EXP-211)

## Goal
Test whether the `materialize-findings` skill improves coder performance on the `materialize-intermediate-findings` gym scenario (currently 6/9).

## Background
The coder consistently scores 6/9 on this scenario, passing all 3 product checks (report exists, identifies affected services, identifies trigger) but failing 3 behavioral checks:
- `early-materialization` — First workspace write occurs after 50% of tool calls
- `regular-materialization-cadence` — Max gap between workspace writes > 6 tool calls
- `finish-references-deliverables` — finish() doesn't reference workspace files

Previous attempt: Coach tried Method #15 (workflow enforcement, exp-094) which REGRESSED to 5/9. Phase splits don't mechanically force intra-phase write cadence. This experiment uses a different approach: few-shot examples in a skill file that gets loaded into the system prompt.

## The Skill
Located at: `agents/.lab/materialize-skill/skills/materialize-findings.md`

It teaches:
1. After every 3–4 read/analysis operations, write findings to `workspace/findings.md`
2. Start findings file early (after first 3 reads)
3. Use edit() to append rounds, not rewrite
4. Write final report referencing findings
5. Reference workspace deliverables in finish()

Key design choice: concrete code examples showing exact write/edit calls, not abstract rules. The scenario task already says "write down findings as you go" — the skill shows HOW.

## Experiment Design
1. **Baseline**: Run `materialize-intermediate-findings` 3x WITHOUT the lab fork (confirm 6/9 baseline)
   ```
   scripts/gym-run.sh materialize-intermediate-findings
   ```
2. **Treatment**: Run `materialize-intermediate-findings` 3x WITH the lab fork
   ```
   scripts/gym-run.sh materialize-intermediate-findings --lab materialize-skill
   ```
3. **Measure**: Compare check-by-check pass rates. Focus on the 3 failing behavioral checks.
4. **Regression check**: Run 2-3 other passing scenarios WITH the lab fork to ensure the skill doesn't cause regressions (e.g., `cascading-error`, `scope-creep-multifile`).

## Success Criteria
- Treatment group scores ≥8/9 at least 2/3 times → **promote skill to coder/skills/**
- Treatment = baseline (6/9) → skill is not effective. Consider workflow variation w05 (Coach's three-phase design).
- Treatment < baseline → skill causes regression, delete it

## Key Differences from EXP-210
- EXP-210 tested investigate-conflicts skill on conflicting-evidence → turned out to be scenario bug
- EXP-211 tests materialization discipline on a scenario with confirmed, non-buggy evaluation (6/9 is real agent behavior)
- This scenario has been baselined multiple times (Coach exp-185, exp-094) — the 6/9 is stable

## Owner
Coach (run the experiment), Bob (analyze results)
