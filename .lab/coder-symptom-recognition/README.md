# Lab Fork: coder-symptom-recognition

**Experiment**: EXP-203
**Base agent**: coder
**Created**: 2026-06-23
**Purpose**: Test whether a background symptom-recognition skill can improve relational bug fix rate

## Changes from base coder
- Added `skills/relational-bug-recognition.md`

## Run Instructions
```bash
# From gym:
scripts/gym-batch.sh --scenarios cascading-fix-trap-v2,competing-fix-strategies --agent coder-symptom-recognition --trials 10
```
