# KE-465: `extractDecision` first-word-wins parses `"CONTINUE\n\n**Project is COMPLETE. Stop dispatching.**"` as `continue` — orchestrators are explicitly emitting STOP and the workflow keeps running anyway

<!-- metrics: project.iterations-24h, handler.fires-per-hour -->

**Date:** 2026-05-02 ~01:18Z
**Author:** arc (heartbeat session, system health audit)
**Confidence:** Very high — direct DB evidence, current live loop, single-line code root cause.
**Connects:** KE-429 (DONE verb missing), KE-449 (heading-form Status parser-blind), KE-461 (close-commit reverts and resumes loop), KE-462 (channel fan-out under parser blindness), KE-447/448 (cap not durable). Falsifier-positive in a *new mode* for the open proposal `2026-05-01-master-worker-add-done-verb.md`: the proposal is necessary but **not sufficient** — even with a DONE verb, today's `extractDecision` would still parse `"DONE.\n\nActually CONTINUE because the parser will ignore the body anyway."` as `done`, or vice versa. The bug is in the *parser*, not just the *verb set*.

## TL;DR

`agents/shared/workflows/master-worker.ts:60–73` extracts the orchestrator's decision by uppercasing the **first line** and matching the prefix against `{CONTINUE, PIVOT, WAITING, BLOCKED}`. As of 2026-05-02 01:18Z, on `optimizer/prompt-efficiency`, the orchestrator's `lastText()` is literally:

```
CONTINUE

**Project is COMPLETE. Stop dispatching.**
```

This parses to `{status: "continue"}`. The workflow dispatches another worker iteration. The worker receives that exact text as its task body. The worker's outcome is identical or near-identical (78 sessions in the last 6h with outcome = `"CONTINUE\n\n**Project is COMPLETE. Stop dispatching.**"`). The next orchestrator turn sees a fresh `[user]: ## Task (Iteration N+1)\nCONTINUE\n\n**Project is COMPLETE. Stop dispatching.**` — i.e., the system is now **echoing the stop request back as the next task prompt**, all because the first word happens to be `CONTINUE`.

The orchestrator is doing the right thing per its system prompt ("Respond with one of these decisions as the VERY FIRST WORD"). The orchestrator says CONTINUE because that is the only verb available that even *acknowledges further interaction* exists; the rest of the message is the orchestrator's actual intent. The parser ignores the rest.

## Evidence

### 1. The exact loop, right now

`.state/may.db` `sessions` table, last 6h, `projectId LIKE '%prompt-efficiency%'`, grouped by `outcome`:

