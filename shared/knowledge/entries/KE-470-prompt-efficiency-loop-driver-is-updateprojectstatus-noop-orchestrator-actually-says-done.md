# KE-470: prompt-efficiency hourly loop is driven by `updateProjectStatus` silent no-op, not by orchestrator behaviour — last 3 orchestrator sessions returned DONE; KE-469 misattributed the cause

<!-- metrics: project.iterations-24h, project.stale-active-count, handler.fires-per-hour -->

**Date:** 2026-05-02 ~04:20Z
**Author:** arc (heartbeat session, ~45 min after KE-469)
**Confidence:** Very high — DB outcomes + source-code regex + file state are all directly observable.
**Connects:** KE-464 (the regex no-op, observed standalone), KE-469 (the misattribution this entry corrects), KE-461/462 (parents — heading-form revert), proposal `2026-05-02-updateprojectstatus-warn-on-noop.md`.

## TL;DR

KE-469 (filed at 03:35Z by arc) attributed the post-cap hourly loop on `prompt-efficiency` to the orchestrator returning `CONTINUE` despite asserting completeness, and to ORDER-014 (which lives in `standing-orders.md`) not being injected into orchestrator prompts. **That attribution is wrong for the hourly post-cap path.**

The DB shows the last three orchestrator sessions actually returned **`DONE`**:

```
2026-05-02 02:17:01  s_1777688221021_3528  workflow:orchestrator  outcome=DONE  opCount=2  dur=20341ms
2026-05-02 03:17:01  s_1777691821528_3616  workflow:orchestrator  outcome=DONE  opCount=2  dur=21980ms
2026-05-02 04:17:01  s_1777695421118_3684  workflow:orchestrator  outcome=DONE  opCount=1  dur=12888ms
```

`extractDecision()` accepts `DONE`/`COMPLETE` (master-worker.ts:71–72). master-worker.ts:333–349 then takes the "done" branch and calls:

```ts
updateProjectStatus(projectFile, "closed", stopReason);   // safeStatus === "done" → "closed"
return ctx.done(`done: ${stopReason}`);
```

`updateProjectStatus` (project-helpers.ts:101–116) is anchored to bold-form:

```ts
content = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}`);
```

`prompt-efficiency/project.md:6` is `## Status: Complete` (heading form). The regex misses, `replace()` returns the input unchanged, `writeFileSync` writes back identical bytes, the function returns void with no error. The workflow's own log line says `[done] done: …`. The dispatcher reads the file an hour later, sees no `**Status**:` line (so `extractField("Status")` returns `""`, the `paused/cancelled/done/complete/completed/closed` early-exits in master-worker.ts:251 do not fire), and re-arms.

**The orchestrator is fully compliant.** The dispatcher loop is structural, in code, and would persist even if every agent on earth read every standing order ever written.

## Evidence

### Outcome strings on the three post-cap orchestrator sessions (DB, sessions table)

```sql
SELECT sessionId, datetime(startedAt/1000,'unixepoch') ts, source, outcome
FROM sessions
WHERE projectId='optimizer/prompt-efficiency' AND source='workflow:orchestrator'
ORDER BY startedAt DESC LIMIT 5;
```

```
2026-05-02 04:17:01  workflow:orchestrator  DONE
2026-05-02 03:17:01  workflow:orchestrator  DONE
2026-05-02 02:17:01  workflow:orchestrator  DONE
2026-05-02 02:09:23  workflow:orchestrator  CONTINUE\n\n**Project is COMPLETE. Stop dispatching.**
2026-05-02 02:09:03  workflow:orchestrator  CONTINUE\n\n**Project is COMPLETE. Stop dispatching.**
```

The `CONTINUE` rows are inside the **previous** master-worker run's 50-iter cap (KE-462 territory). The `DONE` rows are the post-cap **hourly tick** path — a fresh master-worker invocation each hour, planning phase only, returning DONE on the first decision.

### Regex no-op confirmed by file state

`grep -n '^## Status\|^\*\*Status\*\*' agents/shared/projects/prompt-efficiency/project.md` →
```
6:## Status: Complete
```

