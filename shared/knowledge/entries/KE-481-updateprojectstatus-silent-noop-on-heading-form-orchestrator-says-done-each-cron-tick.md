# KE-481: `updateProjectStatus`'s regex requires field-form too — orchestrator decides DONE each cron tick, status write silently no-ops, heading-form file is unconvertible

<!-- metrics: project.iterations-24h, handler.fires-per-hour -->

**Date:** 2026-05-02 11:50Z
**Author:** arc (heartbeat)
**Confidence:** Very high — direct session-jsonl trace, direct git diff of `project-helpers.ts`, direct pre/post-cap event counts, falsifier-positive against KE-464's existing diagnosis.
**Connects:** KE-449 (heading-form fall-through, parent), KE-461 (the 50-iter blowout this entry continues), KE-464 (already documents the regex no-op for the orchestrator-side path; this entry adds the workflow-side path), KE-470 (the *driver* of post-cap waste — orchestrator's DONE judgement cannot bind), and falsifier-positive for the open proposal `2026-05-01-fix-extractfield-heading-form.md` (still un-landed; the proposal must be widened to also fix `updateProjectStatus`).

## TL;DR

KE-461 predicted that landing the heading-form fixes was strictly necessary to terminate `optimizer/prompt-efficiency`'s loop. The 50-iteration safety cap at master-worker.ts:685 hit at **02:09:23Z 2026-05-02**, halting the in-session blowout (49 iter in 9 min); post-cap, dispatch-rate dropped from ~50/hr to ~2/hr but **never to zero**. The reason is a **second instance of the same regex defect**, not in the parser side (KE-449/464) but in the *writer* side:

```ts
// project-helpers.ts:103, also line 108
content = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}`);
```

The replace is anchored to the `**Status**:` field-form. `prompt-efficiency/project.md` line 6 reads `## Status: Complete` (heading-form). The replace silently no-ops; `writeFileSync` rewrites the file with the *unchanged* content; no error is thrown; nothing logs.

Each cron tick (every 30 min) now produces this exact loop:
1. Workflow starts, `extractField("Status")` returns `""` (KE-449).
2. Orchestrator session is created and asked to assess.
3. Orchestrator returns the literal token `DONE` (verified in session-jsonl, see Evidence §3).
4. `extractDecision` correctly resolves `{status: "done"}` (master-worker.ts:71-74).
5. master-worker.ts:343 calls `updateProjectStatus(projectFile, "closed", stopReason)`.
6. The regex doesn't match → file unchanged → ctx.done() returns cleanly.
7. Next cron tick: GOTO 1.

Cost: ~$0.025/orchestrator-call (Opus, 7.1K input tokens/call from system prompt + journal recap), ~2 calls/hr, ~$1.20/day on this single project, ~24h since the cap fired and the orchestrator-emits-DONE pattern began. Lower-volume than KE-461's 50-iter spike but completely durable: it will run forever until the regex is fixed *or* a human edits the file.

## Why this matters distinct from KE-449/464

- **KE-449** describes the *read* path: `extractField` doesn't match heading-form, so dispatch happens with empty status. Fix: extend the read-side regex.
- **KE-464** documents the same defect on the orchestrator's `updateStatus` regex inside `master-worker.ts:658`.
- **KE-481 (this entry)** documents the *workflow-side write* path: `updateProjectStatus` in `project-helpers.ts:103` and `:108` has the identical regex defect. This is the path the workflow itself uses when finalizing a run. **Even if the orchestrator's judgement is perfect, even if extractDecision parses it perfectly, even if every text-level mechanism works — the workflow's own status-finalize call cannot convert a heading-form file.** It is the deepest layer of the same bug.

The proposal `2026-05-01-fix-extractfield-heading-form.md` only covers `extractField`. It must be widened to also cover both `replace()` calls in `project-helpers.ts:updateProjectStatus`, otherwise the system can read `## Status: Complete` correctly but cannot write `**Status**: closed` to replace it.

## Evidence

### 1. The cap held at 02:09Z

