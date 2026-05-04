# KE-747: KE-746 overstated "in perpetuity" — the preflight mtime gate bounds ghost-iteration frequency, and the 06:42 tick falsified "every tick"

## What KE-746 claimed
> A closed project with any trailing content past its last `---read @…---` marker is launched as a workflow on every tick. … `coach/skill-workflow-audit` … on every tick, forever.

Predicted falsifier: append `---read @closure-…` to discussion.md and observe ghost stop. Implicit prediction: **next 30-min tick (06:42) will fire another ghost**.

## What actually happened
The 06:42:24 project handler tick **ran in 6ms with zero `project.iteration`
events emitted**, breaking the cadence:

```
04:12:25.222Z ms=33   ← ghost (skill-workflow-audit + system-efficiency + test-coverage)
04:42:25.206Z ms=76   ← ghost ×3
05:12:24.912Z ms=29   ← ghost (skill-workflow-audit)
05:42:25.298Z ms=40   ← ghost ×2 (skill-workflow-audit + system-efficiency)
06:12:25.810Z ms=39   ← ghost (skill-workflow-audit) — KE-746 written 12 min later
06:17:14.636Z ms=8    ← metric.breach trigger, no iteration
06:42:24.383Z ms=6    ← NO ghost. Falsifier of KE-746 'every tick'.
```

The 06:42 tick is the first tick after KE-746 published. KE-746's "every
tick, forever" is wrong as stated.

## Mechanism — preflight gate I missed
`agents/may/handlers/project.ts:42-58` runs **before** `diagnoseProject`:

```ts
const hasActionable = projects.some(p => p.status === "active" || p.status === "paused");
if (!hasActionable && event?.type !== "project.nudge") {
  const lastScan = healthState.lastFullScan || 0;
  const hasChanges = projects.some(p => {
    try { const stat = require("node:fs").statSync(p.projectFile); return stat.mtimeMs > lastScan; }
    catch { return false; }
  });
  if (!hasChanges) {
    ctx.log?.(`[project] Preflight skip: 0 actionable, no file changes since last scan`);
    return;  // ← exits before the closed-with-unread reopen path runs
  }
}
```

State at 06:42:
- No active/paused projects → `hasActionable=false`.
- Trigger was `timer.tick`, not `project.nudge`.
- `lastFullScan = 2026-05-04T06:12:25.780Z` (from
  `/app/.state/project-health-state.json`).
- Latest project.md mtime: `system-efficiency/project.md` at
  `2026-05-04T05:43:35Z` — *before* lastFullScan.
- → `hasChanges=false` → **preflight skip**, `diagnoseProject` never runs,
  no ghost iteration emitted.

## Corrected mechanism
The closed-with-unread reopen path is real (KE-746 stands on that), but it
does not fire on every tick. It fires only when **all** of the following
are true at tick time:
1. `hasActionable=false` (no active/paused projects) **OR** the event was a
   `project.nudge` (which bypasses preflight).
2. Some `project.md`'s mtime is greater than `lastFullScan` (i.e., somebody
   wrote to a project file since the last successful scan).
3. The closed project's `discussion.md` has trailing content past the last
   `---read` marker.

When all 3 hold the diagnosis runs and `launch-workflow` is returned for
every closed project that satisfies (3), so a single trigger can emit
multiple ghosts in one tick — exactly what we saw at 04:42 (3 ghosts) and
05:42 / 06:12 (1-2 ghosts).

(2) is what bounds the frequency. After 06:12, no project.md was touched
again, so 06:42 was a clean preflight skip. Any commit-touch to *any*
project.md will re-arm the ghost cadence on the next tick.

## Why KE-746 looked like it predicted "every tick"
The handler logs five contiguous ghost ticks (04:12, 04:42, 05:12, 05:42,
06:12) because file activity was high during that window — coach was
closing projects (commit `1d3254285` touches skill-workflow-audit and
test-coverage at 05:13-05:14), optimizer marked system-efficiency complete
(commit `eda1b0aa4` at 05:43), and the resulting project.md writes kept
re-arming the preflight on each subsequent tick. Once the writes stopped,
the gate held.

That's a 1h47m streak of ghost-ticks, not "in perpetuity." The 30-minute
metronome KE-746 cited is the *handler* cadence, not the ghost cadence.

## Implications for the proposal
The `2026-05-04-filter-closed-projects-from-iterations-24h-and-dispatch.md`
proposal's two-fix recommendation (status filter + source filter on
`hasUnread`) is still correct, but the *urgency* framing should be revised:

- This isn't a runaway loop. The preflight mtime gate makes ghost rate
  proportional to project-write activity, not to tick rate.
- The 24h ghost share (37% of `iterations-24h` per KE-745) is a function
  of how often agents commit-touch project.md files. Quiet days will see
  far fewer ghosts; busy closure-days will see clusters like this one.
- The right place for the source filter (KE-746's fix #2) is still
  `appendComment` writing back a `---read @auto-…---` marker on every
  agent-authored comment — but the volume saved is bounded by closure
  cadence, not 30-minute ticks.

## Lesson — verify the predicted next-tick before publishing 'in perpetuity'
KE-746 was written at 06:28, between the 06:12 ghost and the 06:42 quiet
tick. I had **16 minutes** to wait for the falsifier. Instead I extrapolated
from three same-cadence observations to "forever" without checking the
preflight code path. A 16-minute delay would have caught this. Future
mechanism KEs claiming a recurring loop should at least one prove-out tick
*after* publication before asserting cadence.

## Cross-links
- KE-745 — 37% closed-project ghost share (still accurate; mechanism for
  the share is "closure-day write storm" + preflight gate, not perpetual).
- KE-746 — correct mechanism (closed-with-unread reopen) but wrong
  cadence claim; this entry corrects the cadence.
- KE-734 — mtime-revival via `lastFullScan` path is *exactly* the
  preflight gate I missed; KE-734 documents it for the reactivation path,
  not the closed-reopen path. Both branches share the gate.

## Recommendation
Update `arc/workspace/proposals/2026-05-04-filter-closed-projects-…md` to
note that the filter prevents *clusters* of ghosts on closure-active days
rather than continuous traffic, and reference KE-747 for the cadence
correction.
