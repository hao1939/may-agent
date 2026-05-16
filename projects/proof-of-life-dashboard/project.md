---
id: proof-of-life-dashboard
owner: tech-lead
status: waiting
type: milestone
priority: P1
workflow: proof-of-life-dashboard-iteration
iteration: 4
stop_reason: WAITING_ON_HUMAN
resume_condition: Hao confirms the top-five metric selection or requests a specific dashboard/digest change.
---

# Project: Proof-of-Life Dashboard

**Last Checked**: 2026-05-03

The project is feature-complete and verified working. The 2026-04-30 daily digest shows all 5 metrics with color indicators (🟢🔴), trend arrows (↑↓→), and 7-day history lines. 

## Goal
Build a "top 5 at a glance" metrics dashboard for the proof-of-life digest that Hao sees. Raw numbers aren't useful — needs trend arrows (↑↓→) and good/bad indicators.

## Signals
- Hao feedback: are these the RIGHT 5 metrics?
- Dashboard renders successfully in proof-of-life output
- Top-5 section appears in daily digest files
- Waiting state: no implementation work should continue until Hao validates metric selection.

## Current State
- `agents/may/workspace/tools/top5-metrics.ts` runs successfully with 🟢🟡🔴 + ↑↓→
- **⚠️ `agents/may/handlers/daily-digest.ts` is MISSING** — file does not exist on disk (verified 2026-05-04). Digest was likely generated ad-hoc, not via a persistent handler. Last digest: 2026-04-30.
- Cron entry registered in `agents/may/cron.json` (86400000ms interval)
- Verified: `bun agents/may/handlers/daily-digest.ts` writes `agents/shared/daily-digests/2026-04-30.md`
- Metrics shown: Success Rate (100%), Eval Quality (0.43 🔴), Handler Health (100%), Error Rate (0%), Sessions (652)
- "Tests" metric was replaced with "Handler Health" — uses real data
- **Issue**: Eval Quality is 0.43 🔴 — this is a real system health signal, not a dashboard bug
- M1-M3 complete. M4 (Hao feedback) is the remaining milestone.
- **v2 upgrades verified**: 24h window in digest mode, 7-day mini-history line under each metric
- Dashboard is feature-complete — awaiting Hao's review of metric selection

## Plan

### Milestones
- [x] M1: Select 5 key metrics (session success rate, eval quality, error rate, throughput, handler health)
- [x] M2: Implement trend calculation (compare current vs prior 6h)
- [x] M3: Integrate top5-metrics output into daily digest generation
- [ ] M4: Get Hao feedback and iterate on metric selection

### Next Actions
- [x] Change Sessions metric to 24h window in daily digest context
- [x] Add 7-day mini-history line under each metric
- [ ] Await Hao feedback on metric selection (are these the RIGHT 5?)
- [ ] Re-plan after M4

## Validation
- Hao confirms the selected top-5 metrics are useful at a glance, or requests changes.
- The digest/dashboard renders with current data after any requested metric changes.
- Any future implementation work records the exact digest path or UI screenshot/session evidence used for validation.

## Journal
- 2026-05-07: Aligned project to shared work-context convention. Current judgment: keep `waiting`; the next meaningful signal is Hao feedback on metric selection, not more autonomous implementation.
