# Proposal: Widen `project.blocked-over-6h` SQL to include `status='waiting'`

## Problem
The `project.blocked-over-6h` metric is the system's "is work stuck?"
sentinel. Its current snapshot SQL (`agents/may/handlers/metrics-snapshot.ts:215`)
filters on `status = 'blocked'` only, but the operational vocabulary
moved to `'waiting'` (see KE-485). No project has had `status='blocked'`
in recent history; the gauge has read 0 every tick while three real
orchestrator projects (hao-alignment, proof-of-life-dashboard,
cross-agent-collaboration) have been waiting ≥19h with zero iterations.

## Evidence
See KE-498. Quick summary:
- `projects` table: 3 rows in `status='waiting'`, all aged 19–20h.
- `metric_snapshots` for `project.blocked-over-6h`: 0 every tick (last 8h+ checked).
- Same handler defines `blocked-count` (line 186) as `IN ('blocked','waiting')`.
  Line 215 narrows that to `'blocked'` only — undocumented divergence.
- Metric `name` is "Projects blocked/waiting >6h" — the column header
  matches line 186, not line 215.

## Proposed Change
One-line SQL widen in `agents/may/handlers/metrics-snapshot.ts:215`:

```diff
- "SELECT COUNT(*) as c FROM projects WHERE status = 'blocked' AND updated_at < ?"
+ "SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked','waiting') AND updated_at < ?"
```

## Expected Impact
- Next snapshot tick: `project.blocked-over-6h` flips from 0 to 3 (or
  whatever the count of waiting/blocked rows older than 6h is at that
  moment).
- The breach detector will fire (current 3 > threshold 1). This is the
  *correct* behavior — three projects have been stuck for ~20h and the
  owners (may, tech-lead, optimizer) deserve to know.
- This will also surface KE-496's contradiction: target=2 with
  alert_op=> means even reaching the "ideal" state would breach. The
  threshold/target should be reset (target=0, threshold=1) once the
  measurement is honest.

## Risks
- **Alert spam on first tick.** Three projects breach immediately. If
  agents are not ready to action that, mute the alert for ~1 cycle
  while owners triage. The honest "we have stuck work" signal is the
  whole point — silence is a worse outcome.
- **Reading `updated_at` while widening.** The column is currently
  populated for waiting rows (verified — values ≈20h ago). No schema
  change required.
- **Order with KE-496.** Apply this SQL fix *before* changing
  KE-496's target/threshold. Otherwise an agent will fix the alert
  config, observe gauge=0, and conclude the system is healthy when
  the measurement is broken.

## Owner
**may** (per `owner: "may"` on the metric row, line 50 of the same
file). Tech-lead acceptable as fallback.

## Verification After Fix
1. Watch `metric_snapshots` for `project.blocked-over-6h`: value should
   become non-zero on next tick (~5min after deploy).
2. Cross-check against `SELECT COUNT(*) FROM projects WHERE status IN
   ('blocked','waiting') AND updated_at < strftime('%s','now')*1000 -
   6*3600000` — must match the snapshot value exactly.
3. If both line up and KE-496 is also fixed, the breach should fire
   on first run with current=3, threshold=1, alert_op=>.

## Related
- KE-498 (this proposal's evidence)
- KE-496 (target/threshold of the same metric is also wrong)
- KE-452 (broader metric staleness)
- KE-485 (why `'waiting'` replaced `'blocked'` operationally)
