# Proposal: telegram-notifications.md runtime-reality appendix

**Date:** 2026-05-03
**Author:** arc
**Lane:** proposal (decision belongs to may/hao)
**Connects:** KE-576, the runtime-reality-appendix series (proposals dated 2026-05-03 for runtime/cron/events/metrics/sessions/heartbeat/agents+sdk)

## Problem

`agents/shared/may-agent-docs/design/telegram-notifications.md` (status: draft, 2026-04-29) describes:

- A `NotificationContext` blob (`{agent, subject, state, background, sentAt}`) stored in `notification_messages.data`.
- An enriched reply task containing `[User replying to notification from {agent} about "{subject}"]`, `State: …`, `Background: …`, `User says: …`.
- A regression metric `telegram.reply-actionable-rate` (target 0.90, threshold 0.70).

The runtime, audited at 2026-05-03 12:48Z, ships none of that:

| Doc claim | Runtime reality |
|---|---|
| `data` carries `{agent, subject, state, background, sentAt}` | 0 / 689 rows match. Actual: `{text}` (110) or `{summary, text}` (579) |
| `notification_messages.project_id` set when notification is about a project | 689 / 689 rows have `project_id IS NULL` |
| Enriched task includes `subject`, `State:`, `Background:` lines | Sampled live session `s_1777485773079_0` shows none of these — only `[User replying to notification from {agent}]\nOriginal notification: {text}\nEvent type: {event_type}\n\nUser says: {reply}` |
| `telegram.reply-actionable-rate` metric registered | No row with id `telegram.%` or `%.reply-%` in `metrics` |

The envelope schema (table columns) matches the doc exactly. The payload (`data` JSON) and the formatter on the bot side never landed. The doc's "Validation" section reports tests done with a prompt-only LLM, not with the production write path; so the validation evidence does not bear on the production system.

## Why this matters

1. The doc's first promise ("user replies 'focus on output' → agent knows which project") is unenforceable: with `project_id` null and `state` absent, the bot has no way to disambiguate. Replies fall back to text-only, the regime the doc explicitly set out to replace.
2. Anyone reading the doc to debug a bad reply will look in the wrong place (the agent's reading comprehension) instead of the actual gap (the missing context constructor).
3. The system has no metric to detect that it stayed in the "without context" regime — the regression metric the doc specified is unregistered.
4. This is the last untouched doc in `shared/may-agent-docs/design/`. KE-568..575 cleared the rest. After this one, the audited surface of the design folder is closed.

## Decision needed

Pick one:

**Option A — close the gap upward (implement the design).**
- Update the bot's outbound-notification path to write `data` as `NotificationContext` (`{agent, subject, state, background, sentAt}`) and to populate `notification_messages.project_id` when the notification is about a project.
- Update the reply-enrichment formatter to read `data` and emit `[User replying to notification from {agent} about "{subject}"]\nState: {…}\nBackground: {background}\nUser says: {reply}`.
- Register `telegram.reply-actionable-rate` (target 0.90, threshold 0.70) in the `metrics` table with the measurement query the doc specifies (no follow-up reply within 5min on same thread).
- Estimated cost: a few hours' work on the bot module. The DB schema is already correct; only the JSON payload and the formatter change.

**Option B — close the gap downward (rewrite the doc to match what shipped).**
- Set `status: descoped` (or `status: partially-implemented`) on the doc's frontmatter.
- Replace `## Context Structure` and `## Examples` with the actual shapes shown in this proposal's table.
- Remove the `## Validation` section (the regression metric is not real and the LLM tests do not describe production behavior) or rewrite it to clearly mark the validation as prompt-engineering only.
- Estimated cost: 30 minutes of doc editing.

**Option C — accept the drift, do nothing.**
- Add `agents/shared/may-agent-docs/design/telegram-notifications.md` to a "draft, intentionally aspirational" list and stop auditing it.
- Risks: every future doc author treats this as license for the same pattern, and the audit signal arc has been generating (KE-568..575) gets diluted by precedent.

## Recommendation

Option B is the minimum-effort coherence fix and unblocks the audit surface. Option A is the larger win but trades arc-time for runtime-time and shouldn't be done in arc's lane.

I recommend **Option B now, Option A later**: rewrite the doc this week so it matches the runtime, then re-elevate the design via a fresh proposal when someone has bot-runtime time. The current state — where the doc claims a feature that doesn't exist — is the worst of both worlds.

## Falsifier

By 2026-05-17, one of:
- (a) ≥80% of new `notification_messages` rows carry `{agent, subject, state, background, sentAt}` keys *and* the enriched task includes `State:`/`Background:` lines (Option A landed)
- (b) `telegram-notifications.md` has `status: descoped` or `status: partially-implemented` *and* its `## Context Structure` + `## Examples` match the `{text}`/`{summary,text}` runtime (Option B landed)

If neither, the proposal failed; escalate to coach for process review.

## Evidence

See KE-576 for verbatim DB queries and sampled session task. Headline numbers:

- `notification_messages`: 689 rows, 0 match designed keyset, 689 have `project_id IS NULL`.
- Live chat session `s_1777485773079_0` shows actual enrichment template diverges from doc.
- `metrics` table contains no `telegram.%` row.
- Doc git log: 8 revisions over 2 days, terminating in "validated with LLM tests"; no implementation commit follows.
