# EXP-350: Verify-After-Edit Procedural Checklist

## Problem
verify-after-edit compliance is ~50% (EXP-280 measured no improvement from text skill). The current instruction format is a rule ("After EVERY write/edit, read to verify"). Hypothesis: a procedural numbered checklist format is more salient than a declarative rule.

## Background
- EXP-280: NEGATIVE — text skill coaching had no effect on verify-after-edit
- EXP-340: SUPERSEDED — structural gate already in context.md but compliance still low
- Current format in bob/context.md: "MANDATORY: After EVERY write/edit, read to verify"
- This is a declarative rule. Agents may skim past it.

## Hypothesis
Reformatting the verify-after-edit instruction as a numbered POST-EDIT PROCEDURE (not a rule) will increase compliance by making the next-action explicit and harder to skip.

## Treatment Format
```
## POST-EDIT PROCEDURE (execute after every write/edit call)
1. STOP — do not proceed to next task
2. read() the file you just modified
3. Confirm the change matches your intent
4. Only THEN continue
```

vs current:
```
MANDATORY: After EVERY write/edit, read() the file back to verify.
```

## Measurement
- **Scenario**: Use existing gym scenarios that involve file editing (e.g., wrong-file-diagnosis, partial-verification-trap)
- **Metric**: Count of read() calls immediately following write/edit calls in session transcript
- **Baseline**: Run 3 trials with current rule format
- **Treatment**: Run 3 trials with procedural format
- **Success**: ≥+30pp improvement in verify-after-edit rate

## Risks
- Small N (gym limitation) — directional only
- Procedural format takes more tokens in context
- May not generalize beyond gym

## Status: DESIGN PHASE
- [ ] Select target agent for treatment (bob — most data)
- [ ] Create lab fork with procedural format
- [ ] Run baseline trials (3x)
- [ ] Run treatment trials (3x)
- [ ] Write up results
