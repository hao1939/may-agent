# KE-576: telegram-notifications.md design doc drift from runtime — context blob shape unimplemented and enrichment format diverged

**Date:** 2026-05-03 12:48Z
**Author:** arc (heartbeat session, system coherence audit)
**Confidence:** High — direct DB inspection of all 689 live `notification_messages` rows and a sampled enriched reply session.
**Connects:** KE-568 (events.md drift), KE-570/571/572/574/575 (the runtime-reality-appendix series), KE-452 (agent-metrics doc drift), the doc's own `Validation` claim.

## TL;DR

`agents/shared/may-agent-docs/design/telegram-notifications.md` is the most recent (2026-04-29, status: draft) doc in the design folder, and it is the next domino in the "design doc says X, runtime does Y" pattern arc has been clearing (KE-568..575). Two coupled drifts:

1. **Context blob shape never landed.** The doc's `## Context Structure` declares every outbound Telegram message stores a `NotificationContext` blob with **5 keys**: `agent`, `subject`, `state`, `background`, `sentAt`. The live `notification_messages.data` column for **0 of 689 rows (100%)** uses that shape. Actual shape:
   - `{summary, text}` — 579 rows (`event_type='notification'`)
   - `{text}` — 110 rows (`event_type='response'` or `'error'`)
   No row carries `agent`, `subject`, `state`, `background`, or `sentAt` inside `data`. The `agent` column on the row is set, but the *typed context* the doc's enrichment relies on is absent.
2. **Enrichment format diverged.** The doc's `## Examples` section shows the agent receiving messages like `[User replying to notification from may about "project system-efficiency"]\nState: WAITING, metrics at target …\nBackground: …\nUser says: …`. The actual enriched task on the only chat session in the last 24h (`s_1777485773079_0`, may, kind=chat) is:

   ```
   [User replying to notification from may]
   Original notification: 36k files — grep one by one is too slow. …
   Event type: response

   User says: What's the progress
   ```

   No `subject`. No `State:`. No `Background:`. The agent receives the raw last-message text plus an `Event type:` label that the doc never mentions. The doc's "Validation" table claims context enrichment converts ambiguous replies into precise actions; the runtime cannot deliver that because the context object does not exist.

## Evidence

```
$ bun -e "...notification_messages keysets..."
{ "text": 110, "summary,text": 579 }
wanted-set ('agent,background,sentAt,state,subject') count: 0
```

- `PRAGMA table_info(notification_messages)` shows columns `telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at` — these match the doc's `### Storage` SQL exactly. So the *envelope* schema landed; the *payload* (`data`) shape did not.
- All 689 rows have `project_id IS NULL` despite the doc's first example being a `project system-efficiency` notification. Means the side-channel hint that would let the bot recover project context on reply is never set in practice.
- Sampled enriched reply session `s_1777485773079_0` (may, chat) — task body shown above; reproduced verbatim from `sessions.task`.
- Git log on the doc shows status churn `f5af94e33 → 25ed65bf7 → 9f0329d0b → bd2475250 → b5ffef631 → 2d74c53e9 → dd773d0e6 → 0672134e4` between 2026-04-29 and 2026-04-30, ending in "validated with LLM tests + regression metric defined". The doc was *validated for prompt-engineering plausibility*, never against the production write path.
- `metrics` table contains **no** `telegram.reply-actionable-rate` row (the regression metric the doc commits to). So the falsifier the doc set for itself is unmonitored.
- `notification_messages` retention: doc says `Expire after 7 days`. Oldest row is 91h old (within window) and zero rows are >7d old, so retention is *consistent with* the design — but cannot be distinguished from "the system has only been running 4 days at this shape" (no expire job needed yet).

## Implication

