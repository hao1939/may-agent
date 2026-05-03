# Experiment Pipeline Status — 2026-05-03

## Active Experiments

| ID | Name | Phase | Status | Blocker |
|----|------|-------|--------|---------|
| EXP-720 | Few-Shot in master-worker.ts | Phase 1 done | H1 SUPPORTED (47% coverage) | Binary rebuild needed |
| EXP-730 | Dormant Gate Audit | Phase 2 done | Root causes identified | Tech-lead escalation for fixes |
| EXP-710 | Task Timeout Pressure | Backlog | Design needed | — |
| EXP-540 | Path Normalization | Deployed | Awaiting measurement | No eval data |

## Recently Closed (last 3 months)

| ID | Result | Key Finding |
|----|--------|-------------|
| EXP-700 | INCONCLUSIVE | Parallel tool calls: 0pp quality, ~20% duration reduction |
| EXP-600 | NEGATIVE | Text skill can't reduce bash waste; habit-bound |
| EXP-595 | CEILING | Worker injection durability: 100% baseline |
| EXP-590 | DURABLE | Threat gates hold — no habituation |

## Proven But Undeployed

| Mechanism | Evidence | Coverage | Blocker |
|-----------|----------|----------|---------|
| Few-shot injection | 100% (18/18 gym) | <10% of sessions | Binary rebuild (EXP-720) |
| Strict workflow gates | 100% (sycophancy) | 0% of production | No use case identified |

## Key Metrics (No Evaluator — All Manual/Gym)

- **Last evaluator run**: 2026-04-30 (105+ days ago)
- **Gym regression**: Last run 2029-05-18 (EXP-595). All structural behaviors verified.
- **Active structural gates**: EXP-500 (read-before-edit), EXP-510 (worker completion), EXP-520 (artifact), EXP-530 (verification), EXP-565 (verify-after-edit threat)

## Next Actions

1. **P1**: Get binary rebuilt so EXP-720 dry-run logging activates → Phase 2 injection
2. **P1**: EXP-730 — escalate gate fixes to tech-lead (duration gate dead, turnsUsed always 0)
3. **P2**: EXP-710 — design timeout pressure experiment when bandwidth available
4. **P2**: Run gym regression check (last was 2029-05-18, approaching staleness)
