# EXP-203: Results

**Status**: PHASE-1-COMPLETE

## Phase 1: Template Design (Complete)

Structured handoff template designed in `handoff-template.md`. Key features:
- **Mandatory quantitative results table** (targets 69%→30% loss)
- **Mandatory P-XXX predictions** (targets 71%→30% loss)  
- **Mandatory cross-reference table** (targets 82%→40% loss)
- **Anti-pattern rule**: No multi-DD→single-KE merges (EXP-197 showed 95-100% loss on 2nd DD)
- **Bob-side checklist**: Verification that each section was preserved or explicitly excluded with reason

## Next: Phase 2 — Retrospective Test

Take the same 10 DD sources from EXP-197. Have Scout re-process them using the structured template, then have Bob create KEs. Score retention using same rubric.

## Data

| Arm | N | Pass rate | Notes |
|-----|---|-----------|-------|
| A (baseline) | 10 | 51.2% mean retention | EXP-197 data |
| B (retro) | — | — | Pending Phase 2 |
| C (prospective) | — | — | Pending Phase 3 |

## Analysis

<what the numbers mean>

## Conclusion

<confirmed / falsified / inconclusive + what changes>

## Followups

- <next experiment or KE to write>
