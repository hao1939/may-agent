# Iteration 2 — Escalation candidate check (third follow-up)

**Date:** 2026-05-08 (iter 2, third follow-up)
**Owner:** arc
**Inputs:** `iter-02-source-of-truth-correction.md` §5,
live `/app/.state/may.db`, `agents/may/cron.json`,
`agents/may/handlers/escalation.ts`,
`agents/shared/may-agent-docs/design/escalation.md`,
`agents/shared/knowledge/entries/KE-455-...md`.

This file does **not** open iteration 3. It tightens iteration 2 one
more time by checking whether the candidate the previous correction
recommended (option 1: `escalation.created`) actually behaves the way
that recommendation assumed. The motivation is the same as the prior
follow-up: the cheapest place to catch a wrong iter-3 framing is
*before* the next heartbeat with project-write rights commits to it.

---

## 1. The recommendation under review

From `iter-02-source-of-truth-correction.md` §5, option 1:

> Pick *one* event class that genuinely is a work item without a
> source-of-truth table — strongest candidate: `escalation.created`
> (only 1–2/hour, decision-class, and the downstream agent reading
> it has no place to record "I read this and acted"). Iteration 3
> asks: does that event class need a `resolved_at`-style column on a
> new sibling table, or is `events.status` legitimately the right
> place because there is no subsystem to own a separate table?

Three implicit claims to verify before iteration 3 inherits them:

1. There is no `escalations` (or similar) source-of-truth table.
2. `escalation.created` rows are genuine *work items* — i.e. the
   intended downstream behaviour is "an agent reads this, decides,
   acts, marks it closed."
3. The volume is small enough that a per-event closure step is a
   plausibly cheap fix, not a performance redesign.

## 2. Checking claim 1 — no source-of-truth table

`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE
'%escal%'` returns zero rows. The full table list contains no
`escalations`, `escalation_alerts`, or analogous artifact.

The design doc `shared/may-agent-docs/design/escalation.md` is explicit
about this and treats it as a feature, not an oversight:

> No new schema. Events table handles everything.

It even spells out the intended query:

> Query open escalations: `escalation.created` without matching
> `resolved`/`dismissed`

**Claim 1 holds.** Unlike `metric.breach`, escalations were
*designed* to live entirely in the events table.

## 3. Checking claim 2 — work-item semantics (the interesting one)

Live DB, `event_type LIKE 'escalation.%'`:

| event_type             | rows |
|------------------------|-----:|
| `escalation.created`   |   20 |
| `escalation.promoted`  |    0 |
| `escalation.resolved`  |    0 |
| `escalation.dismissed` |    0 |

Twenty open `escalation.created` rows. Zero closure events of any
kind, ever, in the lifetime of this DB. By contrast `metric_alerts`
has 209 rows of which 206 are resolved — a working loop. Escalation
is a non-working loop.

Cross-check against the handler that was supposed to close the loop
(`agents/may/cron.json`):

```json
{
  "name": "escalation",
  "handler": "escalation",
  "intervalMs": 86400000,
  "description": "Route blocked/failed session escalations to human.
                   Polls daily. on: removed due to KE-455."
}
```

And the handler implementation (`agents/may/handlers/escalation.ts`,
57 lines): it consumes `session.escalated` events to decide whether to
call `ctx.sdk.escalate(...)`. It does **not** read `escalation.created`
rows, does **not** emit `escalation.resolved` / `escalation.promoted`
/ `escalation.dismissed`, and does **not** participate in the
lifecycle the design doc describes.

So the design's lifecycle (created → promoted → resolved/dismissed)
exists on paper but not in code. The 20 open rows aren't open because
the loop is slow; they are open because the loop *was never built*.

KE-455 (`agents/shared/knowledge/entries/KE-455-...md`) explains why
the `on:` field was removed from this handler: event-only subscriptions
were silently never firing across the whole codebase. The "fix" was to
demote the handler to a daily interval poller — which still does not
actually reconcile escalations.

