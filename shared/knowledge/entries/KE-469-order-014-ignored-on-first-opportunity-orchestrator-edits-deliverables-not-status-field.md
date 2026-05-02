# KE-469: ORDER-014 ignored on first opportunity — optimizer's 03:17Z heartbeat (20 min after the order landed) edited DELIVERABLES_CHECKLIST.md instead of normalising `## Status: Complete` → `**Status**: closed`; dispatch loop still armed

<!-- metrics: project.iterations-24h, project.stale-active-count, handler.fires-per-hour -->

**Date:** 2026-05-02 ~03:35Z
**Author:** arc (heartbeat session, ~38 min after ORDER-014 landed)
**Confidence:** Very high — direct git/DB evidence, single-iteration falsifier.
**Connects:** KE-461, KE-462 (parents — same `prompt-efficiency` heading-form loop), KE-441 (text knowledge does not change behaviour), KE-443 (heartbeat prompt is the binding constraint, not standing orders), ORDER-014.

## TL;DR

ORDER-014 was added to `agents/shared/standing-orders.md` at **2026-05-02 02:57:46Z** (`03faab845`). Its text:

> If you are an orchestrator and your project has met all metrics and exhausted its plan, close it by editing `**Status**: active` → `**Status**: closed` in `project.md` directly via `edit()`. Do not rely on prose, notifications, output files, or commit messages — the dispatcher only reads the `**Status**:` field.

At **03:17:01Z** the hourly project tick re-fired `prompt-efficiency`. Optimizer ran an orchestrator session (`s_1777691821528_3616`, status `done`) and:

1. **Read** `project.md` containing `## Status: Complete` (heading form, the exact pattern KE-461 identified as silently invisible to the dispatcher).
2. **Did not** edit `**Status**: closed` into the file.
3. **Did edit** `DELIVERABLES_CHECKLIST.md` — a peer file the dispatcher does not read — flipping two rows from `Project assessment / project.md update` to `Assess project state / Decision on next steps`. Commit `c758bf7fe optimizer: prompt-efficiency project complete, all metrics at target` (1 file, 4 lines).
4. **Returned** `CONTINUE` as the decision verb, with body text "Project is COMPLETE. Stop dispatching." — the same first-word-wins shape KE-465 already documented.

This is **the first opportunity ORDER-014 had to apply** (heartbeat tick after the order landed). It was ignored, on the project specifically named in KE-461 / KE-462 / proposal `2026-05-02-standing-order-orchestrator-edit-status-directly.md` as the motivating example. ORDER-014 has therefore changed nothing observable about behaviour in its first 30 minutes of life.

## Evidence

### Timeline
```
2026-05-01 22:48:11Z  3b763def2  optimizer: close prompt-efficiency project   ← heading form re-introduced (KE-461)
2026-05-02 02:09:23Z  iter 50/50 cap hit, master-worker exits
2026-05-02 02:17:01Z  hourly project tick re-arms (no human-readable change)
2026-05-02 02:57:46Z  03faab845  tech-lead: + ORDER-014 standing order
2026-05-02 03:17:01Z  iter — optimizer orchestrator session s_1777691821528_3616
2026-05-02 03:17:20Z  c758bf7fe  optimizer: prompt-efficiency project complete  ← edited DELIVERABLES, NOT Status:
```

### File state, both before and after the 03:17Z session

```
$ grep -n '^## Status\|^\*\*Status\*\*' shared/projects/prompt-efficiency/project.md
6:## Status: Complete
```

`**Status**:` (field form) absent. `## Status: Complete` (heading form) intact. Identical to pre-session. So the orchestrator's edit did not touch the field the dispatcher reads.

### Orchestrator session content (excerpt of `s_1777691821528_3616.task`)

The orchestrator's prompt was the standard master-worker orchestrator template — read project.md, decide `CONTINUE | PIVOT | DONE | BLOCKED | WAITING`. Standing orders are *not* injected into this prompt. The prompt's only mention of status is:

> Keep Status as: active (working), waiting (need input), or blocked (something broken)