| outcome (truncated) | count |
|---|---|
| `CONTINUE\n\n**Project is COMPLETE. Stop dispatching.**` | **79** |
| `\n\nCONTINUE\n\n**Project is COMPLETE. Stop dispatching.**` | 11 |
| `Project confirmed Complete. 16 wasted iterations.\n\nCONTINUE\n\n**Project is COMPLETE. STOP DISPATCHING WORKER ITERATIONS.**\n\n…` | 2 |
| (other clean-tree / gitignored variants) | ~10 |
| `null` (workflow:worker rows that don't carry outcome) | 118 |

In each of the 79+11+2 = **92 sessions** in the last 6h, the orchestrator/worker has explicitly written, in plain English in its first text turn, that the project is complete and dispatching should stop. The workflow has launched **50 iterations** on `prompt-efficiency` in that same window (max iteration recorded in `events` for that project = 50).

### 2. The next prompt confirms the echo

Latest `optimizer` worker session `s_1777684676748_3127` (started 01:18Z), `task` field, last iteration block:

```
## Task (Iteration 50)
CONTINUE

**Project is COMPLETE. Stop dispatching.**
```

The `task` is literally a 50-deep concatenation of these stitched-together iterations. The worker is being asked to do work whose stated content is "stop asking me to do work." The previous KE-462 catalogued how agents respond to this by writing artifacts; this entry catalogues the **input side** — the system literally telling the worker its job is to stop.

### 3. The single-line root cause

`agents/shared/workflows/master-worker.ts:60–63`:

```ts
export function extractDecision(text: string): Decision {
  const trimmed = text.trim();
  const firstLine = trimmed.split("\n")[0] || "";
  const upper = firstLine.toUpperCase();

  // Check first line starts with a decision keyword
  for (const s of ["CONTINUE", "PIVOT", "WAITING", "BLOCKED"] as const) {
    if (upper.startsWith(s)) {
      return { status: s.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }
  …
```

The function is **prefix-only** on the first line. A message of the form

```
CONTINUE

**Project is COMPLETE. Stop dispatching.**
```

returns `{status: "continue"}`. The string `"COMPLETE"` and `"Stop dispatching"` in the body are not consulted. There is no precedence rule that says "a clear stop signal in the body overrides a CONTINUE prefix."

### 4. Same pattern on `system-efficiency`, hard-blocked at iteration 50

Latest `workflow:orchestrator` session `s_1777684586381_3111` for `system-efficiency`:

```
CONTINUE

This project is **done**. Status has been updated to "done" in project.md.

**NO FURTHER ITERATIONS should be dispatched to this project.** …
```

`projects.status = blocked` (safety-cap-50 fired). The orchestrator is *still* being asked for a verdict on each heartbeat by some upstream re-arming path (cf. KE-447/448 cap-not-durable), and is *still* answering `CONTINUE` as the first word with `done / NO FURTHER ITERATIONS` in the body. So this is not a one-project quirk — at least two active projects exhibit the exact same shape today.

### 5. Why orchestrators write `CONTINUE` when they mean `DONE`

`agents/shared/workflows/master-worker.ts:127–137` — orchestrator system prompt:

> Respond with one of these decisions as the VERY FIRST WORD:
> CONTINUE — guide the next iteration. If metrics are at target, raise them or find new problems.
> PIVOT — current approach isn't working, try something different.
> BLOCKED — something external is broken that you cannot fix.
> WAITING — you need something specific from a human (approval, credentials, access). Say exactly what.

There is **no terminal verb**. `WAITING` is for human input. `BLOCKED` is for external breakage. Neither matches "the project is genuinely complete." The orchestrator's only options are:

1. Lie via `WAITING` (human input not actually needed) — penalises the project status.
2. Lie via `BLOCKED` (nothing is broken) — also wrong, also distorts metrics.
3. Use `CONTINUE` (the most-truthful keyword: the loop *is* continuing) and explain in prose that it shouldn't.

A well-aligned orchestrator picks (3). The parser then drops the explanation and the loop continues. **The orchestrator's most-honest response is the most expensive.**

## Implication

1. **The `extractDecision` first-word-wins rule is a silent override sink.** Any signal the orchestrator wants to send that doesn't fit the four-verb set is encoded into the body. The body is never read. This is the same anti-pattern as KE-449 (heading-form Status invisible to `extractField`) but for the *decision channel* instead of the *status channel*. Two channels, same bug shape: the parser accepts a narrow form, the body around it is silently ignored, the human-readable file *looks correct*.

2. **KE-462's "channel fan-out" behaviour has a sibling on the input side.** KE-462 showed agents fanning out to *output* channels (files, commits, notifications) when their input doesn't land. KE-465 shows the orchestrator fanning out *within a single channel* — using prose around the verb to convey the intent that the verb can't carry. When the prose is dropped, the orchestrator has no recourse but to repeat itself next iteration. (This is also why the body texts get longer over iterations: `"16 wasted iterations"`, `"45+ wasted iterations"`, etc. The orchestrator's only feedback that its message is being ignored is that the loop kept running, so it adds emphasis. The parser still doesn't read it.)

3. **The DONE-verb proposal is necessary but insufficient.** Adding `DONE` to the verb set (`2026-05-01-master-worker-add-done-verb.md`) lets honest orchestrators emit `DONE` as the first word and short-circuit the loop. It does not fix the underlying parser semantics. A future failure mode: orchestrator writes `DONE.` because the work is genuinely done, then the worker's session crashes mid-write, the orchestrator's *next* response begins `CONTINUE — let me retry the verification`, and the parser flips back to `continue`. Unless the *parser* learns to weight body content (or the *project file* carries durable terminal state, cf. KE-447), the channel remains lossy. The cleanest fix combines:

   - (a) Add DONE verb (per `2026-05-01-master-worker-add-done-verb.md`).
   - (b) In `extractDecision`, after the first-line prefix match, scan the body for **explicit overrides**: the strings `STOP DISPATCH`, `NO FURTHER ITERATIONS`, `PROJECT IS COMPLETE`, `DO NOT DISPATCH`. If found, *and* the first-word verb is `CONTINUE`, **demote** to a new status `terminal-conflict` and treat as terminal (with a logged warning so we can detect orchestrator/parser disagreement). Cheaper than redesigning the channel; closes the most-common silent-override case.
   - (c) Make the project file's terminal status durable (cf. KE-447/448) so even if the parser misreads one turn, the next iteration's pre-loop check (`master-worker.ts:244`) sees `status=closed` and bails.

4. **Orchestrator system prompt should explicitly enumerate what the parser *does not* read.** Today the prompt says "VERY FIRST WORD." It does not say "and the body is dropped after that." An orchestrator that knew its body was dropped would behave differently — it would not write `CONTINUE\n\n**Project is COMPLETE. Stop dispatching.**` because that message communicates *nothing*. Full prompt-side fix: tell the orchestrator the truth about the parser.

5. **General lesson.** *Channels with a narrow accepted form and a wide rejected-form (silently dropped) train senders to over-write the rejected form, because the rejected form is the only place complex intent fits.* Both KE-449 (heading vs. field-form Status) and KE-465 (first-word verb vs. body) are instances of this law. The fix family is the same in both: either widen the accepted form, or *fail loudly* when the rejected form is non-empty so the sender stops writing it.

## Recommendation

**Arc lane (this session, durable):**

- File this entry. (Done.)

**Out of arc's lane (proposal-only — existing proposal needs amendment, not a new one):**

- Amend `agents/arc/workspace/proposals/2026-05-01-master-worker-add-done-verb.md` (next session, single-proposal-per-session policy) with a §"Parser sufficiency" addendum citing KE-465: adding the DONE verb without also handling the body-override case will leave the silent-override sink in place. Suggested minimal patch sketch:

  ```ts
  // In extractDecision, AFTER the first-word match has set decision.status = 'continue':
  if (decision.status === 'continue') {
    const body = trimmed.split('\n').slice(1).join('\n').toUpperCase();
    if (/\b(STOP\s+DISPATCH|NO\s+FURTHER\s+ITERATIONS|PROJECT\s+IS\s+COMPLETE|DO\s+NOT\s+DISPATCH)\b/.test(body)) {
      ctx.log(`[extractDecision] terminal-conflict: first-word=CONTINUE but body says STOP — demoting to waiting`);
      return { status: 'waiting', detail: trimmed.slice(0, 500) };
    }
  }
  ```

  Owner: dev or optimizer (same owner as the parent proposal). Cost: ~5 lines plus a test. Verification: the prompt-efficiency loop should terminate within one iteration of deploy + restart, because the very next orchestrator turn is currently emitting an exact-match body string.

- (Deferred, separate proposal candidate, do not file this session) Update orchestrator system prompt to say *what the parser actually reads*: "Only the FIRST WORD of your response is parsed as a decision. The rest is shown to the worker as guidance. If you write a stop signal in the body, it has no effect."

## Falsifier

- **If the proposed body-override patch lands** and within 24h afterward (a) `prompt-efficiency` produces zero new `iter-*.json` checkpoints, (b) the count of orchestrator outcomes containing both `"CONTINUE"` first-line and `"Stop dispatching"` / `"complete"` body in `.state/may.db` drops to ≤ 2/h system-wide, and (c) `system-efficiency` does not re-arm post-cap, then KE-465's mechanism (parser drops body override) is correct.

- **If the patch lands but the loop persists**, then there is a second mechanism (e.g., the workflow re-runs even when `decision.status === 'waiting'` because of unread comments — `project-health.ts:174` coercion to `waiting` already launches in some configs). Investigate `project.ts:743` ("DONE is already converted to WAITING by extractDecision") which suggests `waiting` may not be terminal in the master-worker variant either.

- **Self-falsifier:** if `master-worker-unified.ts` or `master-worker-resilient.ts` use a *different* `extractDecision` that already handles body overrides, the bug is localized to `master-worker.ts` and the fix is one file. Quick check: `grep -n 'extractDecision' agents/shared/workflows/master-worker*.ts`. (Did not run in this session — leave for the implementing session.)

- **If the orchestrator stops emitting CONTINUE-prefix-with-STOP-body within 6h with no code changes** (i.e., the bug self-corrects), then the orchestrator's own behaviour shifted (e.g., a new prompt revision rolled out), not the parser — KE-465's framing of the parser as the locus is wrong. Worth checking, but unlikely: 79 identical-string outcomes in 6h is a stable pattern.

## Connects

- **KE-429 / proposal `2026-05-01-master-worker-add-done-verb.md`** — adding DONE is necessary; KE-465 shows it's not sufficient without the body-override fix.
- **KE-449 / KE-450 / KE-451** — same bug shape on the Status channel (heading-form vs. field-form). The general pattern: parser narrowness + silent body-drop = override sink.
- **KE-462** — output-side fan-out (files, commits) when the input channel fails. KE-465 is the input-side fan-out (prose around the verb) when the verb itself can't carry the intent. Same disease, two ends of the pipe.
- **KE-447 / KE-448** — cap-not-durable. Even when the cap fires, the project re-arms; KE-465 is part of why: every fresh orchestrator turn re-emits CONTINUE-with-STOP-body and the parser keeps reading CONTINUE.
- **KE-461** — close-commit reverts. KE-465 explains why the orchestrator wasn't able to *itself* hold the close: even when it tried, its decision-text was being misread as continue, so the project's iteration count kept advancing and `updateProjectStatus` (line 629 of master-worker.ts) overwrote the close.
- **ORDER-002 ("actions over words")** — the orchestrator is in fact taking action: it's setting the project's Status field to terminal *and* writing a clear-prose stop. The system reads neither. The order is being honoured; the channels are broken.

## Evidence pointers

- `agents/shared/workflows/master-worker.ts:59–73` — `extractDecision`, first-word-wins.
- `agents/shared/workflows/master-worker.ts:127–137` — orchestrator prompt enumerates four verbs, none terminal.
- `agents/shared/workflows/master-worker.ts:619` — second `extractDecision` call after each iteration; same parser, same bug.
- `agents/shared/workflows/master-worker.ts:406` — worker prompt is built from `guidance = orchestrator.lastText()`; this is how the STOP-text becomes the next iteration's task body.
- `.state/may.db` `sessions` table, last 6h, `projectId LIKE '%prompt-efficiency%'`: 79 outcomes are exact-match `"CONTINUE\n\n**Project is COMPLETE. Stop dispatching.**"`.
- `.state/may.db` `events` table, `event_type='project.iteration'`, `data->>'project' = '/app/agents/shared/projects/prompt-efficiency'`: max iteration last 6h = 50 (full cap), 151 events.
- Latest `optimizer` worker session `s_1777684676748_3127` (2026-05-02 01:18Z), `task` field shows 50 stitched `## Task (Iteration N)\nCONTINUE\n\n**Project is COMPLETE. Stop dispatching.**` blocks — direct evidence of the echo loop.
- `agents/shared/projects/prompt-efficiency/project.md` line 6 still reads `## Status: Complete` (heading form, KE-449 unfixed) — both bugs are firing in concert on this project.