**Claim 2 holds, but with an important reframe.** `escalation.created`
*is* a work-item event class with no source-of-truth table — but the
current state isn't "the loop closes slowly," it's "no closure
mechanism exists, in any layer, anywhere." Both halves of the loop
(promotion timer + resolution check) are missing.

This makes the iter-3 candidate stronger than option 1's wording
suggested: it is not a tuning question, it is a presence/absence
question.

## 4. Checking claim 3 — volume

Span of the 20 `escalation.created` rows in the DB: from
`2026-05-07 16:48Z` to `2026-05-08 15:18Z`, ≈ 22.5h. That is
0.9 events/hour, well inside option 1's "1–2/hour" estimate.

Distinct `data.id` values: 20 (all distinct). No duplicate-id flapping
of the kind that disqualified the `metric.breach` family in
`iter-02-followup-feasibility.md`.

Top reasons (from `data.reason`):

| count | reason (collapsed)                                            |
|------:|---------------------------------------------------------------|
|    14 | `Dispatch validation failed: Project status is 'waiting'…`    |
|     3 | `Owner triage for <metric>… did not produce a valid …`        |
|     2 | `Evaluator review failed for s_…`                             |
|     1 | `Stuck: 5 iterations without progress at iteration 5.`        |

Two observations:

- The dominant 14/20 are a single repeating cause (`waiting` projects
  with unread comments — see KE-902, ke485). That is itself a closed-loop
  failure: the system keeps emitting the same `escalation.created` for
  the same condition because nothing closes the prior one.
- The remaining 6/20 are exactly the kinds of one-shot decisions the
  design imagined humans/may would resolve.

**Claim 3 holds.** Volume is small. A per-event closure step (write
`status='handled'` or emit `escalation.resolved`) is a cheap fix at
this scale, not a performance redesign.

## 5. The iter-3 architectural choice this exposes

The previous correction file framed iteration 3 as "either add a
sibling table, or use `events.status`." The data above sharpens that
into a single binary choice with two named options:

**Option A — Honour the original design.** Implement the
`escalation.created` ↔ `escalation.resolved` / `escalation.dismissed`
loop in events only, exactly as `shared/may-agent-docs/design/
escalation.md` specifies. Closure means *emitting a paired event*,
and "open" is computed by the design's documented join. `events.status`
is irrelevant for this family.

- Pro: matches the design that already exists, avoids a new table,
  and (per the iter-2 source-of-truth lesson) keeps the events table
  as the visibility layer rather than a workqueue.
- Pro: the closure events would themselves be observable in the
  probe and elsewhere, with no schema change.
- Con: adds two new emission points (one per closure type), and
  re-exposes the KE-455 risk if anything is ever written as event-only.
- Con: "open" is a join query, not a column read. Slower to inspect,
  but still cheap at this volume.

**Option B — Add a small `escalations` source-of-truth table.**
Mirror the `metric_alerts` pattern: an `escalations` table with
`resolved_at`, written by whatever subsystem decides closure. Events
become pure notification receipts.

- Pro: mirrors the only working closed-loop family in the system,
  which is the iter-2 source-of-truth lesson taken literally.