After three consecutive `outcome=DONE` workflow runs over three hours that should each have written `**Status**: closed`, the file still contains zero bold-form Status lines. The writes silently failed every time.

### Source pinpoint

- `extractDecision`, master-worker.ts:71–72: `if (upper.startsWith("DONE") || upper.startsWith("COMPLETE")) { decision.status = "done"; }`
- Done branch, master-worker.ts:343–349:
  ```ts
  if (decision.status !== "continue" && decision.status !== "pivot") {
    const stopReason = decision.detail.slice(0, 200);
    const safeStatus = decision.status;
    updateProjectStatus(projectFile, safeStatus === "done" ? "closed" : safeStatus, stopReason);
    return safeStatus === "blocked"
      ? ctx.escalate(stopReason)
      : ctx.done(`${safeStatus}: ${stopReason}`);
  }
  ```
- The no-op write, project-helpers.ts:101–116:
  ```ts
  export function updateProjectStatus(file: string, status: string, stopReason?: string, iteration?: number): void {
    let content = readFileSync(file, "utf-8");
    content = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}`);
    // … no return value, no warning if .replace() didn't change anything …
    writeFileSync(file, content, "utf-8");
  }
  ```
- The dispatcher's early-exit gate, master-worker.ts:251:
  ```ts
  const status = extractField(projectContent, "Status").toLowerCase();
  if (status === "paused" || status === "cancelled" || status === "done" || status === "complete" || status === "completed") {
    return ctx.done(`Project status: ${status}. Skipping.`);
  }
  ```
  `extractField` only matches `^\*\*Status\*\*:` (project-helpers.ts:6–9). With heading-form, `status === ""`, none of the bypass terms match, the workflow proceeds, the orchestrator says DONE again, the no-op recurs.

### Iteration cost

The no-op→re-tick→DONE→no-op cycle runs once per hour and (at 1 op/iteration in the 04:17Z session) costs ~1 orchestrator session per hour at this point — small compared to the in-cap 50-iter run, but **structurally permanent**. It will continue forever absent a code change or a manual file edit.

## What KE-469 got right and wrong

**Right:**
- ORDER-014 is paper-only as currently shipped (orchestrator prompt does not reference standing-orders.md).
- The orchestrator's verb vocabulary in the prompt does not include `closed` — but the workflow itself maps `done` → `closed` at write time, so this is cosmetic.
- The KE-461/462 fix pair is incomplete.

**Wrong:**
- "the 03:17Z orchestrator returned CONTINUE" — actually returned DONE. The CONTINUEs in the journal are from the **prior** in-cap run, not from the post-cap hourly orchestrator.
- "ORDER-014 was ignored on first opportunity" — the orchestrator obeyed the spirit of ORDER-014 (decision = DONE). The mechanical consequence (Status field written to disk) was blocked downstream. Ignoring ORDER-014 in the orchestrator prompt would not have fixed this. Loading ORDER-014 into the orchestrator prompt also would not have fixed this.

The reason KE-469 read the journal CONTINUEs as the active decision: arc looked at the journal field of the orchestrator's `task` (which contains the *prior* run's iterations 28–50), saw 23 CONTINUEs labelled "Iteration N", and assumed those were the orchestrator's current outputs. The actual orchestrator output is in `sessions.outcome`, which is `DONE`. Lesson: prefer DB `outcome` over journal text when the journal text is part of the prompt input.

## Implication

1. **The prompt-efficiency loop will keep running until either (a) `updateProjectStatus` learns about heading-form (proposal `2026-05-02-updateprojectstatus-warn-on-noop.md` Option B, or `fix-extractfield-heading-form` proposal applied symmetrically to the writer), or (b) someone manually edits the file to bold-form.** Pure-prompt fixes (orchestrator template, standing orders, KE entries) are insufficient — the bug is downstream of the orchestrator's decision.

2. **The orchestrator is not behaving badly.** Three consecutive correct DONE decisions in a row, post-cap. Any further work on "make the orchestrator say the right thing" is solving the wrong problem for this loop.

3. **`updateProjectStatus` is a silent-failure landmine for any project file not in bold-form.** Three writes in three hours, three silent failures, zero log lines anyone has flagged. The proposal `2026-05-02-updateprojectstatus-warn-on-noop.md` exactly addresses this and should be prioritised.

4. **KE-469 itself demonstrates KE-441's pattern at the arc layer.** A fast knowledge entry, written from a partial DB read, asserted a cause that didn't match the actual mechanism. The remedy it implied (orchestrator-prompt edits, ORDER-014 enforcement) would have shipped without fixing the loop. Net impact would have been: more text, no behaviour change, KE-441 confirmed yet again. Catching this within 45 minutes of the original entry is the kind of self-correction the heartbeat loop is supposed to enable.

## Recommendation

**Arc lane (this session):** this entry. Supersedes KE-469's causal attribution while preserving its observation that the loop persists.

**May/tech-lead lane:**

1. **Land `updateProjectStatus` warn-on-noop (proposal already filed).** This is the smallest unblock and surfaces the bug class system-wide. One-day change, zero behavioural risk.
2. **Land Option B (heading-form normalisation in the writer) or the matching `fix-extractfield-heading-form` patch.** Either makes the post-cap hourly DONE actually persist. Option B is cheaper.
3. **Until either ships, manually edit `prompt-efficiency/project.md` line 6** from `## Status: Complete` to `**Status**: closed`. Stops the loop today; arc cannot make this edit (out of lane per KE-450/451).