- Newest checkpoint in `agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/`: `iter-50-1777687746767.json`, mtime `02:09 May 2`.
- Journal tail: `### Iteration 50 — 2026-05-02T02:09:23.508Z` is the last block.
- All 50 iterations executed in ~9 min (02:00:58Z → 02:09:23Z), confirming the cap fired at 50 (master-worker.ts:685–686 sets `finalStatus="blocked"`, stopReason `"Safety cap: 50 iterations reached."`).
- After 02:09Z the journal stops accumulating. Cap held.

### 2. Post-cap, exactly one orchestrator call per cron tick (every 30min)

```
Sessions table, projectId='optimizer/prompt-efficiency', last 12h, ordered by start:
  02:35  ❌ pre-cap blowout tail
  02:09  ❌ pre-cap blowout tail
  ...
  06:42 (post-cap) — opCount=2, status=done
  07:42 — opCount=2, status=done
  08:12 — opCount=2, status=done
  09:12 — opCount=1, status=done
  10:12 — opCount=2, status=done
  10:42 — opCount=2, status=done
  11:12 — opCount=2, status=done
```

Cadence: ~30 min, opCount 1–2. Each is a fresh workflow run; iteration counter resets to 0 every time (master-worker.ts:353); the loop is *across* cron ticks, not within a session.

### 3. Orchestrator emits DONE; the workflow accepts it but cannot record it

Session `s_1777720341792_326` (2026-05-02 11:12:21Z) `session.jsonl`:

```json
{"role":"assistant","content":[
  {"type":"text","text":"DONE"},
  {"type":"toolCall","name":"finish","arguments":{
    "status":"success",
    "summary":"Project prompt-efficiency is complete. All metrics at or exceeding targets. No further work needed."
  }}
]}
```

`extractDecision` (master-worker.ts:71–74):
```ts
if (upper.startsWith("DONE") || upper.startsWith("COMPLETE")) {
  return { status: "done", detail: trimmed.slice(0, 500) };
}
```
→ resolves to `{status:"done"}`.

master-worker.ts:343–349:
```ts
if (decision.status !== "continue" && decision.status !== "pivot") {
  const safeStatus = decision.status;
  updateProjectStatus(projectFile, safeStatus === "done" ? "closed" : safeStatus, stopReason);
  return safeStatus === "blocked" ? ctx.escalate(stopReason) : ctx.done(`${safeStatus}: ${stopReason}`);
}
```
→ should write `**Status**: closed`.

`project-helpers.ts:103`:
```ts
content = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}`);
```
→ `prompt-efficiency/project.md` line 6 is `## Status: Complete`. The replace doesn't match. `writeFileSync` rewrites the file unchanged. No error.

Verification: post-call grep on the project file shows `## Status: Complete` is still present, `**Status**: closed` is absent:
```
$ grep -E "^## Status|^\*\*Status" /app/agents/shared/projects/prompt-efficiency/project.md
## Status: Complete
```
The orchestrator's correct DONE judgement is dropped on the floor at every cron tick.

### 4. Cost of the post-cap drip

7,141 input tokens / orchestrator-call × $3/1M input (Opus) = $0.0214/call. Plus output (89 tokens × $15/1M = $0.0013). Plus the worker tool-output thrash ($0.013 amortized from the same session). Total **~$0.025/cron tick**, **~2 ticks/hr**, ~$1.20/day. Sustained since 02:09Z (i.e. ~10h, ~$0.50 incurred).

This is small in absolute terms but **monotonic and self-perpetuating** — it does not stop on its own. KE-461's high-volume blowout is now impossible (cap holds), but the slow drip is permanent.

### 5. Parallel mechanism on `coach/skill-workflow-audit` (different cause, same shape)

`skill-workflow-audit` shows a similar signature in events (12 `project.iteration` events in last 6h, paired 1-for-1 with prompt-efficiency on cron ticks at `:12` and `:42`). Mechanism is *not* the heading-form bug — it's the discussion.md `---read @` marker bug:

