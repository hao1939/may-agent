# Tech-Lead Metrics — Definitions

Last refined: 2026-04-18 (script: `agents/tech-lead/scripts/refine-metrics-2026-04-18.ts`)

| Metric | Fate | Target | Threshold | Direction | Unit | How measured |
|---|---|---|---|---|---|---|
| Build health | KEEP | 1 | 1 | below=bad | bool | `npm run check > /dev/null 2>&1 && echo 1 || echo 0` (source=command, fast) |
| Meaningful changes | COLLECT | 10 | — | below=bad | commits/week | `git log --since='7 days ago' --oneline -- src/ \| wc -l` (source=command, daily) |
| Codebase weight | KEEP | 32000 | — | above=bad | lines | `find src -name '*.ts' \| xargs wc -l \| tail -1 \| awk '{print $1}'` (source=command, slow) |
| Delegation quality | KEEP | 0.85 | — | below=bad | ratio | SQL avg of `evaluations.quality` for coder sessions in last 7d (source=auto, daily) |

## Rationale & polarity fixes

### Build health (health)
Prior state: `target=0, threshold=1, current=1` → since `current < threshold` is the alert rule (`alert_direction=below`) and `current==threshold`, we were at the edge of RED for no reason. The collector returns `1=OK, 0=FAIL`. Fixed target to 1 so "current == target == threshold == 1" is the steady green state; drops to 0 trigger RED via `current < threshold`.

### Meaningful changes (continuous, was never measured)
Prior state: `current=null, target=0, source=null`. Implemented a cheap shell collector counting commits touching `src/` in the last 7 days. First measurement: **84**. Target set to 10/week as a low floor — below 10 means shipping has stalled. Not a health metric (no threshold), just trend signal. Future refinement: filter out pure-whitespace/rename commits, but approximate-first per task guidance.

### Codebase weight (continuous)
Prior state: `target=0, alert_direction=below`. That polarity was wrong: `target=0` with "below is bad" would mean we want to *grow* the codebase. Intent is the opposite. Changed to `target=32000` (soft cap, current=31431) with `alert_direction=above`, so crossing 32k LOC signals drift. Not a hard threshold — just a "if you're over, consider trimming" marker. Continuous, so no RED banner.

### Delegation quality (continuous)
Prior state: `target=0`. quality is a 0..1 ratio from evaluator scores on coder sessions I delegate. Set target to 0.85 (current=0.8). `alert_direction=below` is correct. No hard threshold because continuous metrics don't trigger the red-banner action rule — good enough as trend signal.

## Why no deactivations
All four capture real signal I actually act on in heartbeats. None are fake. The only broken one was "Meaningful changes" which lacked a collector; now wired with a 1-line shell command.

## Re-running
`bun agents/tech-lead/scripts/refine-metrics-2026-04-18.ts` is idempotent — safe to re-run. The collectors run automatically via `agents/may/handlers/metrics-snapshot.ts` on cron.
