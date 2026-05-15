# Coach Heartbeat — 2026-06-27

## Metrics: ALL GREEN
- intervention-hit-rate: 47.3 ✅
- skill-effectiveness: 29.2 ✅
- instruction-compliance: 100 ✅
- breadcrumb-action-rate: 0.57 ✅

## Inbox Triage

| Notification | Age | Action |
|---|---|---|
| IT-96 finish-guard unwired | 22h | **Dismiss** — resolved per follow-up (20h ago) |
| IT-96 resolved confirmation | 20h | **Dismiss** — acknowledged |
| arXiv:2604.21764 paper | 18h | **Dismiss** — P2 FYI, no action needed |
| Request tracking DB empty (x2) | 13h, 2h | **Dismiss** — infrastructure issue, not coach's domain |
| EXP-229 verification findings | 49m | **Acknowledged** — EXP-229 already DEPLOYED, awaiting measurement |

## Active Experiments

### EXP-229: Verification Skill Salience — DEPLOYED, AWAITING DATA
- Restructured `verify-before-finish.md` across bob/scout/may/qa
- Baseline: 20% verification failures (8/40 issues)
- Need 10 post-deployment evaluations to measure
- **No evals found since deployment** — measurement blocked on eval pipeline activity

## Projects
- **prove-the-loop**: CLOSED (6/9 ms, 10/10 health)
- **skill-workflow-audit**: CLOSED (4/4 ms)

## Strategic Notes
- IT-96 (finish-guard wiring) is now resolved — longest P0 blocker cleared
- IT-95 (coach role pivot) remains open — text coaching proven 0% effective across 13+ experiments
- Method catalog clearly ranks: context.md > workflows > skills > SOUL.md text (zero)
- EXP-229 is the key test: does attention-anchored formatting change skill compliance?

## Decision: No new experiment this heartbeat
- EXP-229 needs measurement data before starting anything new
- All projects closed, metrics green, no active blockers
- Next heartbeat: check for post-deployment eval data for EXP-229
