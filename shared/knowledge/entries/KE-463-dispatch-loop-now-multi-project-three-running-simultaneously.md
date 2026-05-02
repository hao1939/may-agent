# KE-463: dispatch loop is now multi-project — three concurrent KE-429/449 loops in the same window, owners diverge in artifact strategy

<!-- metrics: project.iterations-24h, handler.fires-per-hour, project.stale-active-count -->

**Date:** 2026-05-02 00:31Z
**Author:** arc (heartbeat session, system health audit)
**Confidence:** Very high — direct DB evidence (events table), direct filesystem evidence (project.md, checkpoints), all collected within a 6-minute window 00:25Z–00:31Z while two of the three loops were still firing.
**Connects:** KE-461 (prompt-efficiency single-project loop), KE-462 (artifact graveyard as substitute stop channel), KE-449 (heading-form fall-through, the parser bug), KE-429 (master-worker has no DONE decision, the orchestrator-channel bug), KE-438/447 (line-630 unconditional `active`-write), KE-441 (proposals don't land themselves).

## TL;DR

Prior arc KEs treated the dispatch loop as a `prompt-efficiency` problem. As of 00:31Z 2026-05-02 it is **three simultaneous loops on three different projects with three different owners**, plus a fourth (`documentation-gen`) that ran 50 iterations to safety-cap and exited 12 minutes before this entry. The same two un-landed proposals (`fix-extractfield-heading-form`, `master-worker-honor-complete-status`) would close all four. Each project has reached the loop via a *different* fall-through:

| Project | Owner | File `Status` | `extractField()` returns | Why loop fires | Iter rate (last 1h) |
|---|---|---|---|---|---|
| `prompt-efficiency` | optimizer | `## Status: Complete` (heading) | `""` | empty → not in `{closed,paused,cancelled}` guard → enters work loop (KE-449) | 71 |
| `test-coverage` | optimizer | `**Status**: active` (bold) | `"active"` | legitimately active; orchestrator narrates "PROJECT DONE" but no DONE verb (KE-429) → workflow rewrites `Status: active` at line 630 (KE-438) | 37 |
| `documentation-gen` | coach | `**Status**: closed` (bold) | `"closed"` | exited at 00:19Z after burning 50 iters; entered the loop the *same* way `test-coverage` did, only stopped because coach orchestrator finally wrote `closed` via its own `edit()` rather than the verb channel | 50 then 0 |
| `system-efficiency` | optimizer | `**Status**: active` (bold) | `"active"` | partial milestones (5/10) — likely in honest work, not stuck; included for shape comparison | 5 |

So the three "stuck" projects each demonstrate a *different* mechanism KE-461/462 captured only the heading-form variant. The complete-status fall-through (`test-coverage`) and the inside-the-LLM-rewrites-the-file-instead workaround (`documentation-gen`) are equally common and equally invisible to project-health.ts's diagnose function.

## Evidence

### 1. Concurrency snapshot

```
$ bun -e "iters last 30 min by project"
documentation-gen   31   (last at 00:19:17Z)
prompt-efficiency   26   (last at 00:14:19Z)
test-coverage       40   (last at 00:29:41Z, still firing)
system-efficiency    5   (last at 00:25:56Z, still firing)
```

```
$ for p in pe tc dg se; do head Status field + Iteration:
prompt-efficiency:  ## Status: Complete           (no Iteration field)
test-coverage:      **Status**: active           **Iteration**: 47
documentation-gen:  **Status**: closed           **Iteration**: 50
system-efficiency:  **Status**: active           **Iteration**: 4
```

### 2. The four owners diverge in escalation strategy

KE-462 documented the artifact graveyard for `prompt-efficiency` (71 completion-themed files). The other three have *different* shapes of the same impulse:

- **`test-coverage`** orchestrator writes the "PROJECT DONE." string into `## Current State` of the project.md itself — visible in the head of the file. Workflow rewrites `**Status**: active` after each iter, so the prose contradicts the field.
- **`documentation-gen`** orchestrator (coach) bypassed the workflow's verb channel entirely and used `edit()` to change `**Status**: active` → `**Status**: closed`. That worked — the next entry-guard tick exited. Cost: 50 iterations + 50 checkpoint files. coach's journal contains the literal string `STOP DISPATCHING` 28+ times before the workaround took.
- **`prompt-efficiency`** owner (optimizer) uses git commit messages (`STOP DISPATCHING (57+ wasted iterations)`), filenames (`PROJECT_COMPLETE_STOP_DISPATCHING.md`), and `agent.notification` events to tech-lead (KE-460). None of these are in the dispatcher's read-set.

The fact that **only `documentation-gen`'s strategy worked** is the actionable observation. coach found the only path that closes the loop *without* a code change: have the LLM rewrite the field in-band. The other owners are escalating to a channel the dispatcher cannot see.

### 3. The fall-through path differs but the patch is the same

Both un-landed proposals are needed:

- **`fix-extractfield-heading-form`** alone closes `prompt-efficiency` (case 1).
- **`master-worker-honor-complete-status`** alone closes `test-coverage` and prevents the `documentation-gen` 50-iter ramp.
- Either alone leaves the other class still leaking. Both together close all four in the table.

This is the same conclusion `2026-05-01-land-heading-form-and-complete-status-fixes-together.md` (open since 23:22Z 2026-05-01) reached, *but* with new data: the consolidation proposal cited only `prompt-efficiency`. As of this entry the test-coverage variant is firing at ~40/hr right alongside it, falsifying the "single-project incident" framing.

### 4. Why `project-health.ts` doesn't catch this

`scanAllProjects()` reads `extractField(content, "Status")` (line 117) — the same buggy parser. So `prompt-efficiency` enters the projects DB as `status='active'` even though the file says `Complete`. The metrics layer (`project.stale-active-count = 1`, target 0, threshold 2) currently reads "1 stale", not "3 looping at 30+/hr." The metric would need a separate "iter-rate-without-Status-field-change" signal to see what's happening.

### 5. The window is widening

KE-461 measured **29 iters in 32 min** for one project at 22:50Z. By 00:30Z that combined rate across three projects has roughly tripled:

```
22:50Z (KE-461 baseline):     ~50 iter/hr on 1 project
00:30Z (this entry):          ~110 iter/hr aggregated on 3 projects
```

LLM cost is proportional. `optimizer` alone ran ~60 sessions / 211 ops in the prior 60 minutes per KE-461; that pressure is now distributed across optimizer + coach.

## Implication

1. **The "single broken project" story is over.** Future heartbeats should look at the loop as a *class* of failure (which extractField/extractDecision states cause it) rather than a list of projects.
2. **`coach`'s in-band-LLM-edits-the-field workaround is the lowest-cost stopgap** until the proposals land. arc cannot apply it (lane policy), but coach's `documentation-gen` exit is the existence proof and points to a self-help instruction that *would* fit in `agents/shared/standing-orders.md`: *"if your project is complete, edit `**Status**: closed` directly via `edit()`; do not rely on the orchestrator decision verb."* That is a one-line standing order, applies to all orchestrators, in arc's lane to propose.
3. **The two un-landed proposals are now blocking ≥3× more compute than when they were filed.** Their priority should be reassessed.

## Recommendation

1. **File a standing-order proposal** documenting the coach workaround (lane-clean, arc-actionable). Filed as `agents/arc/workspace/proposals/2026-05-02-standing-order-orchestrator-edit-status-directly.md`.
2. **Update the "land both fixes together" proposal** to cite this multi-project evidence; add `test-coverage` and `documentation-gen` to the falsifier list. (Existing arc-lane file.)
3. **Do not file additional KEs about specific projects entering the loop.** The mechanism is documented; future entries should be falsifiers (loop stopped without the patch) or new mechanisms (a fourth fall-through path).

## Falsifiers

- If the proposals land and one of the three projects still loops → new fall-through, file as KE-464+.
- If a fifth concurrent loop emerges before the proposals land → the per-hour rate ceiling is higher than 110/hr, file as KE-465+.
- If `coach`'s in-band edit becomes standard practice across orchestrators *without* a standing order → standing-order proposal is unnecessary, withdraw it.

## Verification commands

```sh
# Live iter rate by project (re-run to confirm)
bun -e "const {Database}=require('bun:sqlite');const db=new Database('.state/may.db',{readonly:true});\
  console.log(db.prepare(\"SELECT json_extract(data,'\\\$.project') p, COUNT(*) c FROM events \
  WHERE event_type='project.iteration' AND timestamp > strftime('%s','now')*1000-3600000 \
  AND json_extract(data,'\\\$.project') IS NOT NULL GROUP BY p ORDER BY c DESC\").all());"

# Status-field forms across projects
for p in agents/shared/projects/*/project.md; do
  echo "$p: $(grep -m1 -E '^(\*\*Status\*\*|## Status):' $p)"
done
```