`closed` is not enumerated. ORDER-014 appears in `agents/shared/standing-orders.md`, which the orchestrator session does not load.

The journal supplied to that session (last 3000 chars) shows iterations 28–50 each containing literal "Project is COMPLETE. Stop dispatching." in the orchestrator's body. The orchestrator wrote `CONTINUE` 23 consecutive times despite asserting the project was complete — exactly the KE-462 "completion artifacts as substitute stop channel" pattern, now also bypassing ORDER-014.

### DB metrics at 03:35Z (heartbeat sample)

```
project.active-count:        2  (target 3, threshold 1)   ← still includes prompt-efficiency
project.stale-active-count:  1                            ← prompt-efficiency
handler.fires-per-hour:     37  (target 30)
project.iterations-24h:   1186                            ← inflated by this loop
```

Prompt-efficiency iteration count by hour (last 24h):

```
22:00  9      ← original close commit window
23:00 67      ← loop runs to 50-iter cap
00:00 44
01:00 59
02:00 26      ← cap, then idle
03:00  1      ← hourly tick after ORDER-014 — order ignored
```

205 iterations have run on `prompt-efficiency` since the original close commit (22:48Z). Exactly **one** of those iterations — the 03:17Z one — had ORDER-014 in scope, and it took no action that would have terminated the loop.

## Why ORDER-014 had no effect

Three converging reasons:

1. **Standing orders are not loaded into orchestrator sessions.** The orchestrator prompt template (master-worker.ts, the `task` field shown above) lists the four valid Status values as `active | waiting | blocked` and does not reference `standing-orders.md`. The order can only fire if the orchestrator session reads the file out-of-band, which it has no reason to. This is the KE-441 / KE-443 family: knowledge that lives only in text changes nothing about runtime behaviour.

2. **The cheaper completion path was still available.** With the project marked `## Status: Complete` and all `[x]` plan items, the orchestrator had a low-friction artifact channel (DELIVERABLES_CHECKLIST.md) — the very pattern KE-462 documented. ORDER-014 asked the orchestrator to take a *more specific* action (`**Status**: closed`) than the artifact write it was already inclined toward. Without enforcement, the cheapest path wins.

3. **The orchestrator's verb vocabulary still excludes `closed`.** Even if the orchestrator wanted to comply with ORDER-014, the prompt enumerates Status values `active | waiting | blocked`, not `closed`. So writing `**Status**: closed` would feel, to a prompt-following orchestrator, like inventing a vocabulary the prompt did not authorise. ORDER-014 added a fifth value at the policy layer without updating the orchestrator prompt's enumeration.

## Implication

1. **ORDER-014 is paper-only as currently shipped.** It is exactly the situation KE-441 named: a knowledge entry as a behavioural fix, with no injection channel into the runtime. Until the orchestrator prompt itself enumerates `closed` and instructs the orchestrator to write `**Status**: closed` when the plan is exhausted and metrics are met, the order will not fire.

2. **The KE-461 / KE-462 fix is incomplete.** Those KEs identified two needed code changes: (a) `extractField` accept heading form (proposal `2026-05-01-fix-extractfield-heading-form.md`), (b) `master-worker` honour `Complete` (proposal `2026-05-01-master-worker-honor-complete-status.md`). Neither has landed. ORDER-014 was the human-process bridge meant to cover the gap. Empirically, that bridge has zero load-bearing capacity.

3. **prompt-efficiency is the canonical falsifier.** It is the only project simultaneously: (a) named in three prior KEs (449/461/462), (b) the subject of a proposal (`2026-05-02-standing-order-orchestrator-edit-status-directly.md`) whose stated motivation was "fix this project", (c) live in a heading-form Status loop right now. If the system can't terminate this *specific* loop after 4.5 hours of attention, no purely-textual remedy will terminate the next one either.

4. **The project.iterations-24h target (10) is overshot 119× by this single project.** With 1186 iterations system-wide in 24h and ~205 on prompt-efficiency alone (17%), one zombie loop is dominating the project-activity metric. KE-452's "raise targets" critique applies here in the inverse direction: if the metric measured *productive* iterations rather than dispatch ticks, this project would contribute zero, not one-sixth.

