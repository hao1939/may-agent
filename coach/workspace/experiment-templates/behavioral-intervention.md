# EXP-NNN: <short title> (behavioral intervention)

**Type:** (d) behavioral intervention (context-rule / workflow)
**Created:** YYYY-MM-DD
**Hypothesis:** <adding rule/workflow X will reduce failure mode FM-y.z on <agent>>
**Reference:** prove-the-loop C1.x iterations (Iter 1..8), KE-002, KE-007

## Phase 1 — Design

- **Target failure mode:** FM-x.y (<name>) — cite ERROR_LOG evidence rate (e.g. "7 of last 30 sessions")
- **Intervention type:** [ ] context rule  [ ] workflow step  [ ] skill file
- **Intervention content:** <the actual text — ≤5 lines preferred>
- **Insertion point:** <file path and location; e.g. `agents/<agent>/context.md` append>
- **Control:** baseline agent
- **Treatment:** fork with intervention applied (agents/.lab/<agent>-<exp-id>/)
- **Scenarios:** pick 2–3 that historically trigger FM-x.y
- **Primary metric:** FM-x.y occurrence rate (should DECREASE) AND pass rate (must not regress)
- **N trials:** ≥10 per arm per scenario
- **Decision rule:** promote if FM-x.y rate drops ≥50% AND pass rate delta ≥ -0.05

## Phase 2 — Setup

```bash
cp -r agents/<agent>/ agents/.lab/<agent>-<exp-id>/
# Apply SINGLE intervention
$EDITOR agents/.lab/<agent>-<exp-id>/<file>
diff -r agents/<agent>/ agents/.lab/<agent>-<exp-id>/
```

- KE-002 warning: text rules have 0% success for judgment failures. If FM is judgment-based, prefer workflow (KE-007).
- KE-123 warning: do NOT combine with another active intervention.

## Phase 3 — Run

```bash
for arm in baseline lab; do
  agent=$([ $arm = baseline ] && echo <agent> || echo .lab/<agent>-<exp-id>)
  scripts/gym-batch.sh --scenarios <s1>,<s2> --agent $agent --trials 10 \
    --out agents/coach/workspace/EXP-NNN/$arm.jsonl
done
```

## Phase 4 — Analyze

- Pass rate A vs B (regression check)
- FM-x.y incidence A vs B (primary check — needs failure-mode tagging from judge)
- Side-effect scan: did any OTHER failure mode increase? (Whack-a-mole check)
- Production signal: queue a 24h production A/B if gym delta holds

### Results
- FM-x.y rate — A: __/__ (__%) → B: __/__ (__%)
- Pass rate — A: __% → B: __%
- New failure modes in B: <list or "none">

## Phase 5 — Graduate

- [ ] Gym gates pass → promote fork files into `agents/<agent>/`
- [ ] If judgment-failure class, also queue 24h production check before declaring win (KE-002)
- [ ] Record KE-NNN documenting the rule and its evidence
- [ ] Log in `experiments.jsonl`
- [ ] Delete fork if not promoted

## Constraints
- ONE intervention (KE-123 — stacking costs 12-15pp).
- No analysis-doc gates (KE-180).
- Prefer workflow over text rule for judgment failures (KE-002 / KE-007).