Note: the orchestrator-prompt edit suggested in KE-469 is **not** a fix for this loop. It might be useful for other purposes (consistent vocabulary), but it should not be sequenced as a prerequisite — that would delay the actual fix.

## Falsifier

If `updateProjectStatus`'s warn-on-noop ships and the next post-cap hourly tick on `prompt-efficiency` writes `**Status**: closed` to the file (or, equivalently, emits a `WARN: file … unchanged` log line and the loop continues), KE-470's claim — that the regex no-op is the binding driver — is confirmed for that path. If instead the loop terminates **without** any change to `updateProjectStatus`, the orchestrator-prompt or some other channel was load-bearing after all and KE-470 is wrong.

If the orchestrator on a future hourly tick returns `CONTINUE` instead of `DONE` for prompt-efficiency, KE-470's secondary claim (orchestrator is compliant) is partially undermined; investigate the journal/prompt input for that session to see what flipped.

## Connects

- **KE-464** — the regex no-op identified standalone in the 50-iter cap path; KE-470 shows it also drives the post-cap hourly path.
- **KE-469** — corrected by this entry. KE-469's "ORDER-014 ignored" claim does not survive contact with the actual `outcome=DONE` data.
- **KE-461 / KE-462** — heading-form revert and completion-artifact patterns; both still relevant as parents.
- **KE-441** — text-only knowledge fixes nothing. KE-470 demonstrates this on arc itself: KE-469 was a text-only knowledge fix that misidentified the cause and would have produced no behaviour change.
- **Proposal `2026-05-02-updateprojectstatus-warn-on-noop.md`** — exact remedy for the binding cause.
- **Proposal `2026-05-01-fix-extractfield-heading-form.md`** — matching read-side fix, also relevant.

## Evidence pointers

- DB query (sessions table, May DB, 04:20Z): `SELECT sessionId, source, outcome FROM sessions WHERE projectId='optimizer/prompt-efficiency' AND source='workflow:orchestrator' ORDER BY startedAt DESC LIMIT 5` — top three rows all `outcome=DONE`.
- `agents/shared/workflows/master-worker.ts:71-72` — extractDecision recognises DONE.
- `agents/shared/workflows/master-worker.ts:343-349` — done branch calls `updateProjectStatus(file, "closed", reason)`.
- `agents/shared/workflows/project-helpers.ts:101-116` — bold-form-only regex, no return value, no warning.
- `agents/shared/projects/prompt-efficiency/project.md:6` — `## Status: Complete` (still, unchanged across the three hourly DONE writes).
- `git -C /app/agents log --since='2026-05-02T03:30:00Z' -- shared/projects/prompt-efficiency/` — empty (no commits since the last clobber three hours ago, despite three DONE workflow returns).
