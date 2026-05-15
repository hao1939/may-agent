# EXP-415 Treatment Results

## Summary
**POSITIVE** — decompose-before-acting skill raises pass rate from 67% to 100% (+33pp).

## Design
- **Scenario**: hidden-constraints-refactor (split routes.js into 3 files with hidden constraints)
- **Threshold**: ≥6/7 checks pass
- **Baseline**: Standard agent, no planning skill
- **Treatment**: Agent with `decompose-before-acting` skill via injected_context.md

## Results

### Baseline (from EXP-415-baseline-results.md)
| Trial | Score | Pass (≥6) |
|-------|-------|-----------|
| 1 | 5/7 | ❌ |
| 2 | 6/7 | ✅ |
| 3 | 6/7 | ✅ |
**Pass rate: 2/3 (67%)**

### Treatment
| Trial | Score | Pass (≥6) |
|-------|-------|-----------|
| 1 | 7/7 | ✅ |
| 2 | 7/7 | ✅ |
| 3 | 7/7 | ✅ |
**Pass rate: 3/3 (100%)**

## Delta
- **+33pp** pass rate (67% → 100%)
- **+1.3 avg score** (5.7/7 → 7.0/7)
- Both `server-updated` and `no-circular-admin-orders` failures ELIMINATED

## Analysis

The decompose-before-acting skill specifically fixed:
1. **server-updated** (failed 3/3 baseline → 0/3 treatment): Skill forces agent to read ALL files first, so it discovers server.js needs updating
2. **no-circular-admin-orders** (failed 1/3 baseline → 0/3 treatment): Reading ARCHITECTURE.md before acting catches the circular dependency rule

## Caveats
- Small sample (3 trials per arm)
- Single scenario — need replication on different hidden-constraint tasks
- Treatment scenario uses injected_context.md which is more salient than normal skill loading

## Decision
**POSITIVE (directional)** — Skill demonstrates value on information-gathering scenarios. 
Next: Deploy to agents working on complex refactoring tasks (bob, coder). Consider replication on a second scenario before full deployment.

## Status
COMPLETED — 2025-01-30
