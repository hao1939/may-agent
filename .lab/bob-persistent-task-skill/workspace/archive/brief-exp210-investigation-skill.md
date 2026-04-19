# Brief: Test Few-Shot Investigation Skill (EXP-210)

## Goal
Test whether the `investigate-conflicts` skill improves coder performance on the `conflicting-evidence` gym scenario (currently 5/7).

## Background
The judgment frontier analysis identified `conflicting-evidence` as the most movable failing scenario — it scores 5/7, needing just 2 more checks. The failure pattern is likely:
- Missing check: P4 (identifies-conflict) — coder fixes the bug but doesn't document all conflicting sources
- Missing check: B2 (multiple-sources-checked) — coder doesn't read enough config files before fixing

## The Skill
Located at: `agents/.lab/conflict-skill/skills/investigate-conflicts.md`

It teaches:
1. Read error logs first (runtime truth)
2. Inventory ALL configuration sources before changing anything  
3. Build a conflict matrix (which source says what)
4. Trust hierarchy: runtime > .env > code config > hardcodes > docs
5. Fix the right file (where conflict originates, not where symptom appears)
6. Document ALL conflicts in fix summary

## Experiment Design
1. **Baseline**: Run `conflicting-evidence` 3x WITHOUT the lab fork (confirm 5/7 baseline)
   ```
   scripts/gym-run.sh conflicting-evidence
   ```
2. **Treatment**: Run `conflicting-evidence` 3x WITH the lab fork
   ```
   scripts/gym-run.sh conflicting-evidence --lab conflict-skill
   ```
3. **Measure**: Compare check-by-check pass rates. Target: 7/7 on treatment.
4. **Regression check**: Run 3-5 other scenarios WITH the lab fork to ensure the skill doesn't cause regressions on previously-passing scenarios.

## Success Criteria
- Treatment group scores 7/7 at least 2/3 times → **promote skill to coder/skills/**
- Treatment = baseline → skill is not effective, try different approach
- Treatment < baseline → skill causes regression, delete it

## Owner
Coach (run the experiment), Bob (analyze results)