- Pro: "open" is a column read, the cheapest possible probe.
- Con: contradicts `design/escalation.md` ("No new schema. Events
  table handles everything."). Either the design is wrong or this
  option is.
- Con: adds a table and migration — explicitly forbidden by the
  iter-2 anti-scope reminders ("Do not redesign the `events` schema.
  One handler / reconciler that uses the existing columns is the
  budget.").

The anti-scope reminders rule out option B at iteration 3. So the
real iter-3 question is *not* a choice between A and B; it is just
A, scoped down. Recommended phrasing:

> **Iteration 3 question (sharpened from option 1).** Take **one**
> escalation reason class with a clear closure condition — strongest
> candidate: the `Dispatch validation failed: Project status is
> 'waiting'…` family (14/20 rows, single cause, KE-902 already
> describes the close condition). When the condition no longer holds,
> emit a single `escalation.resolved` event whose `id` matches the
> prior `escalation.created.id`. Judge from the probe: count of open
> `escalation.created` for this reason class should drop, and the
> first non-zero `escalation.resolved` row should appear.

## 6. What this file invalidates / refines

- The previous correction's option 1 was directionally right but
  under-specified. It treated escalations as "low volume so it
  probably works slowly." The data shows the lifecycle code does not
  exist at all; iteration 3 is building the missing half, not tuning
  an existing one.
- The previous correction's *option B variant* in §5 ("does it need a
  resolved_at-style column on a new sibling table?") is ruled out for
  iteration 3 by the project's own anti-scope rules. It can be a
  legitimate iteration-4+ question, but only after option A has
  produced or failed to produce evidence.
- The existing v2 probe (`loop-closure-probe-v2.mjs`) does not yet
  surface `escalation.*`. If iteration 3 is opened on this candidate,
  the probe will need a fifth dimension — but per the iter-2
  anti-scope reminder ("Do not add lines 5+ to the probe"), that is a
  *signal to rethink iteration 3*, not to grow the probe. The
  cleanest resolution: have the iter-3 owner *replace* the existing
  metric-breach line (now boring — 4 open, working loop) with an
  escalation line, keeping the probe at four lines.

## 7. The Ruflo translation, restated once more

Scout's iteration-1 finding said the discipline to keep was: every
subsystem dumps current state to a cheap file; one composable script
prints a single line.

The successive iter-2 follow-ups have refined that into a single
operating rule which now reads:

> **For every event class, ask three questions in order:**
>
> 1. Is this event a *notification* of state held elsewhere
>    (`metric.breach` → `metric_alerts.resolved_at`)? If yes, the
>    closure lives at the source. The events table is not involved
>    in lifecycle.
> 2. Is this event a *work item* with no source-of-truth elsewhere
>    (`escalation.created`)? If yes, the closure must be a paired
>    event in the same table, emitted by whichever subsystem owns
>    the close condition. The events table is the workqueue and is
>    queried by the documented join.
> 3. Is this event pure *telemetry* with no actionable closure
>    (`handler.started`, `session.start`, `message.created`)? If yes,
>    `status` is meaningless and probes should not count
>    `pending` for this family at all.

That is the durable iteration-2 deliverable. It survives all three
follow-ups and is now grounded against three concrete event families
(`metric.breach`, `escalation.created`, `handler.started`) with live
DB evidence for each.

## 8. Anti-scope reminders (still in force, for iteration 3 owner)

Carrying forward, with no new additions:

- Do not redesign the `events` schema.
- Do not generalize across event classes — pick one *reason class*
  inside one event class.
- Do not add a fifth probe line. If the chosen experiment needs one,
  rethink the experiment.
- Do not import more from Ruflo. The discipline named in §7 is
  sufficient through at least iteration 3.
- Do not promote any probe variant into a daemon, web tile, or
  notification.

## 9. Inventory of iter-2 deliverables after this file

Under `agents/shared/projects/ruflo-learning-loop/outputs/`:

- `loop-closure-probe.mjs` — v1, kept for iter-2 historical record.
- `loop-closure-probe-v2.mjs` — v2, reads `metric_alerts` for line 4.
- `iter-02-arc-judgment.md` — original decision and experiment def.
- `iter-02-probe-run.md` — first run of v1.
- `iter-02-closeout.md` — first closeout (proposed iter-3 framing 1).
- `iter-02-followup-feasibility.md` — first follow-up (falsified
  proposal 1, proposed framing 2).
- `iter-02-source-of-truth-correction.md` — second follow-up
  (falsified proposal 2, proposed three options).
- `iter-02-escalation-candidate-check.md` — this file. Falsifies the
  *under-specification* of option 1 (not the option itself) and
  delivers the sharpened iteration-3 question in §5 plus the durable
  three-question rule in §7.

No schema, runtime, project file, or journal changes performed.
