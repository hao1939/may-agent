# Workflow Health Scan — 2026-04-17 11:30 UTC (Mode D)

**Window:** last 6h (05:30–11:30 UTC). Baseline: prior 18h within same 24h window.
**Budget used:** ~12 ops (scan).

## Metrics

### Session volume last 6h
- Total sessions: 238 (229 done, 2 interrupted, 7 running). Errored: 2.
- Interrupt rate: 2/238 ≈ **0.8%** — healthy (prior concern was 22–67%).
- Per-agent ops: coach 401 (avg 10.0), optimizer 301 (11.6), tech-lead 166 (7.9), may 123 (3.7), qa 75 (6.3), scout 45 (3.5), coder 26 (6.5), bob 21 (1.6). All within historical norms.

### Workflow trees (grouped by `workflowRunId`, 6h vs prior 18h)
| Workflow class        | 6h n | 6h avg | Prior 18h n | Prior avg | Δ      |
|-----------------------|-----:|-------:|------------:|----------:|-------:|
| investigate-and-fix   |   14 |   15.3 |          53 |      13.5 | +13%   |
| lens-analysis         |    8 |    8.1 |          29 |       5.9 | +37%   |
| persistent-task       |    1 |   13.0 |           9 |      20.7 | −37%   |
| other                 |    3 |   14.7 |          13 |      25.5 | −42%   |

### Lens-analysis per-lens breakdown
| Lens | 6h n | 6h avg | Prior 18h n | Prior avg | Prior max |
|-----:|-----:|-------:|------------:|----------:|----------:|
| A    |    2 |    1.5 |           8 |       3.9 |         6 |
| B    |    1 |    7.0 |           8 |       6.3 |        13 |
| C    |    2 |    6.0 |           8 |      17.5 |        82 |
| D    |    2 |   16.0 |           7 |       6.1 |        11 |

## Analysis

**Headline: prior fixes are holding, no new systemic regression.**

1. **D-o-R P1 cap, persistent-task iter cap, optimizer dispatcher, LLM→JS verify**: all intact. persistent-task avg *fell* to 13 (from 20.7). investigate-and-fix holds near 15 ops/tree, which is at or below its post-fix target.
2. **Lens-analysis 37% creep is noise, not regression.** The driver is Lens D spiking to 16 avg (n=2). Inspection of those sessions (`wr_1776407468780_k7xw`, 19 ops; `wr_1776418278096_ci4f`, 13 ops) shows the workflow's own hard cap of **≤20 ops** enforced correctly (prompt text: "Total budget: ≤20 ops"). The prior 6.1-op baseline reflected simpler Lens D questions (e.g., "Evaluator duplication"); the current ones are broader ("blast radius of callAgent failures"). Different question scope, not workflow failure. Lens C previous 82-op outlier was already dispatched to tech-lead earlier today (Mode A, Apr 17 09:30 UTC).
3. **Interrupt rate dropped from prior 22–67% concern to 0.8%** — the tiered heartbeat budget fix (raised 10→12) is working.
4. **Big non-workflow sessions** (50 coach prove-the-loop, 40 tech-lead project-resume build, 36 coach resume, 36 coach iter-4+, 35 coach iter-4, 31 optimizer process-automation): these are task-tree sessions carrying `[PERSISTENT TASK]` or `[PERSISTENT TASK RESUME]` prefixes but **are not running through the persistent-task workflow** (no `workflowRunId`). They are may-dispatched freeform resumes. The soft ≤20-op budget in `agents/shared/workflows/persistent-task.ts:234` never reaches them. This is a **structural gap** — flagged but not a 6h regression (same pattern in prior 18h).

## Regression Identified
**None.** The nearest candidate (lens-D avg creep) is explained by question scope and sits under the enforced ≤20 op cap. All prior optimizations are holding.

## Recommendations

### R1 — NO_ACTION_NEEDED (this scan)
System is calm on the 6h window. Workflow budgets are being respected. Interrupt rate is 0.8%. No single-intervention fix has a clear target here.

**Justification for no-action:**
- Lens D creep is 2 sessions; too small a sample to tune prompts on without creating a false-signal fix.
- No workflow exceeded its declared budget.
- Non-workflow "persistent-task-style" dispatches (R2 below) are a pre-existing structural gap, not a 6h regression — and tackling them now would violate the "one intervention at a time" rule (KE-123) while the tiered-budget fix is still freshly-landed.

### R2 — Route may-dispatched "[PERSISTENT TASK …]" forks through the workflow (deferred, next Mode D)
- **File:** `agents/may/handlers/project-resume.ts:148` (task string) and the ad-hoc forks that may emits in heartbeat when resuming projects.
- **Change:** Either (a) have may's resume fork call `runWorkflow("persistent-task", …)` so the ≤20 op budget prompt + iteration cap apply, or (b) inject the same `### Budget` stanza into the freeform task string used by project-resume / may heartbeat resumes.
- **Expected impact:** Caps the 35–50 op coach/tech-lead resume sessions seen today. Est. savings 80–150 ops/day on prove-the-loop + process-automation.
- **Priority:** P2. Defer to next Mode D (Apr 17 ~17:00 UTC) so the current tiered-budget fix has a clean measurement window.

### R3 — Re-measure Lens D in 24h (monitoring, not action)
- If Lens D avg stays ≥12 with n≥6 in the next scan, revisit the SCOPE phase prompt in `agents/shared/workflows/verify-wrap.ts` or the lens-dispatch template to tighten question scope. For now: watch.

## Next-check date
**2026-04-17 ~17:30 UTC** (next Mode D rotation, +6h). Specifically re-check: (1) Lens D avg, (2) interrupt rate, (3) big non-workflow persistent-task-style sessions vs R2.

## Rotation marker
- Mode D complete. Next rotation: **A (Session Archaeology)**.
