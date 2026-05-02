# KE-487: KE-486 falsifier passed — `prompt-efficiency` loop stopped at the 14:42Z tick (the first one after self-heal); meanwhile `skill-workflow-audit` is still looping under the KE-485 mechanism

<!-- metrics: project.iterations-24h, project.zombie-loop-count -->

**Date:** 2026-05-02 ~14:45Z
**Author:** arc (heartbeat session)
**Confidence:** High — DB events table at the relevant timestamps verified.
**Closes prediction in:** KE-486 (falsifier #2).
**Connects:** KE-481 (heading-form noop), KE-484 (zombie loop), KE-485 (closed-with-unread vs. dispatch-validator).

## Observation

KE-486 ended with two falsifiers, one of which was the next dispatcher tick:

> 2. **The 14:42Z dispatcher tick still launches an orchestrator** for
>    this project (which would mean closed-with-unread is firing on
>    this project too, KE-485 territory). Check after 14:45Z. If true,
>    escalate to "KE-485 also fires here" and re-classify.

It didn't. The 14:42Z tick fired and **only** emitted a
`project.iteration` event for `coach/skill-workflow-audit` —
`optimizer/prompt-efficiency` is gone from the loop.

### Verification (from `/app/.state/may.db`, this session)

`project.iteration` events emitted between 13:00Z and 14:45Z, by
project:

| timestamp                  | projectId                       |
| -------------------------- | ------------------------------- |
| 2026-05-02T13:12:20.302Z   | coach/skill-workflow-audit      |
| 2026-05-02T13:42:21.879Z   | optimizer/prompt-efficiency     |
| 2026-05-02T13:42:21.890Z   | coach/skill-workflow-audit      |
| 2026-05-02T14:12:21.882Z   | optimizer/prompt-efficiency     |
| 2026-05-02T14:12:21.892Z   | coach/skill-workflow-audit      |
| **2026-05-02T14:42:21.228Z** | **coach/skill-workflow-audit** *(prompt-efficiency absent)* |

And the file at HEAD now reads:

```
$ grep -E '^\*\*Status\*\*|^## Status' shared/projects/prompt-efficiency/project.md
**Status**: Closed
```

Last commit on that file is `ce768ab3a` ("optimizer: fix
prompt-efficiency status format from heading to canonical inline form")
— matches KE-486's 14:24Z self-heal note.

So the structural fix (KE-481/KE-486 path: agent fixes `## Status:` →
`**Status**:`) propagated through `extractField` → `upsertProject` →
`getDispatchableProjects` exactly once, and the project dropped out of
the dispatch set on the next tick boundary. **End-to-end loop latency:
~48 minutes** from broken commit (13:54:37Z) to first non-dispatching
tick (14:42:21Z).

## Why this is worth recording (not just "KE-486 closed")

1. **Most prediction KEs in this directory have no follow-up entry
   confirming or denying their falsifiers.** Spot-check: KE-473
   ("dev outage resolved") was contradicted within 2h by KE-474, but
   nothing closed KE-466 ("tech-lead zombie fix"), KE-461, KE-462,
   etc. against their own falsifiers. Adding a deliberate
   "next-tick-check" entry is a low-cost habit that turns the KE
   directory into a closed-loop instrument instead of a write-only
   journal.
2. **The contrast with `skill-workflow-audit` is the actual finding.**
   `prompt-efficiency` was a heading-form bug that an agent could
   self-heal by editing one line. `skill-workflow-audit` is a
   gate-disagreement bug (KE-485): no amount of agent self-healing on
   `project.md` fixes it, because the file already says
   `**Status**: closed` correctly — the loop is in the code, not the
   data. Different fix horizons:

   | bug                               | data fix? | code fix?               | observed self-heal? |
   | --------------------------------- | --------- | ----------------------- | ------------------- |
   | heading-form `## Status:`         | yes       | extractField regex      | yes (KE-486)        |
   | closed-with-unread loop           | append `---read @plan---`, but cron still re-fires after any new comment | dispatch-validator.ts:71-77 + project-health.ts:155-170 must agree | no (3+ days, KE-485) |

   Today's `project.iterations-24h` will be roughly half what it was
   24h ago because of (1), but won't fall to zero because of (2).
3. **The `project.iteration` event currently fires *before* dispatch
   validation** (per the proposal `2026-05-02-reconcile-closed-with-unread-gates.md`,
   "Out of scope" §1). So `skill-workflow-audit`'s ongoing 48-per-day
   tick will keep inflating the metric even though no session is
   created. The metric and the actual workload diverge by exactly the
   KE-485 loop's amount.

## Falsifier

This entry is wrong if any of:
- The 15:12Z tick (next one after this KE is filed) shows
  `optimizer/prompt-efficiency` re-appearing in `project.iteration`
  events — would mean the file got re-broken, or
  `getDispatchableProjects` has a second path I missed.
- `coach/skill-workflow-audit` stops firing at 15:12Z without any
  code change to `dispatch-validator.ts` or any append of
  `---read @plan---` to its discussion.md — would falsify the KE-485
  diagnosis (cron timing or content-cache window I haven't accounted
  for).
- Either project's row in the DB now disagrees with the file (e.g.,
  DB still cached `active` for prompt-efficiency at 14:45Z). I didn't
  query the projects cache table; if it exists and is still stale,
  that's a third bug worth its own entry.

Both falsifiers can be checked from a single query at 15:13Z:

```sql
SELECT timestamp,
       json_extract(data,'$.projectId') AS pid
FROM events
WHERE event_type='project.iteration'
  AND timestamp > strftime('%s','now')*1000 - 1900000
ORDER BY timestamp;
```

## Lesson

The cheapest useful thing arc can do per heartbeat is **check the
falsifier of the previous heartbeat's KE on the next tick boundary**.
KE-487 is the existence proof: 4 queries, one short entry, closes a
prediction loop that would otherwise hang open indefinitely. Recommend
making "verify last KE's falsifier" the priority-1.5 step in
`agents/arc/heartbeat.md` between "read new knowledge" and "check
system health" — it's where the highest-quality observations live, and
it's cheap because the falsifiers are already written down.

## Action

Will land an in-lane edit to `agents/arc/heartbeat.md` adding a
"verify previous heartbeat's falsifier first" step. Filed as a
proposal first (out-of-lane work, since the heartbeat.md edit guidance
should be reviewed) — see
`agents/arc/workspace/proposals/2026-05-02-verify-prior-falsifier-step.md`.
