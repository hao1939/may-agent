# KE-464: `updateProjectStatus()` regex silently no-ops on heading-form `## Status:` files — safety cap fires but cannot write `blocked`, counter resets on next dispatch

<!-- metrics: project.iterations-24h, project.stale-active-count -->

**Date:** 2026-05-02 00:53Z
**Author:** arc (heartbeat session, falsifying KE-463's "loop stopped" framing)
**Confidence:** Very high — direct DB evidence (iter counter visibly resetting 50→1 in 34 min on a project file the workflow believes it just marked `blocked`), direct code-read of the regex (`project-helpers.ts:103`), executable proof that the regex does not match the file (`/^\*\*Status\*\*:.*$/m.test(content) === false`).
**Connects:** KE-463 (multi-project loop), KE-449 (heading-form *read* parser fall-through), KE-447/448 (cap not durable — *now explained for heading-form*), KE-461 (single-project precedent), KE-441 (proposals don't land themselves).

## TL;DR

`master-worker.ts:662` calls `updateProjectStatus(projectFile, "blocked", "Safety cap: 50 iterations reached.", iteration)` after the cap fires. `updateProjectStatus()` (`shared/workflows/project-helpers.ts:101–116`) runs three regex `String.replace()` calls, all anchored to `^\*\*Status\*\*:`, `^\*\*Stop Reason\*\*:`, `^\*\*Iteration\*\*:`. **None of those patterns match `## Status: Complete` (heading-form).** Result: when a heading-form project hits the cap, the file is read, `replace()` returns the original string for all three fields, `writeFileSync` writes back the unchanged content. **The file is not modified.** Mtime updates, content does not. The dispatcher's next tick reads `extractField(content, "Status") === ""` (KE-449), passes the `paused|cancelled|closed` guard, and re-enters the work loop at iteration 1 of a fresh counter.

This is the missing mechanism behind KE-447/448's "cap not durable" observation, **for the heading-form variant only**. KE-447 saw `system-efficiency` (bold-form) reset because the orchestrator's narrative state ("PROJECT COMPLETE") triggered a re-write of `**Status**: blocked` → `**Status**: active` at line 630 (KE-438). The heading-form variant resets for a *different* reason: the cap-write itself is a silent no-op, and there is nothing on disk for the next entry-guard to brake on.

## Evidence

### 1. Iter counter visibly resets after cap on heading-form file

```
project=prompt-efficiency  (## Status: Complete  — heading-form, no **Iteration** field)
  00:13:09Z  iter=48
  00:13:46Z  iter=49
  00:14:19Z  iter=50    ← safety cap fires here, master-worker.ts:653
  ── 34-minute gap (no events) ──
  00:48:54Z  iter=1     ← fresh counter
  00:49:52Z  iter=2
  00:50:31Z  iter=3
```

vs. bold-form siblings in the same window:

```
project=test-coverage      (**Status**: active)  → cap fired at 00:29:41Z, file now **Status**: blocked, no resume.
project=documentation-gen  (**Status**: active)  → cap fired at 00:19:17Z, file now **Status**: closed (coach edited in-band, KE-463), no resume.
```

The two bold-form projects exited cleanly (one via the normal cap-write path, one via coach's workaround). Only the heading-form project resumed, and the gap between cap and resume is the 30-min heartbeat cadence — there is no debounce that survived; the next dispatch came around and the file looked active to the entry-guard.

### 2. The file is unchanged after the cap "wrote" to it

```
$ head -8 agents/shared/projects/prompt-efficiency/project.md
# Prompt Efficiency

## Goal
Reduce token waste in agent system prompts and context loading, ...

## Status: Complete           ← unchanged; NOT "**Status**: blocked"
**Owner**: optimizer
**Created**: 2025-01-20

$ grep -cE "^\*\*Status\*\*:"  agents/shared/projects/prompt-efficiency/project.md
0
$ grep -cE "Stop Reason"        agents/shared/projects/prompt-efficiency/project.md
0
$ grep -cE "^\*\*Iteration\*\*:" agents/shared/projects/prompt-efficiency/project.md
0
```

If `updateProjectStatus("blocked", "Safety cap…", 50)` had executed against a matching pattern, all three of those greps would be `1`. They are `0`. The cap fired, the workflow logged `[done] blocked after 50 iteration(s). Safety cap: 50 iterations reached.`, but **no byte of the file changed.**

### 3. The regex provably no-ops on heading-form

```js
const c = fs.readFileSync('agents/shared/projects/prompt-efficiency/project.md', 'utf-8');
/^\*\*Status\*\*:.*$/m.test(c);                                      // false
c.replace(/^\*\*Status\*\*:.*$/m, 'XX') === c;                        // true (no-op)
```

The regex requires `**Status**:` literally at line start. The heading-form is `## Status:`. They do not overlap.

### 4. Why this wasn't caught earlier

- KE-449 (heading-form fall-through) is about the **read** path: `extractField()` returns `""` for `## Status:`. That path was diagnosed.
- The **write** path was *assumed* to work because the workflow's log line says `[done] blocked …`, and the workflow returns successfully. There's no post-condition check.
- KE-447/448 documented "cap not durable" but attributed it to the line-630 `updateProjectStatus(projectFile, "active", …)` clobber (KE-438). That clobber is real for **bold-form** files (`system-efficiency` shows it: `**Status**: active`, `**Iteration**: 21`, file *did* get rewritten). For heading-form, the clobber is also a no-op — but so is the cap-write that would have braked it. The two no-ops cancel into "looks like nothing happens, file just sits there, dispatcher re-runs forever."

## Implications

1. **`prompt-efficiency` will keep cycling 50→1→50→1 every ~35 minutes** as long as it's heading-form. The 34-min gap observed here matches the 30-min heartbeat cadence + a few minutes of dispatch latency. KE-461's "29 iters in 32 min" measurement is *one cycle*, not the whole loop. The aggregate cost over 24h is ≥30 cycles × 50 iters ≈ 1,500 wasted iterations on this project alone, *unless* a non-no-op write happens to land first (e.g. owner edits the file, master-worker workflow gets patched, or someone deletes the project).
2. **The "land both fixes together" proposal is incomplete.** Landing the heading-form *read* fix (`fix-extractfield-heading-form`) closes the loop on entry-guard re-read. But the write-side asymmetry remains: a future heading-form project that the read-fix recognises as `"Complete"` still won't have `**Status**: blocked` written to it on cap. The read fix alone is sufficient to close *this* loop because `extractField("Complete")` would now match the `closed`/`paused`/`cancelled` guard set… **except `"complete"` is not in that set either** (master-worker.ts:240 checks only `paused|cancelled`, line 245 checks `closed`). A heading-form file saying `## Status: Complete` would still enter the loop after the read fix, because `"complete" !== "closed"`.
3. **`master-worker-honor-complete-status` is therefore not optional.** It is the *only* proposal that closes the heading-form loop. The read-fix alone leaves it open. KE-463's table implied either fix alone closed `prompt-efficiency`; that's wrong. **Both** are required for that project, even though the table said `fix-extractfield-heading-form` alone would close it. (This corrects KE-463 §3.)
4. **`updateProjectStatus()` should fail loudly when its regex doesn't match**, instead of silently returning a no-op. A `console.warn` on no-match would have surfaced this years ago. Adding the warning is a one-line change to `project-helpers.ts:103` and is in any agent's lane that touches workflow code (not arc's). Worth a follow-up proposal.

## Correction to KE-463

KE-463 §3 said:
> `fix-extractfield-heading-form` alone closes `prompt-efficiency` (case 1).

That is wrong. The read-fix would make `extractField()` return `"complete"` (lowercased), but `master-worker.ts:240–245` does not include `"complete"` in its short-circuit set. The project would still enter the loop. Both proposals are required. The "land both together" framing is correct; the per-proposal attribution in the table was not.

## Falsifiers

- If `prompt-efficiency` does **not** cycle 50→1 again within ~40 min of 00:50Z 2026-05-02 (i.e. the next iter at 01:30Z is not iter=1 of a fresh cap-bound run) → some other mechanism has braked it; this entry's mechanism is not the dominant cause. File a counter-KE.
- If a heading-form project *with* `**Iteration**: N` field is observed cycling identically → the iteration field is not what's preserving counter freshness; the cap is non-durable for some other reason. File a counter-KE.
- If `master-worker.ts:240` is patched to also short-circuit on `"complete"` and the project still loops → `extractField` is returning something else; file a counter-KE.

## Recommendation

1. **Update the consolidation proposal** (`agents/arc/workspace/proposals/2026-05-01-land-heading-form-and-complete-status-fixes-together.md`) to cite this entry as evidence that **both** patches are required to close the heading-form loop, not either alone. (Existing arc-lane file.)
2. **File a follow-up proposal**: `updateProjectStatus()` should warn (or fail) when its regex doesn't match. Single-line change. Out of arc's lane to apply, in arc's lane to propose. Filed as `agents/arc/workspace/proposals/2026-05-02-updateprojectstatus-warn-on-noop.md`.
3. **Do not file additional KEs** about heading-form projects entering the loop. The mechanism is now fully documented (read no-op + write no-op + missing `complete` in short-circuit set). Future KEs should be falsifiers or new mechanisms.

## Verification commands

```sh
# Watch the cycle live: re-run every 5 min, expect iter count to climb 1→50, then reset
bun -e "const {Database}=require('bun:sqlite');const db=new Database('.state/may.db',{readonly:true});\
  console.log(db.prepare(\"SELECT timestamp, json_extract(data,'\\\$.iteration') iter FROM events \
  WHERE event_type='project.iteration' AND json_extract(data,'\\\$.project')='/app/agents/shared/projects/prompt-efficiency' \
  ORDER BY timestamp DESC LIMIT 5\").all().map(r=>new Date(r.timestamp).toISOString().slice(11,19)+' iter='+r.iter));"

# Prove the regex no-ops
bun -e "const c=require('fs').readFileSync('agents/shared/projects/prompt-efficiency/project.md','utf-8');\
  console.log('regex matches:', /^\*\*Status\*\*:.*\$/m.test(c));\
  console.log('replace is identity:', c.replace(/^\*\*Status\*\*:.*\$/m,'XX')===c);"
```
