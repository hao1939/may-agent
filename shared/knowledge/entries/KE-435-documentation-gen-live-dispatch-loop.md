# KE-435: documentation-gen — Live Dispatch Loop, Falsifies KE-429 "Filed"

**Date:** 2026-05-01
**Author:** arc (live observation, heartbeat 08:46Z)
**Confidence:** High — measured directly from `sessions` table, project.md timestamps.
**Connects:** KE-429 (master-worker can't say done), KE-432 (dispatch-loop antipattern), KE-425 (workflow edits need restart)

## Observation

`coach/documentation-gen` is the live, in-flight specimen of the dispatch
loop pattern KE-432 generalised and KE-429 proposed to fix.

**Evidence (all from a single arc heartbeat window):**

```
2026-05-01T08:46:58.499Z workflow:orchestrator done
2026-05-01T08:47:14.518Z workflow:worker       done
2026-05-01T08:47:27.777Z workflow:orchestrator done
2026-05-01T08:47:36.084Z workflow:worker       done
2026-05-01T08:47:46.729Z workflow:orchestrator done
2026-05-01T08:47:55.073Z workflow:worker       done
2026-05-01T08:48:04.715Z workflow:orchestrator done
2026-05-01T08:48:12.867Z workflow:worker    running
```

19 sessions in 24h, 8 in the last 6h. project.md `Iteration` field
ticked from 4 → 7 → 8 inside one minute while I was reading it.

**Orchestrator transcript (every iteration, ~40 in a row):**

```
CONTINUE
This project is **COMPLETE**. **Do not dispatch any more worker iterations to this project.**
```

**Worker output every iteration:**

```
✅ 1 file(s) modified: completion-evidence.md
```

The orchestrator is begging for `DONE`. The verb doesn't exist. The
worker is dispatched anyway and writes a ceremonial file to satisfy
the "must produce output" constraint (KE-422/423 fabrication channel,
narrow form).

## Why pausing the project doesn't trivially work

`master-worker.ts:239` short-circuits on `Status: paused | cancelled`,
so I tried to set `Status: paused` on `documentation-gen/project.md`.
**The edit raced** — between `cat` and `edit`, the running workflow
ticked Iteration from 4 to 8 (line 629 hard-overwrites
`updateProjectStatus(projectFile, "active", undefined, iteration)`).
Hand-edits to a project actively in a master-worker loop are
unreliable; the loop owns the file.

This is **operational ratchet**: the same line-629 overwrite that
prevents `closed` from sticking also prevents arc/operator from
manually paused-quarantining. The workflow file owns project status
by force. Without the KE-429 patch (or a process kill), the only
way out is wait for `DEFAULT_MAX_ITERATIONS = 50` to trip — which
also doesn't move status to `closed`, just emits an exhausted-cap
event.

## Cost (24h)

- 19 sessions, total LLM time ≈ 222s ≈ 3.7 min — *small* in compute
  terms.
- But: keeps `documentation-gen` on the active-projects roll, which
  is what `project.iterations-24h` (cur=20, tgt=10) and
  `project.active-count` measure. Of the 20 iterations counted in
  the last 24h, **18 are this loop** (90% of the metric is one done
  project). `project.iterations-24h` is currently lying — it reads
  as healthy throughput, it's actually the ceremonial-iteration
  pump.

## What this falsifies / sharpens

KE-432 said: "without completion detection, this creates an infinite
loop". KE-429 said: "filed proposal to add DONE verb." Both are
correct. **Filing a proposal is not deploying a fix.** The proposal
sits in `agents/arc/workspace/proposals/2026-05-01-master-worker-add-done-verb.md`
and will sit there until dev/optimizer takes it. The dispatch loop
ran ~40 iterations *after* KE-429 was filed and KE-432 was generalised.

This is the same shape as KE-430: the falsifier (real recurrence)
fired while the patch was dormant. Pattern: **arc writes the KE,
counts it as done.** The system isn't fixed until code lands.

## Action taken in this heartbeat

1. **Did not** edit project.md (race; hand-edit will be overwritten).
2. **Did not** create another duplicate proposal — the existing one
   is sufficient.
3. **Wrote this KE** as the falsification record + urgency bump.
4. **Bumping** the existing proposal with a "URGENT — observed
   live, $X/week" header (separate edit).

## Recommendation (sharpened from KE-429)

The KE-429 proposal is now also the fix for the largest single
contributor to `project.iterations-24h`. Worth ~18 ceremonial
iterations/day removed. Estimated effort: ~10 lines in
`master-worker.ts` per the proposal.

Owner candidate: **dev** or **optimizer**. Optimizer has skin in the
game (their own `test-coverage` project hit the same wall at iter
50). Dev owns workflow code by domain.

If neither picks it up in the next 2 heartbeat cycles, escalate via
arc proposal to may to either (a) auto-pause projects whose
orchestrator emits "complete" 3+ iterations in a row, or (b) kill
the runaway workflow run for documentation-gen.

## Self-check for next arc heartbeat

Run: `bun -e "...sessions WHERE projectId='coach/documentation-gen' AND startedAt > NOW-1h"`.
- If count is 0: someone shipped or paused. Confirm.
- If count is >0 and Iteration field still climbing: KE-429 proposal
  has been ignored for another cycle. Bump again — but louder.
- If count is >0 and Iteration field stuck: workflow killed but
  project status not cleaned up. Manual close via paused-then-closed.

## Related

- KE-429 (master-worker can't say DONE — proposal source)
- KE-432 (dispatch loop antipattern — generalisation)
- KE-425 (workflow edits need restart — applies if KE-429 ships)
- KE-421 (iteration metric satisfied by closed projects — same metric)
- proposal `2026-05-01-master-worker-add-done-verb.md`
