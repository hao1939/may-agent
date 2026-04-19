# Gym-as-Fast-Feedback Design

**Date:** 2026-04-16 | **Owner:** Coach

---

## 1. How Gym Maps to Coach Metrics

| Metric | Gym Signal | Method |
|--------|-----------|--------|
| `coach.intervention-hit-rate` | Run scenario **before** and **after** applying a skill/gate intervention. Hit = pass rate improves. | 10 trials pre/post, compare. Fast (20 min per arm). |
| `coach.skill-effectiveness` | For each skill, identify scenarios it should help. Track pass-rate delta when skill is active vs absent. | Tag scenarios by relevant skill. Batch test weekly. |
| `coach.knowledge-to-action-latency` | Not directly gym-measurable. Track time from KE creation → first experiment using it. Gym accelerates this by making experiments cheaper. | Measure in experiment log, not gym. |

**Key insight:** Gym gives fast signal on intervention-hit-rate (minutes). Skill-effectiveness needs accumulation across scenarios (hours). Knowledge-to-action-latency is a process metric tracked outside gym.

## 2. Relevant Scenario Categories

Coach doesn't run gym scenarios as the test subject — coach **designs interventions** and tests them on coder/other agents via gym. Relevant scenarios:

- **Convention scenarios** (12+): `convention-verify-edit`, `convention-safe-append`, etc. — test whether skills fix known behavioral failures
- **Recognition/judgment scenarios**: `approach-validation-trap`, `cascading-fix-trap-v2`, `sql-injection-in-query-builder` — test hard gates and expert hints
- **Behavioral scenarios**: `behavior-escalation-stubborn`, `context-learning-restraint` — test behavioral training
- **Any scenario with <80% pass rate** — potential intervention targets

## 3. How Gym Results Feed Into Metrics

```
Experiment cycle:
1. Identify low-pass scenario (baseline <80%)
2. Design intervention (skill, gate, or knowledge entry)
3. Run 10 trials with intervention → measure pass rate
4. If pass rate improves ≥15pp → intervention HIT (count toward hit-rate)
5. If no improvement → intervention MISS (still counts, denominator grows)

coach.intervention-hit-rate = hits / (hits + misses) over trailing 30 days
coach.skill-effectiveness = avg pass-rate delta across all skill-tagged scenarios
```

Gym results go into `may.db → gym_runs`. Query periodically to compute metrics.

## 4. The 295-Scenario / 36% Pass Rate Problem

36% aggregate pass rate means ~190 scenarios fail majority of the time. This is both a problem and an opportunity:

**Don't try to fix all 190.** Instead:
1. **Triage by discrimination**: Some scenarios may be broken (0% pass = impossible) or trivial (100% = no signal). Focus on 20-80% range — these discriminate.
2. **Prioritize by category**: Convention and recognition scenarios are coach's domain. Ignore scenarios testing features coach can't influence.
3. **Batch by failure mode**: Many failing scenarios share root causes (e.g., "agent doesn't verify edits" affects 12+ scenarios). One intervention can move many scenarios.
4. **Accept the long tail**: Some scenarios test genuinely hard problems. A 60% system-wide pass rate is a reasonable medium-term target.

**Concrete action:** Run `gym-batch.sh --tier L1` baseline, identify the 20 highest-leverage scenarios (fail often, fixable by known intervention patterns), focus experiments there.

## 5. Fast Feedback Loop for Coach

```
Daily cycle (30 min):
  1. Check gym dashboard for regressions (pass rate drops)
  2. If regression → investigate, design intervention
  3. Run 10-trial A/B in gym (20 min) → get signal same day

Weekly cycle (2 hours):
  1. Pick 2-3 low-pass scenarios from triage list
  2. Design interventions (skills/gates based on KE library)
  3. Run experiments → update skill-effectiveness metric
  4. Promote winners to production, discard losers

Monthly:
  1. Re-baseline all tagged scenarios (full sweep)
  2. Retire scenarios that hit ceiling (>95%)
  3. Propose new scenarios for uncovered failure modes
```

**The key advantage:** Gym gives signal in 20 minutes vs 2-3 days waiting for production failures. This means coach can iterate 5-10x faster on interventions. The bottleneck shifts from "waiting for data" to "designing good interventions."
