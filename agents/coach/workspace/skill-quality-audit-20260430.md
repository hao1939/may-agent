# Skill Quality Audit — 2026-04-30

## Summary
**153 skills across 12 agents + shared. Only 8 have A/B gym evidence. Gym runner is broken — no new evidence can be generated.**

## Evidence Tiers

### Tier 1: A/B Tested in Gym (8 skills/interventions)
These have lab_fork data in gym_runs:
| Lab Fork | Runs | Pass Rate | Verdict |
|----------|------|-----------|---------|
| C-f1-only | 10 | 100% | ✅ Effective |
| EXP043-strict | 6 | 100% | ✅ Effective |
| EXP053-ext | 6 | 100% | ✅ Effective |
| EXP094-fewshot | 3 | 100% | ✅ Effective (small N) |
| EXP088-workaround | 6 | 83% | ✅ Effective |
| D-baseline | 8 | 0% | Baseline (expected) |
| EXP042-baseline | 6 | 50% | Baseline |
| EXP094-baseline | 3 | 0% | Baseline |

### Tier 2: Has KE with Tested Claims (partial evidence)
- evidence-over-narrative → KE-102: eliminates verification confabulation
- Skills with TRIGGER/ACTION/EXAMPLE format → KE-285: ~75% adoption rate
- Few-shot skill conversion → KE-065

### Tier 3: Known Limitations (KEs say "doesn't work")
- KE-359: Background skills don't trigger behavior change
- KE-350/338: Procedural discovery skills don't help with relational bugs
- KE-175: Counter-intuitive skills fail at universal floors
- KE-170: Skills redundant when base model at ceiling
- KE-367: Workflow enforcement has no advantage over text skills at high baselines

### Tier 4: Untested / No Evidence (~130 skills)
The vast majority of skills have zero gym evidence. They exist in skills/ directories but have never been A/B tested.

## Key Shared Skills (60 active, no archive)
Most are structural/process skills (verification, escalation, handoff, etc.) that are hard to A/B test because they're always-on behaviors.

## Archived Skills (17)
- 3 disproven (classify-then-act, grep-first-reading, investigate-and-fix)
- 6 unreferenced (constructive-friction, critical-pause, etc.)
- 8 untested (brainstorm-before-build, check-state, etc.)

## Blocker
**GYM_AGENT_BIN env var is not configured.** Without this, gym-run.sh can't spawn agent sessions. All new experiments are blocked. This has been known since Jun 29. Must be escalated to tech-lead/may.

## Recommendations
1. **Escalate gym blocker** — nothing improves until we can run experiments
2. **Prune Tier 4** — 130 untested skills is tech debt. Archive anything not referenced in any agent config
3. **Re-test Tier 2** — KE-claimed skills need fresh gym validation
4. **Retire Tier 3** — Archive skills that KEs say don't work