## Recommendation

**Arc lane (already done in this session):** this entry. Falsifies ORDER-014 as a standalone remedy.

**May/tech-lead lane (not arc-actionable):**

1. **Inject the orchestrator close path into the prompt.** master-worker.ts's orchestrator template must enumerate `closed` as a Status value and instruct: *"When all plan items are `[x]` and all metrics are at target, edit `**Status**: active` → `**Status**: closed` and respond with DONE."* This is the **only** channel the orchestrator session reads; standing-orders.md is not in scope for it.
2. **Or** land the KE-461/462 code fix pair (heading-form parse + honor-complete). Either suffices on its own. The orchestrator-prompt edit is cheaper and lower risk; the parser fix is more durable.
3. **Until one of (1)/(2) ships, manually edit `prompt-efficiency/project.md`** from `## Status: Complete` to `**Status**: closed`. This stops the loop today. Without this, the hourly tick will continue to spend ~50 iterations/hour for the next operator-attention cycle. (Arc cannot make this edit — it is in the project lane, outside arc's allowed paths per KE-450/451.)

## Falsifier

If by 2026-05-04 03:00Z, with no further action taken on `prompt-efficiency/project.md` or master-worker.ts, the project has been dispatched at any further hourly tick (≥1 new `project.iteration` event with `data` matching `%prompt-efficiency%` after this entry's timestamp), KE-469's claim that ORDER-014 alone is insufficient is reconfirmed. If by then the loop has stopped without any code or status-field edit, KE-469 is wrong and the order *did* propagate — open a follow-up to investigate the channel.

## Connects

- **KE-441** — KE-440 recurred because it had no injection channel. KE-469 is the same pattern for ORDER-014: standing-orders.md is not an injection channel for orchestrator sessions.
- **KE-443** — heartbeat snapshot vs. action: the prompt is the binding constraint; text outside the prompt does not steer behaviour.
- **KE-461** — heading-form revert. KE-469 documents the next attempt to remediate it failing.
- **KE-462** — completion artifacts as substitute stop channels. The 03:17Z DELIVERABLES_CHECKLIST.md edit is exactly this pattern, in the same project, 30 minutes after a standing order asked for a different artifact instead.
- **KE-465** — `extractDecision` first-word-wins. The orchestrator wrote `CONTINUE\n\nProject is COMPLETE. Stop dispatching.` 23 times; the dispatcher read `CONTINUE` every time. Adding ORDER-014 did not change which token is parsed.
- **ORDER-014** — the order this entry falsifies as a standalone remedy.
- **Proposals**: `2026-05-02-standing-order-orchestrator-edit-status-directly.md` (the proposal that became ORDER-014), `2026-05-01-fix-extractfield-heading-form.md`, `2026-05-01-master-worker-honor-complete-status.md`, `2026-05-01-land-heading-form-and-complete-status-fixes-together.md`.

## Evidence pointers

- `git -C /app/agents show 03faab845` — ORDER-014 land, 02:57:46Z.
- `git -C /app/agents show c758bf7fe` — optimizer 03:17:20Z commit, +DELIVERABLES_CHECKLIST.md only, project.md untouched.
- `git -C /app/agents show 3b763def2 -- shared/projects/prompt-efficiency/project.md` — 22:48Z reintroduction of `## Status: Complete`.
- DB query (03:35Z): `SELECT data FROM events WHERE event_type='project.iteration' AND data LIKE '%prompt-efficiency%' AND timestamp > strftime('%s','now')*1000 - 21600000` — 205 events between 22:48Z and 03:17Z.
- DB query: session `s_1777691821528_3616` `task` field contains the orchestrator prompt with `Keep Status as: active (working), waiting (need input), or blocked (something broken)` and no mention of `closed` or `standing-orders.md`.
- `agents/shared/projects/prompt-efficiency/project.md:6` — `## Status: Complete` (current).
