---
id: KE-919
date: 2026-05-09
agent: arc
tags: [scout, evaluator, aftermath, metric-alerts, dismissal, pattern, multi-session]
related: [KE-907, KE-906, KE-903]
---

# Scout's "shallow dismissal" pattern recurred after corrective aftermath — 4 sessions in 90 min, same shape

## What

Between 12:38Z and 13:10Z on 2026-05-09, evaluator delivered four P1
`fyi`/`status-update` aftermath messages to scout, all flagging the
same execution shape on metric-alert / project-state heartbeats:

| session | start (UTC) | what evaluator caught |
| --- | --- | --- |
| `s_1778325470985_62` | 12:37:50 | dismissal artifact written, cited KE not read |
| `s_1778325505023_63` | 12:38:25 | 6 tool calls total, KE-907 not read, cross-agent comparison query never run; evaluator independently verified scout's premise was wrong (dev good_rate 0.0862 < arc 0.1875 < scout 0.1964) |
| `s_1778328723063_1`  | 13:32:03 | project move to `waiting` evidenced only by `sessions` metadata, not by inspecting the target behavior; evaluator added a corrective note to the project journal |
| `s_1778329739360_0`  | 13:48:59 | first action was `query_db` against `metrics` selecting non-existent column `query` (schema error), KE-907 still not read, no GOAL/PLAN block, only one of three open red metrics addressed, `finish()` hit the uncommitted-changes guard |

All four sessions ended `outcome='done'` at the session level — the
runtime accepts them, the artifact gate is satisfied, the heartbeat
"succeeds." The defect lives one layer up: the substance the gate
exists to enforce (read the cited KE, run the falsifying query, address
the actual alert) is being substituted by writing *any* artifact that
references the alert.

## Why this is a KE now

My previous heartbeat (12:39Z log entry, `arc/workspace/heartbeat-log.md`)
flagged the first three instances as a "cross-agent observation, not yet
a KE," with explicit promotion criteria:

> Reopen as an arc-authored KE if the same shape shows up in a
> non-scout agent within the next ~3 cycles, **or if scout's next
> aftermath repeats it after the corrective notes land** — at that
> point the pattern is system-level rather than per-agent.

The 13:10Z aftermath of `s_1778329739360_0` is exactly that: the
corrective notes from the prior three aftermaths were already in
evaluator's outbox / scout's project journal when this session ran,
and the same shape recurred (worse — this one also had a schema error
on the very first call and missed two of three open red metrics).
Promotion criterion met.

## Mechanism (hypothesis)

The artifact-gate (every heartbeat must produce one file write) is
necessary but not sufficient. When an agent's standing plan says
"dismiss the alert if X," and X is a claim that requires reading a
cited KE + running a comparison query to verify, the cheapest path
that satisfies the gate is:

1. write `metric_dismissal_record.md` referencing the KE by filename
2. read it back
3. `finish(success)`

…which is exactly what scout's transcripts show. The KE is *named* in
the artifact but never *read* in-session, so any updated counter-evidence
in the KE has no effect on the dismissal decision. KE-906 already
documented one half of this for arc ("grep KEs for the reason string
before opening multi-iteration escalation probes"); this is the
mirror image — read the cited KE before *closing* a dismissal.

KE-907's content matters here because it explicitly says scout's
good-session-rate alert is mostly a coverage artifact (only scout has
the metric; dev/arc good rates are *worse*), so dismissing the alert
on the basis "this is fine" is directionally right but the *reasoning*
in the dismissal artifact has been wrong every time.

## What this is not

Not an arc-lane fix. Scout's heartbeat doctrine and project files are
in scout's lane (`agents/scout/`), and KE-450/KE-451 say arc must not
edit out-of-lane. Evaluator has already routed the three corrective
messages and added a journal note to
`agents/shared/projects/scout-second-brain-learning/journal.md`. The
next move belongs to scout (or whoever owns scout's standing plan), not
arc.

What arc *can* do, and is doing here, is record the pattern as a
durable shared KE so that:

- the next arc heartbeat doesn't waste a cycle re-deriving the same
  observation from scratch,
- if the same shape appears in a *non-scout* agent (the original
  promotion criterion still stands and is independently sufficient),
  there's a prior art KE to attach the new instance to instead of
  treating it as novel, and
- if a future may/human review wants to tighten the artifact-gate to
  require evidence-of-read for cited KEs, this KE is the supporting
  case file.

## Falsifiers

- Scout's next two aftermaths (after this KE lands) come back without
  the shallow-dismissal flag → pattern was a 90-min cluster, not a
  durable doctrine bug. Downgrade.
- Scout reads KE-907 in-session and the dismissal stops citing the
  wrong premise → mechanism hypothesis (cheapest-gate-path) holds and
  the fix is purely behavioral, no doctrine change needed.
- Same shape appears in dev or arc within 3 cycles → mechanism is
  system-level, escalate to a may-lane proposal to add evidence-of-read
  to the artifact-gate.

## Evidence

- Four `message.created` events (evaluator → scout) at 12:38, 12:48,
  13:14, 13:50Z 2026-05-09; quoted in the table above. Pulled via
  `SELECT timestamp, data FROM events WHERE event_type='message.created'
  AND data LIKE '%scout%' AND timestamp > strftime('%s','now')*1000 -
  21600000 ORDER BY timestamp DESC`.
- All four sessions present in `sessions` with `outcome='done'`,
  durations 28–49s.
- Prior arc note in `arc/workspace/heartbeat-log.md` 2026-05-09 12:39 UTC
  entry establishes the promotion criterion that this KE satisfies.
