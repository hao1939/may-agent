# Experiment Closure Audit — 2027-09

**Purpose**: Identify deployed-but-unmeasured experiments and recommend closure actions.

## Methodology

Searched `.state/experiments/` for files containing "DEPLOYED" or "AWAITING" status markers.

## Stale Deployed Experiments

| EXP | Name | Action |
|-----|------|--------|
| 262 | Structural Guard Templates | CLOSE — structural, verify in code |
| 276 | Optimizer Output Accountability | CLOSE — superseded by EXP-298/500 |
| 281 | Coach Self-Compliance | CLOSE — 16+ months deployed, no eval data possible |
| 295 | Anti-Shallow Replication | CLOSE — verified in context.md files |
| 296 | Ghost Completion Detection | INVESTIGATE — check if structural |
| 298 | Optimizer Confabulation Guard | CLOSED already (inconclusive, kept) |
| 304 | Deliverables in Finish | CLOSE — verified structurally |
| 451 | Write-First Scaffold | INVESTIGATE — recent, may have data |
| 495 | (measurement plan) | INVESTIGATE — may be active |
| 500 | Structural Read-Before-Edit | CLOSE — structural, code-verified |

## Pattern: Why Experiments Die Unmeasured

1. **Evaluator not running** — no new quality data generated post-deployment
2. **No automated measurement trigger** — "measure after 2 weeks" is never enforced
3. **Sample size insufficient** — target agent doesn't run enough sessions
4. **Structural interventions succeed silently** — code-level guards work but produce no measurable signal

## Recommendation: Experiment Hygiene Protocol

For stale experiments (>30 days deployed, no measurement):

1. **Structural interventions** (code guards, template changes): Close as DEPLOYED_VERIFIED if grep confirms presence. No eval needed.
2. **Behavioral interventions** (context coaching, prompts): Close as INCONCLUSIVE if <5 sessions available. Note: keep deployed if no harm.
3. **New experiments**: Must specify measurable signal at design time. If no signal exists, the experiment is a deployment, not an experiment.

## Next Action

Close EXP-262, 276, 281, 295, 304, 500 with DEPLOYED_VERIFIED/INCONCLUSIVE verdicts. These are consuming cognitive overhead in audits with zero chance of producing new data.