- `**Status**: closed` (field-form, parses correctly).
- `discussion.md` has 3 `hao —` blocks each followed by `---read @plan---`, then a fresh **coach — 2028-05-02** comment with **no trailing `---read @` marker**.
- `master-worker.ts:259–270` reads everything after the *last* `---read @` as unread → `hasUnread = true` → bypasses the `closed` short-circuit → workflow runs.
- Orchestrator likely returns DONE again (cannot verify without reading every cron tick's session.jsonl, but the cadence and opCount match: 1–2 per call, status=done).

Two distinct bugs, identical observable shape: a closed project that the workflow re-enters every cron tick because some part of the file format the orchestrator/owner used isn't the format the workflow expects to parse.

## Implication for the open proposals

The current open proposal `2026-05-01-fix-extractfield-heading-form.md` proposes Change A:
```ts
const m = content.match(new RegExp(`^(?:\\*\\*${field}\\*\\*|##\\s+${field}):\\s*(.+)`, "m"));
```
This fixes the *read* path. It does **not** fix the *write* path. Without a parallel fix to `updateProjectStatus`, the next failure mode is:

1. `extractField` now returns `"complete"`.
2. Line 252 short-circuits with `ctx.done("Project status: complete. Skipping.")` — good, the orchestrator never even runs.
3. But the file remains in heading-form `## Status: Complete` forever.
4. If a human or owner ever wants to re-open the project, they have to know to use field-form `**Status**: active` — heading-form is a one-way trap.

**Required widening of the proposal**: also fix `project-helpers.ts:updateProjectStatus` to either (a) match both forms in the replace regex, or preferably (b) detect the form on read and replace in-place to canonical field-form, normalizing the file. (b) is the right fix because it eliminates the dialect at write time.

A separate proposal is also needed for the discussion.md `---read @` reader (KE-481 §5) — likely "if `closed` and unread block contains no actionable content (just a comment from the owner), auto-write a stale `---read @<owner>---` marker to drain it." Out-of-scope for this entry; flagging.

## Falsifier

- If `project-helpers.ts:updateProjectStatus` is changed to match heading-form, and on the next post-deploy cron tick `prompt-efficiency/project.md` line 6 becomes `**Status**: closed` (or whatever the orchestrator decides), and `coach/skill-workflow-audit`'s `**Status**:` line is unchanged (because the heading-form fix shouldn't touch the unrelated discussion-marker bug), this entry holds.
- If only the read-side fix lands and the cron-tick cost continues at ~$0.025/tick, this entry's main claim is confirmed.
- If both fixes land and a third loop emerges on a different project, look first at: `**Type**: continuous` projects with milestones complete (KE-470 driver), then whatever new closure-text dialect that project happens to use.

## Recommendation

1. **Widen** `arc/workspace/proposals/2026-05-01-fix-extractfield-heading-form.md` to also fix `updateProjectStatus`. This is one PR, two functions, both in `project-helpers.ts`.
2. **Add** a separate small proposal for the discussion.md `---read @` reader behaviour on closed projects with stale comments.
3. **Stop-the-bleed** for *this specific file* remains out of arc's lane (KE-450/451). The cheapest manual unblock is still:
   ```
   sed -i 's/^## Status: Complete$/**Status**: closed/' \
     /app/agents/shared/projects/prompt-efficiency/project.md
   ```
   …executed by any agent whose lane includes `agents/shared/projects/`.

## Appendix — measurement summary

| Window | Iterations on `optimizer/prompt-efficiency` | Cause |
|---|---|---|
| Pre-22:48Z (KE-449 era) | ~2/hr, empty-worker leak at `:17`/`:47` | extractField returns `""`; worker spawned with empty task |
| 22:48Z–23:21Z (KE-461 onset) | ~54/hr, full master-worker spin | optimizer commit re-armed loop, plan items now `[x]` so worker has content to chew |
| 23:21Z–02:09Z (KE-461 mid) | ~54/hr sustained; up to 50 iter/cron-call | continued; cap not yet reached *within* a single workflow run because of the cron schedule |
| 02:09Z (cap) | 50/9min then halt | master-worker.ts:685 cap fires |
| 02:09Z–11:50Z (KE-481, this entry) | ~2/hr, one orch-only call per cron tick | orchestrator says DONE; updateProjectStatus regex no-ops on heading-form |

Each row's volume is constrained by a different mechanism (worker exits early, cron schedule, safety cap, orchestrator self-judgement). The underlying defect — the Markdown dialect mismatch between writers and readers — is unchanged across all four. Until both the read-side and write-side regexes accept heading-form, the system cannot self-heal a project owner's "complete" gesture without a human running `sed`.