1. **The doc oversells what the system does.** Anyone reading `telegram-notifications.md` to debug a bad reply will believe state-snapshot enrichment is happening. It isn't. They'll waste time looking for the bug in the agent's reading-comprehension instead of in the (non-existent) context constructor.
2. **The "context-enriched reply" goal failed silently.** The validation table compares "without context" vs "with context". The runtime is permanently in the "without context" column for every reply the system has ever processed (689/689). The Validation evidence in the doc came from prompt-only LLM tests, not production traffic. A regression metric was specified but never registered — so the system has no way to detect it stayed in the "without context" regime.
3. **This is the same family as KE-568..575.** Each of those was design-doc-vs-runtime drift on a piece of infra (events, sessions, metrics, cron, runtime, agents, sdk, heartbeat). Telegram-notifications is the last untouched design doc in `shared/may-agent-docs/design/`. After this one, the audited surface of that folder is closed.
4. **`project_id` always-null breaks the doc's first promise.** The whole point of context enrichment was "user replies 'focus on output' → agent knows which project". With `project_id` and the structured `state` blob both missing, that promise is unenforceable from the bot side — it can only fall back to text-grep on the notification body, which is exactly what the doc wanted to replace.

## Recommendation

Two parts, split between arc lane and may lane (matching the pattern of KE-571/572):

**Arc lane (this session, durable):**
- Write `agents/arc/workspace/proposals/2026-05-03-telegram-notifications-md-runtime-reality-appendix.md` enumerating: (a) what the runtime actually stores in `data`, (b) what the actual enriched reply task looks like, (c) the missing `telegram.reply-actionable-rate` metric, (d) the recommended choice — close the gap by implementing the design, or rewrite the doc to describe the simpler shape that actually shipped.
- This KE entry (lane: `shared/knowledge/entries/`).

**May/Hao lane (proposed, not in this session):**
- Decide adoption: implement the design (write `data` as `NotificationContext`, set `project_id`, rebuild enrichment formatter to insert State/Background) **OR** mark the doc `status: descoped` and rewrite the Validation/Examples sections to describe what shipped.
- If implementing: register `telegram.reply-actionable-rate` in the `metrics` table.

Per arc's escalate-don't-edit policy (KE-451), arc does not unilaterally rewrite the doc to match the simpler reality, because that would silently lower the bar — the design's *goal* is correct (context-enriched replies are clearly better than naked text-only) and the right move may be to close the gap upward, not downward.

## Falsifier

If by 2026-05-17 either:
- (a) `notification_messages.data` for ≥80% of new rows carries `{agent, subject, state, background, sentAt}` and the enriched task includes `State:` / `Background:` lines, OR
- (b) `telegram-notifications.md` has been edited to set `status: descoped` (or rewritten so its `## Context Structure` and `## Examples` match the `{text}`/`{summary,text}` runtime),

then this entry's recommendation has been actioned and KE-576 closes.

If neither has happened by 2026-05-17, the proposal had no effect; arc should escalate to coach for a process review (the runtime-reality-appendix series will have been ignored at scale, not just on this one doc).

## Connects

- **KE-568..575**: same pattern — design doc claims X, runtime does Y. KE-576 extends the appendix series to the last untouched doc in `shared/may-agent-docs/design/`.
- **KE-452**: design doc lists fewer metrics than the DB. Same "doc smaller than runtime"; here the doc is *richer* than the runtime — drift can go either direction and arc should keep flagging both.
- **KE-450/451**: lane-discipline reason arc writes a proposal instead of editing `telegram-notifications.md` directly even though it sits in an in-lane folder.

## Evidence pointers

- `agents/shared/may-agent-docs/design/telegram-notifications.md` (lines 32–61: `## Context Structure`; lines 63–168: `## Examples`; lines 270–292: `## Validation`)
- `notification_messages` table: 689 rows, key inspection above; `project_id NULL = 689/689`; no `agent,background,sentAt,state,subject` keyset
- Live session `s_1777485773079_0` (may, kind=chat) — `sessions.task` body shows actual enrichment template `[User replying to notification from {agent}]\nOriginal notification: {text}\nEvent type: {event_type}\n\nUser says: {reply}`
- `metrics` table: no row with id matching `telegram.%` or `%.reply-%`
- `git -C /app/agents log -- shared/may-agent-docs/design/telegram-notifications.md` (8 revisions 2026-04-29 → 2026-04-30, ending in "validated with LLM tests" — no implementation commit follows)
